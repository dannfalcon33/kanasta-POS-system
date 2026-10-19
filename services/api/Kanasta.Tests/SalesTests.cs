using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Kanasta.Api.Controllers;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Sales;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Persistence.Seed;
using Kanasta.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kanasta.Tests;

public class SalesTests
{
    private static readonly Guid TestAdminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TestCashierUserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private (KanastaDbContext db, ISaleService saleService) CreateServices(string dbName)
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
                FullName = "Admin Pruebas",
                Role = UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            db.Users.Add(new User
            {
                Id = TestCashierUserId,
                Email = "cajero1@kanasta.local",
                PasswordHash = "hash",
                FullName = "Cajero Uno",
                Role = UserRole.Cashier,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });

            db.SaveChanges();
        }

        var saleService = new SaleService(db);
        return (db, saleService);
    }

    [Fact]
    public async Task Sale_Create_Succeeds_AtomicallyDecrementsStock_AndCreatesAllEntities()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Create_Succeeds_AtomicallyDecrementsStock_AndCreatesAllEntities));

        var harina = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);
        var initialHarinaStock = harina.StockQuantity; // 120

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest>
            {
                new(DatabaseSeeder.ProductHarinaId, 5.0m)
            },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 20.00m,
            PaymentReference: null
        );

        var result = await saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: true);

        Assert.NotNull(result);
        Assert.Equal("Completed", result.Status);
        Assert.Single(result.Items);
        Assert.NotNull(result.Payment);
        Assert.NotNull(result.Receipt);

        // Verification of calculated line totals:
        // Harina price: 1.20 USD, tax: 16% -> lineSubtotal = 6.00, lineTax = 0.96, total = 6.96 USD
        Assert.Equal(6.00m, result.Subtotal);
        Assert.Equal(0.96m, result.TaxTotal);
        Assert.Equal(6.96m, result.Total);

        // Verify stock was decremented
        var updatedProduct = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);
        Assert.Equal(initialHarinaStock - 5.0m, updatedProduct.StockQuantity);

        // Verify StockMovement SALE_OUT was registered
        var movement = await db.StockMovements
            .FirstOrDefaultAsync(m => m.ReferenceId == result.Id && m.MovementType == StockMovementType.SaleOut);

        Assert.NotNull(movement);
        Assert.Equal(-5.0m, movement.QuantityDelta);
        Assert.Equal(updatedProduct.StockQuantity, movement.QuantityAfter);
        Assert.Equal(harina.AverageCost, movement.UnitCostSnapshot);
    }

    [Fact]
    public async Task Sale_Snapshots_AreImmutable_EvenIfProductPriceOrCostChangesLater()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Snapshots_AreImmutable_EvenIfProductPriceOrCostChangesLater));

        var initialProduct = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        var originalPrice = initialProduct.SalePrice;
        var originalCost = initialProduct.AverageCost;

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(initialProduct.Id, 2.0m) },
            PaymentMethod: PaymentMethod.Card,
            PaymentAmount: 50.00m,
            PaymentReference: "POS-REF-9988"
        );

        var sale = await saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: true);

        // Modify the product in catalog
        initialProduct.SalePrice = 99.99m;
        initialProduct.AverageCost = 77.77m;
        await db.SaveChangesAsync();

        // Retrieve historical sale detail
        var historicalSale = await saleService.GetSaleByIdAsync(sale.Id, isAdmin: true);
        var item = historicalSale.Items.Single();

        Assert.Equal(originalPrice, item.UnitPrice);
        Assert.Equal(originalCost, item.UnitCostSnapshot);
    }

    [Fact]
    public async Task Sale_Rejects_WhenRequestedQuantity_ExceedsAvailableStock_StrictZeroNegativeStock()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Rejects_WhenRequestedQuantity_ExceedsAvailableStock_StrictZeroNegativeStock));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductLecheId);
        var initialStock = product.StockQuantity; // 40

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest>
            {
                new(product.Id, initialStock + 10.0m) // Exceeds available stock
            },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 200.00m,
            PaymentReference: null
        );

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: false));

        Assert.Contains("Stock insuficiente", ex.Message);
        Assert.Contains("evitar saldo negativo", ex.Message);

        // Verify stock was untouched
        var unchangedProduct = await db.Products.FirstAsync(p => p.Id == product.Id);
        Assert.Equal(initialStock, unchangedProduct.StockQuantity);
    }

    [Fact]
    public async Task Sale_Rejects_WhenProductIsInactive()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Rejects_WhenProductIsInactive));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);
        product.IsActive = false;
        await db.SaveChangesAsync();

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 1.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        );

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: false));

        Assert.Contains("está inactivo", ex.Message);
    }

    [Fact]
    public async Task Sale_Rejects_WhenPaymentAmount_IsLessThanTotal()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Rejects_WhenPaymentAmount_IsLessThanTotal));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 10.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 0.50m, // Far less than total
            PaymentReference: null
        );

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: false));

        Assert.Contains("no cubre el total", ex.Message);
    }

    [Fact]
    public async Task Sale_CashierRole_MasksUnitCost_AdminRole_RevealsUnitCost()
    {
        var (db, saleService) = CreateServices(nameof(Sale_CashierRole_MasksUnitCost_AdminRole_RevealsUnitCost));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 2.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        );

        var cashierResult = await saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: false);
        Assert.Null(cashierResult.Items.First().UnitCostSnapshot);

        var adminView = await saleService.GetSaleByIdAsync(cashierResult.Id, isAdmin: true);
        Assert.NotNull(adminView.Items.First().UnitCostSnapshot);
        Assert.Equal(product.AverageCost, adminView.Items.First().UnitCostSnapshot);
    }

    [Fact]
    public async Task Sale_Receipt_IncludesNonFiscalDisclaimer_AndBusinessData()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Receipt_IncludesNonFiscalDisclaimer_AndBusinessData));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 1.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 10.00m,
            PaymentReference: null
        );

        var sale = await saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: true);
        Assert.NotNull(sale.Receipt);
        Assert.Equal("INTERNAL_TEST_RECEIPT", sale.Receipt.DocumentType);

        using var jsonDoc = JsonDocument.Parse(sale.Receipt.BusinessSnapshot);
        var root = jsonDoc.RootElement;

        Assert.True(root.TryGetProperty("Disclaimer", out var disclaimerProp));
        Assert.Contains("DOCUMENTO INTERNO DE PRUEBA - NO FISCAL", disclaimerProp.GetString()!);
        Assert.True(root.TryGetProperty("BusinessName", out _));
        Assert.True(root.TryGetProperty("Total", out var totalProp));
        Assert.Equal(sale.Total, totalProp.GetDecimal());
    }

    [Fact]
    public async Task Sale_Void_ByAdmin_RestoresStock_AndCreatesSaleReversalInMovement()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Void_ByAdmin_RestoresStock_AndCreatesSaleReversalInMovement));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);
        var initialStock = product.StockQuantity;

        var request = new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 5.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 20.00m,
            PaymentReference: null
        );

        var sale = await saleService.CreateSaleAsync(request, TestCashierUserId, isAdmin: true);

        // Verify stock decremented
        product = await db.Products.FirstAsync(p => p.Id == product.Id);
        Assert.Equal(initialStock - 5.0m, product.StockQuantity);

        // Void the sale
        var voidRequest = new VoidSaleRequest("Cliente devolvió productos y solicitó cancelación antes de retirarse");
        var voidedSale = await saleService.VoidSaleAsync(sale.Id, voidRequest, TestAdminUserId);

        Assert.Equal("Voided", voidedSale.Status);
        Assert.NotNull(voidedSale.VoidedAt);
        Assert.Equal(voidRequest.Reason, voidedSale.VoidReason);

        // Verify stock restored
        product = await db.Products.FirstAsync(p => p.Id == product.Id);
        Assert.Equal(initialStock, product.StockQuantity);

        // Verify SALE_REVERSAL_IN movement
        var reversalMovement = await db.StockMovements
            .FirstOrDefaultAsync(m => m.ReferenceId == sale.Id && m.MovementType == StockMovementType.SaleReversalIn);

        Assert.NotNull(reversalMovement);
        Assert.Equal(5.0m, reversalMovement.QuantityDelta);
        Assert.Equal(initialStock, reversalMovement.QuantityAfter);
    }

    [Fact]
    public async Task Sale_Void_Fails_WhenReasonIsEmpty()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Void_Fails_WhenReasonIsEmpty));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);

        var sale = await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 1.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 5.00m,
            PaymentReference: null
        ), TestCashierUserId, isAdmin: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            saleService.VoidSaleAsync(sale.Id, new VoidSaleRequest("   "), TestAdminUserId));

        Assert.Contains("motivo de la anulación es estrictamente obligatorio", ex.Message);
    }

    [Fact]
    public async Task Sale_Void_Fails_WhenAlreadyVoided()
    {
        var (db, saleService) = CreateServices(nameof(Sale_Void_Fails_WhenAlreadyVoided));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductHarinaId);

        var sale = await saleService.CreateSaleAsync(new CreateSaleRequest(
            Items: new List<CreateSaleItemRequest> { new(product.Id, 1.0m) },
            PaymentMethod: PaymentMethod.Cash,
            PaymentAmount: 5.00m,
            PaymentReference: null
        ), TestCashierUserId, isAdmin: true);

        await saleService.VoidSaleAsync(sale.Id, new VoidSaleRequest("Motivo válido 1"), TestAdminUserId);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            saleService.VoidSaleAsync(sale.Id, new VoidSaleRequest("Motivo válido 2"), TestAdminUserId));

        Assert.Contains("ya ha sido anulada anteriormente", ex.Message);
    }

    [Fact]
    public void SalesController_Authorization_Attributes_EnforceAdminOnlyOnVoid()
    {
        var controllerType = typeof(SalesController);

        var voidMethod = controllerType.GetMethod(nameof(SalesController.VoidSale));
        Assert.NotNull(voidMethod);

        var authAttr = voidMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authAttr);
        Assert.Equal("Admin", authAttr.Roles);

        var createMethod = controllerType.GetMethod(nameof(SalesController.CreateSale));
        Assert.NotNull(createMethod);
        var createAuthAttr = createMethod.GetCustomAttribute<AuthorizeAttribute>();
        // Controller itself has [Authorize], so createMethod does not restrict to Admin only
        Assert.Null(createAuthAttr);
    }
}
