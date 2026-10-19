using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kanasta.Tests;

public class ModelIntegrityTests
{
    private KanastaDbContext CreateInMemoryContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<KanastaDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        return new KanastaDbContext(options);
    }

    [Fact]
    public void DbContext_ContainsAllFifteenConfiguredEntities()
    {
        using var context = CreateInMemoryContext(nameof(DbContext_ContainsAllFifteenConfiguredEntities));
        var entityTypes = context.Model.GetEntityTypes().Select(t => t.ClrType.Name).ToList();

        var expectedEntities = new[]
        {
            nameof(BusinessSettings),
            nameof(User),
            nameof(UserSession),
            nameof(Category),
            nameof(Product),
            nameof(TaxRate),
            nameof(Supplier),
            nameof(Purchase),
            nameof(PurchaseItem),
            nameof(StockMovement),
            nameof(Sale),
            nameof(SaleItem),
            nameof(Payment),
            nameof(Receipt),
            nameof(AuditLog)
        };

        foreach (var expected in expectedEntities)
        {
            Assert.Contains(expected, entityTypes);
        }
    }

    [Fact]
    public void ProductModel_HasRequiredDecimalPrecisionsAndIndexes()
    {
        using var context = CreateInMemoryContext(nameof(ProductModel_HasRequiredDecimalPrecisionsAndIndexes));
        var productType = context.Model.FindEntityType(typeof(Product));
        Assert.NotNull(productType);

        // Check Table Name
        Assert.Equal("products", productType.GetTableName());

        // Check Decimal Precisions
        var salePrice = productType.FindProperty(nameof(Product.SalePrice));
        Assert.NotNull(salePrice);
        Assert.Equal(14, salePrice.GetPrecision());
        Assert.Equal(4, salePrice.GetScale());

        var stockQuantity = productType.FindProperty(nameof(Product.StockQuantity));
        Assert.NotNull(stockQuantity);
        Assert.Equal(14, stockQuantity.GetPrecision());
        Assert.Equal(4, stockQuantity.GetScale());

        var averageCost = productType.FindProperty(nameof(Product.AverageCost));
        Assert.NotNull(averageCost);
        Assert.Equal(14, averageCost.GetPrecision());
        Assert.Equal(4, averageCost.GetScale());

        // Check Indexes
        var indexes = productType.GetIndexes().ToList();
        var skuIndex = indexes.FirstOrDefault(i => i.Properties.Any(p => p.Name == nameof(Product.Sku)));
        Assert.NotNull(skuIndex);
        Assert.True(skuIndex.IsUnique);
    }

    [Fact]
    public void SaleAndReceipt_HaveOneToOneUniqueRelationship()
    {
        using var context = CreateInMemoryContext(nameof(SaleAndReceipt_HaveOneToOneUniqueRelationship));
        var receiptType = context.Model.FindEntityType(typeof(Receipt));
        Assert.NotNull(receiptType);

        var saleIdIndex = receiptType.GetIndexes()
            .FirstOrDefault(i => i.Properties.Any(p => p.Name == nameof(Receipt.SaleId)));

        Assert.NotNull(saleIdIndex);
        Assert.True(saleIdIndex.IsUnique);
    }

    [Fact]
    public void DatabaseSeeder_LoadsSampleCatalogSuccessfully()
    {
        using var context = CreateInMemoryContext(nameof(DatabaseSeeder_LoadsSampleCatalogSuccessfully));

        DatabaseSeeder.Seed(context);

        // Verify Business Settings
        var business = context.BusinessSettings.FirstOrDefault();
        Assert.NotNull(business);
        Assert.Equal("USD", business.CurrencyCode);
        Assert.Equal("America/Caracas", business.Timezone);

        // Verify Tax Rate
        var taxRate = context.TaxRates.FirstOrDefault();
        Assert.NotNull(taxRate);
        Assert.Equal(0.1600m, taxRate.Rate);

        // Verify Categories
        Assert.Equal(2, context.Categories.Count());

        // Verify Products
        var products = context.Products.Include(p => p.Category).Include(p => p.TaxRate).ToList();
        Assert.Equal(3, products.Count);

        foreach (var product in products)
        {
            Assert.True(product.SalePrice > 0m, $"SalePrice for {product.Name} must be positive");
            Assert.True(product.AverageCost > 0m, $"AverageCost for {product.Name} must be positive");
            Assert.True(product.StockQuantity > 0m, $"StockQuantity for {product.Name} must be positive");
            Assert.NotNull(product.Category);
            Assert.NotNull(product.TaxRate);
        }

        // Verify Supplier
        var supplier = context.Suppliers.FirstOrDefault();
        Assert.NotNull(supplier);
        Assert.Equal("Distribuidora Nacional de Alimentos C.A.", supplier.Name);
    }

    [Fact]
    public void FinancialRules_VerifyNonNegativeSaleItemAndPayment()
    {
        using var context = CreateInMemoryContext(nameof(FinancialRules_VerifyNonNegativeSaleItemAndPayment));

        var sale = new Sale
        {
            Id = Guid.NewGuid(),
            SaleNumber = "VENTA-2026-000001",
            CashierId = Guid.NewGuid(),
            Status = SaleStatus.Completed,
            Subtotal = 10.00m,
            TaxTotal = 1.60m,
            Total = 11.60m,
            CurrencyCode = "USD"
        };

        var saleItem = new SaleItem
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            ProductId = Guid.NewGuid(),
            SkuSnapshot = "SKU-TEST-01",
            ProductNameSnapshot = "Producto Test",
            UnitSnapshot = "unidad",
            Quantity = 2m,
            UnitPrice = 5.00m,
            DiscountAmount = 0m,
            TaxRateSnapshot = 0.16m,
            TaxAmount = 1.60m,
            LineTotal = 11.60m,
            UnitCostSnapshot = 3.50m
        };

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            SaleId = sale.Id,
            PaymentMethod = PaymentMethod.Cash,
            Amount = 11.60m,
            PaidAt = DateTime.UtcNow,
            ReceivedById = sale.CashierId
        };

        context.Sales.Add(sale);
        context.SaleItems.Add(saleItem);
        context.Payments.Add(payment);

        context.SaveChanges();

        var savedSale = context.Sales.Include(s => s.Items).Include(s => s.Payments).FirstOrDefault(s => s.Id == sale.Id);
        Assert.NotNull(savedSale);
        Assert.Single(savedSale.Items);
        Assert.Single(savedSale.Payments);
        Assert.Equal(11.60m, savedSale.Payments.First().Amount);
    }
}
