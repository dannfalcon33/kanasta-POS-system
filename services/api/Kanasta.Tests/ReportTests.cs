using System.Reflection;
using Kanasta.Api.Controllers;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Reports;
using Kanasta.Application.Sales;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Persistence.Seed;
using Kanasta.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kanasta.Tests;

public class ReportTests
{
    private static readonly Guid TestAdminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TestCashier1UserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid TestCashier2UserId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private (KanastaDbContext db, ISaleService saleService, IReportService reportService) CreateServices(string dbName)
    {
        var options = new DbContextOptionsBuilder<KanastaDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var db = new KanastaDbContext(options);

        if (!db.Categories.Any())
        {
            db.BusinessSettings.Add(DatabaseSeeder.GetSeedBusinessSettings());
            db.TaxRates.Add(DatabaseSeeder.GetSeedTaxRate());
            db.Categories.AddRange(DatabaseSeeder.GetSeedCategories());
            db.Suppliers.Add(DatabaseSeeder.GetSeedSupplier());
            db.Products.AddRange(DatabaseSeeder.GetSeedProducts());

            db.Users.Add(new User
            {
                Id = TestAdminUserId,
                Email = "admin@kanasta.local",
                PasswordHash = "hash",
                FullName = "Admin Principal",
                Role = UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            db.Users.Add(new User
            {
                Id = TestCashier1UserId,
                Email = "cajero1@kanasta.local",
                PasswordHash = "hash",
                FullName = "Cajero Uno",
                Role = UserRole.Cashier,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            db.Users.Add(new User
            {
                Id = TestCashier2UserId,
                Email = "cajero2@kanasta.local",
                PasswordHash = "hash",
                FullName = "Cajero Dos",
                Role = UserRole.Cashier,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            db.SaveChanges();
        }

        var saleService = new SaleService(db);
        var reportService = new ReportService(db);

        return (db, saleService, reportService);
    }

    [Fact]
    public async Task Dashboard_Calculates_ExactNetSales_CMV_AndGrossMargin_ForBaselineScenario()
    {
        var (db, saleService, reportService) = CreateServices(nameof(Dashboard_Calculates_ExactNetSales_CMV_AndGrossMargin_ForBaselineScenario));

        // Product Harina: SalePrice = 1.20, AverageCost = 0.85, TaxRate = 16% (0.192 / unit)
        // Product Arroz: SalePrice = 1.35, AverageCost = 0.95, TaxRate = 16% (0.216 / unit)
        // Sale 1: 10 units of Harina -> Subtotal = 12.00, Tax = 1.92, Total = 13.92, CMV = 10 * 0.85 = 8.50
        var sale1Request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductHarinaId, 10.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 20.00m,
            PaymentReference: null
        );
        await saleService.CreateSaleAsync(sale1Request, TestCashier1UserId, isAdmin: true);

        // Sale 2: 5 units of Arroz -> Subtotal = 6.75, Tax = 1.08, Total = 7.83, CMV = 5 * 0.95 = 4.75
        var sale2Request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductArrozId, 5.0m) },
            PaymentMethod: PaymentMethod.Card,
            PaymentAmount: 10.00m,
            PaymentReference: "CARD-REF-1234"
        );
        await saleService.CreateSaleAsync(sale2Request, TestCashier2UserId, isAdmin: true);

        var summary = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams());

        // Baseline verification:
        // NetSales: 12.00 + 6.75 = 18.75
        // GrossSales: 13.92 + 7.83 = 21.75
        // TaxTotal: 1.92 + 1.08 = 3.00
        // CMV: 8.50 + 4.75 = 13.25
        // GrossMargin: 18.75 - 13.25 = 5.50
        // Margin%: (5.50 / 18.75) * 100 = 29.33%
        // AverageTicket: 21.75 / 2 = 10.88
        Assert.Equal(18.75m, summary.NetSales);
        Assert.Equal(21.75m, summary.GrossSales);
        Assert.Equal(3.00m, summary.TaxTotal);
        Assert.Equal(13.25m, summary.CostOfGoodsSold);
        Assert.Equal(5.50m, summary.GrossMargin);
        Assert.Equal(29.33m, summary.GrossMarginPercentage);
        Assert.Equal(2, summary.TotalSalesCount);
        Assert.Equal(10.88m, summary.AverageTicket);
    }

    [Fact]
    public async Task Dashboard_Excludes_VoidedSales_FromFinancialMetrics()
    {
        var (db, saleService, reportService) = CreateServices(nameof(Dashboard_Excludes_VoidedSales_FromFinancialMetrics));

        // Sale 1: Completed
        var sale1 = await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductHarinaId, 2.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 5.00m,
            PaymentReference: null
        ), TestCashier1UserId, isAdmin: true);

        // Sale 2: Created then Voided
        var sale2 = await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductArrozId, 10.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 20.00m,
            PaymentReference: null
        ), TestCashier1UserId, isAdmin: true);

        await saleService.VoidSaleAsync(sale2.Id, new VoidSaleRequest("Cliente devolvió mercancía"), TestAdminUserId);

        var summary = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams());

        // Only Sale 1 should be reflected (2 units of Harina @ 1.20 = 2.40 net, 0.38 tax, 2.78 gross, CMV = 2 * 0.85 = 1.70)
        Assert.Equal(1, summary.TotalSalesCount);
        Assert.Equal(2.40m, summary.NetSales);
        Assert.Equal(2.78m, summary.GrossSales);
        Assert.Equal(1.70m, summary.CostOfGoodsSold);
        Assert.Equal(0.70m, summary.GrossMargin);
    }

    [Fact]
    public async Task Dashboard_Calculates_InventoryValuation_And_LowStockAlerts()
    {
        var (db, _, reportService) = CreateServices(nameof(Dashboard_Calculates_InventoryValuation_And_LowStockAlerts));

        // Seed products:
        // Harina: 120 * 0.90 = 108.00 (min 20)
        // Arroz: 80 * 1.10 = 88.00 (min 15)
        // Leche: 40 * 1.60 = 64.00 (min 10)
        // Expected Valuation = 108 + 88 + 64 = 260.00
        var activeProducts = await db.Products
            .Where(p => p.IsActive)
            .Select(p => new { p.StockQuantity, p.AverageCost })
            .ToListAsync();
        var expectedValuation = activeProducts.Sum(p => p.StockQuantity * p.AverageCost);

        var summary = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams());

        Assert.Equal(expectedValuation, summary.InventoryValuation);

        // Create a product with low stock
        var lowStockProduct = new Product
        {
            Id = Guid.NewGuid(),
            Sku = "LOW-001",
            Name = "Producto Escaso",
            BaseUnit = "und",
            CategoryId = DatabaseSeeder.CategoryViveresId,
            SalePrice = 5.0m,
            AverageCost = 3.0m,
            StockQuantity = 2.0m,
            MinimumStock = 5.0m,
            IsActive = true
        };
        db.Products.Add(lowStockProduct);
        await db.SaveChangesAsync();

        var updatedSummary = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams());
        Assert.True(updatedSummary.LowStockAlertsCount >= 1);
        Assert.Contains(updatedSummary.LowStockAlerts, a => a.Sku == "LOW-001");
    }

    [Fact]
    public async Task Dashboard_Filters_ByDateRange()
    {
        var (db, saleService, reportService) = CreateServices(nameof(Dashboard_Filters_ByDateRange));

        var sale = await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductHarinaId, 1.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 5.00m,
            PaymentReference: null
        ), TestCashier1UserId, isAdmin: true);

        // Date in future should return 0 sales
        var futureFilter = new DashboardQueryParams(
            StartDate: DateTime.UtcNow.AddDays(1),
            EndDate: DateTime.UtcNow.AddDays(2)
        );
        var futureSummary = await reportService.GetDashboardSummaryAsync(futureFilter);
        Assert.Equal(0, futureSummary.TotalSalesCount);
        Assert.Equal(0m, futureSummary.NetSales);

        // Current range should include the sale
        var validFilter = new DashboardQueryParams(
            StartDate: DateTime.UtcNow.AddHours(-1),
            EndDate: DateTime.UtcNow.AddHours(1)
        );
        var validSummary = await reportService.GetDashboardSummaryAsync(validFilter);
        Assert.Equal(1, validSummary.TotalSalesCount);
    }

    [Fact]
    public async Task Dashboard_Filters_ByCashier()
    {
        var (db, saleService, reportService) = CreateServices(nameof(Dashboard_Filters_ByCashier));

        // Sale by Cashier 1
        await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductHarinaId, 2.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        ), TestCashier1UserId, isAdmin: true);

        // Sale by Cashier 2
        await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductArrozId, 3.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        ), TestCashier2UserId, isAdmin: true);

        // Filter Cashier 1 only
        var summaryCashier1 = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams(CashierId: TestCashier1UserId));
        Assert.Equal(1, summaryCashier1.TotalSalesCount);
        Assert.Equal(2.40m, summaryCashier1.NetSales);

        // Filter Cashier 2 only
        var summaryCashier2 = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams(CashierId: TestCashier2UserId));
        Assert.Equal(1, summaryCashier2.TotalSalesCount);
        Assert.Equal(4.05m, summaryCashier2.NetSales);
    }

    [Fact]
    public async Task Dashboard_Calculates_TopSellingProducts_And_PaymentMethodsBreakdown()
    {
        var (db, saleService, reportService) = CreateServices(nameof(Dashboard_Calculates_TopSellingProducts_And_PaymentMethodsBreakdown));

        // 5 Harina with Cash
        await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductHarinaId, 5.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        ), TestCashier1UserId, isAdmin: true);

        // 2 Arroz with Card
        await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(DatabaseSeeder.ProductArrozId, 2.0m) },
            PaymentMethod: PaymentMethod.Card,
            PaymentAmount: 5.00m,
            PaymentReference: "POS-9988"
        ), TestCashier1UserId, isAdmin: true);

        var summary = await reportService.GetDashboardSummaryAsync(new DashboardQueryParams());

        Assert.NotEmpty(summary.TopSellingProducts);
        var topProduct = summary.TopSellingProducts.First();
        Assert.Equal("Harina de Maíz Blanco 1kg", topProduct.ProductName);
        Assert.Equal(5.0m, topProduct.UnitsSold);

        Assert.Equal(2, summary.SalesByPaymentMethod.Count);
        Assert.Contains(summary.SalesByPaymentMethod, pm => pm.PaymentMethod == "Cash");
        Assert.Contains(summary.SalesByPaymentMethod, pm => pm.PaymentMethod == "Card");
    }

    [Fact]
    public void ReportsController_Enforces_AdminOnly_Denies_Cashier_With_403Forbidden()
    {
        var controllerType = typeof(ReportsController);

        var authAttr = controllerType.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authAttr);
        Assert.Equal("Admin", authAttr.Roles);
    }
}
