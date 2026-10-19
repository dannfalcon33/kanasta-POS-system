using System.Reflection;
using System.Security.Claims;
using Kanasta.Api.Controllers;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Inventory;
using Kanasta.Application.Purchases;
using Kanasta.Application.Suppliers;
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

public class InventoryAndPurchaseTests
{
    private static readonly Guid TestAdminUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TestSupplierId = DatabaseSeeder.SupplierPrincipalId;

    private (KanastaDbContext db, ISupplierService supplierService, IPurchaseService purchaseService, IInventoryService inventoryService) CreateServices(string dbName)
    {
        var options = new DbContextOptionsBuilder<KanastaDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;

        var db = new KanastaDbContext(options);

        // Preload baseline seed data
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

            db.SaveChanges();
        }

        var supplierService = new SupplierService(db);
        var purchaseService = new PurchaseService(db);
        var inventoryService = new InventoryService(db);

        return (db, supplierService, purchaseService, inventoryService);
    }

    [Fact]
    public async Task Supplier_Create_Succeeds_AndDuplicateName_FailsWithConflict()
    {
        var (_, supplierService, _, _) = CreateServices(nameof(Supplier_Create_Succeeds_AndDuplicateName_FailsWithConflict));

        var request = new CreateSupplierRequest("Distribuidora El Sol C.A.", "J-40506070-1", "+58 212 9998877", "ventas@elsol.com", "Av. Francisco de Miranda");
        var supplier = await supplierService.CreateSupplierAsync(request);

        Assert.NotNull(supplier);
        Assert.Equal("Distribuidora El Sol C.A.", supplier.Name);
        Assert.True(supplier.IsActive);

        // Duplicate name (case-insensitive) should throw ConflictException
        await Assert.ThrowsAsync<ConflictException>(() =>
            supplierService.CreateSupplierAsync(new CreateSupplierRequest("distribuidora el sol c.a.", null, null, null, null)));
    }

    [Fact]
    public async Task Supplier_Update_And_StatusToggle_Succeeds()
    {
        var (_, supplierService, _, _) = CreateServices(nameof(Supplier_Update_And_StatusToggle_Succeeds));

        var created = await supplierService.CreateSupplierAsync(new CreateSupplierRequest("Mayorista Los Andes", null, null, null, null));
        var updated = await supplierService.UpdateSupplierAsync(created.Id, new UpdateSupplierRequest("Mayorista Los Andes C.A.", "J-11223344-5", "0414-1112233", null, null));

        Assert.Equal("Mayorista Los Andes C.A.", updated.Name);

        var deactivated = await supplierService.UpdateSupplierStatusAsync(created.Id, false);
        Assert.False(deactivated.IsActive);
    }

    [Fact]
    public async Task Purchase_Create_Draft_DoesNotAlterStockOrCosts()
    {
        var (db, _, purchaseService, _) = CreateServices(nameof(Purchase_Create_Draft_DoesNotAlterStockOrCosts));

        var productBefore = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        var initialStock = productBefore.StockQuantity;
        var initialCost = productBefore.AverageCost;

        var request = new CreatePurchaseRequest(
            SupplierId: TestSupplierId,
            PurchaseNumber: "PUR-20261017-TEST1",
            PurchasedAt: DateTime.UtcNow,
            Notes: "Compra en borrador",
            Items: new List<CreatePurchaseItemRequest>
            {
                new(DatabaseSeeder.ProductArrozId, Quantity: 50m, UnitCost: 1.10m, TaxRateSnapshot: 0.16m)
            }
        );

        var purchase = await purchaseService.CreatePurchaseAsync(request, TestAdminUserId);

        Assert.NotNull(purchase);
        Assert.Equal("Draft", purchase.Status);
        Assert.Equal(55.00m, purchase.Subtotal); // 50 * 1.10
        Assert.Equal(8.80m, purchase.TaxTotal); // 55 * 0.16
        Assert.Equal(63.80m, purchase.Total);

        // Verify stock and average cost are UNTOUCHED while in Draft
        var productAfter = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        Assert.Equal(initialStock, productAfter.StockQuantity);
        Assert.Equal(initialCost, productAfter.AverageCost);

        // No movements created yet
        var movements = await db.StockMovements.Where(m => m.ReferenceId == purchase.Id).ToListAsync();
        Assert.Empty(movements);
    }

    [Fact]
    public async Task Purchase_Receive_CalculatesWeightedAverageCost_IncrementsStock_AndCreatesMovements()
    {
        var (db, _, purchaseService, _) = CreateServices(nameof(Purchase_Receive_CalculatesWeightedAverageCost_IncrementsStock_AndCreatesMovements));

        // Create a dedicated product with known stock and cost
        // 100 units at 1.00 USD
        var testProduct = new Product
        {
            Id = Guid.NewGuid(),
            Sku = "TEST-CALC-001",
            Name = "Producto Prueba Costo",
            CategoryId = DatabaseSeeder.CategoryViveresId,
            BaseUnit = "kg",
            SalePrice = 2.00m,
            AverageCost = 1.0000m,
            StockQuantity = 100.0000m,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Products.Add(testProduct);
        await db.SaveChangesAsync();

        // Register a purchase of 50 units at 1.60 USD
        var request = new CreatePurchaseRequest(
            SupplierId: TestSupplierId,
            PurchaseNumber: "PUR-CALC-100",
            PurchasedAt: DateTime.UtcNow,
            Notes: "Prueba recálculo promedio ponderado",
            Items: new List<CreatePurchaseItemRequest>
            {
                new(testProduct.Id, Quantity: 50.0000m, UnitCost: 1.6000m, TaxRateSnapshot: 0m)
            }
        );

        var createdPurchase = await purchaseService.CreatePurchaseAsync(request, TestAdminUserId);

        // Receive the purchase
        var receivedPurchase = await purchaseService.ReceivePurchaseAsync(createdPurchase.Id, TestAdminUserId);

        Assert.Equal("Received", receivedPurchase.Status);
        Assert.NotNull(receivedPurchase.ReceivedAt);

        // Check product stock and weighted average cost
        // Old valuation = 100 * 1.00 = 100
        // New incoming = 50 * 1.60 = 80
        // Total valuation = 180
        // New stock = 150
        // Expected weighted cost = 180 / 150 = 1.2000 USD
        var updatedProduct = await db.Products.FirstAsync(p => p.Id == testProduct.Id);
        Assert.Equal(150.0000m, updatedProduct.StockQuantity);
        Assert.Equal(1.2000m, updatedProduct.AverageCost);

        // Verify StockMovement
        var movement = await db.StockMovements.FirstOrDefaultAsync(m => m.ReferenceId == createdPurchase.Id);
        Assert.NotNull(movement);
        Assert.Equal(StockMovementType.PurchaseIn, movement.MovementType);
        Assert.Equal(50.0000m, movement.QuantityDelta);
        Assert.Equal(150.0000m, movement.QuantityAfter);
        Assert.Equal(1.6000m, movement.UnitCostSnapshot);
        Assert.Equal("Purchase", movement.ReferenceType);
    }

    [Fact]
    public async Task Purchase_Receive_Idempotence_SecondCallThrowsBusinessRuleException()
    {
        var (_, _, purchaseService, _) = CreateServices(nameof(Purchase_Receive_Idempotence_SecondCallThrowsBusinessRuleException));

        var request = new CreatePurchaseRequest(
            SupplierId: TestSupplierId,
            PurchaseNumber: "PUR-IDEMPOTENT-001",
            PurchasedAt: DateTime.UtcNow,
            Notes: "Prueba idempotencia",
            Items: new List<CreatePurchaseItemRequest>
            {
                new(DatabaseSeeder.ProductHarinaId, Quantity: 10m, UnitCost: 0.90m, TaxRateSnapshot: 0m)
            }
        );

        var created = await purchaseService.CreatePurchaseAsync(request, TestAdminUserId);

        // First receive must succeed
        var firstReceive = await purchaseService.ReceivePurchaseAsync(created.Id, TestAdminUserId);
        Assert.Equal("Received", firstReceive.Status);

        // Second receive MUST throw BusinessRuleException and fail idempotently
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            purchaseService.ReceivePurchaseAsync(created.Id, TestAdminUserId));

        Assert.Contains("ya fue recibida", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Purchase_Cancel_SucceedsOnDraft_AndFailsOnReceived()
    {
        var (_, _, purchaseService, _) = CreateServices(nameof(Purchase_Cancel_SucceedsOnDraft_AndFailsOnReceived));

        var request = new CreatePurchaseRequest(
            SupplierId: TestSupplierId,
            PurchaseNumber: "PUR-CANCEL-001",
            PurchasedAt: DateTime.UtcNow,
            Notes: "Prueba cancel",
            Items: new List<CreatePurchaseItemRequest>
            {
                new(DatabaseSeeder.ProductLecheId, Quantity: 5m, UnitCost: 1.50m, TaxRateSnapshot: 0m)
            }
        );

        var created = await purchaseService.CreatePurchaseAsync(request, TestAdminUserId);
        var cancelled = await purchaseService.CancelPurchaseAsync(created.Id, TestAdminUserId, "Proveedor sin stock");
        Assert.Equal("Cancelled", cancelled.Status);

        // Cannot receive cancelled purchase
        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            purchaseService.ReceivePurchaseAsync(created.Id, TestAdminUserId));
    }

    [Fact]
    public async Task Inventory_ManualAdjustment_Positive_IncreasesStock_AndCreatesMovement()
    {
        var (db, _, _, inventoryService) = CreateServices(nameof(Inventory_ManualAdjustment_Positive_IncreasesStock_AndCreatesMovement));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        var stockBefore = product.StockQuantity;

        var adjustment = await inventoryService.CreateManualAdjustmentAsync(
            new ManualAdjustmentRequest(DatabaseSeeder.ProductArrozId, QuantityDelta: 12.5m, Reason: "Conteo físico de inventario de fin de mes"),
            TestAdminUserId
        );

        Assert.NotNull(adjustment);
        Assert.Equal("ManualIn", adjustment.MovementType);
        Assert.Equal(12.5m, adjustment.QuantityDelta);
        Assert.Equal(stockBefore + 12.5m, adjustment.QuantityAfter);
        Assert.Equal("Conteo físico de inventario de fin de mes", adjustment.Reason);

        var productAfter = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        Assert.Equal(stockBefore + 12.5m, productAfter.StockQuantity);
    }

    [Fact]
    public async Task Inventory_ManualAdjustment_Negative_FailsWhenResultingInNegativeStock()
    {
        var (db, _, _, inventoryService) = CreateServices(nameof(Inventory_ManualAdjustment_Negative_FailsWhenResultingInNegativeStock));

        var product = await db.Products.FirstAsync(p => p.Id == DatabaseSeeder.ProductArrozId);
        var currentStock = product.StockQuantity; // 150

        // Attempting to deduct 200 when stock is 150 must fail to prevent negative inventory
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            inventoryService.CreateManualAdjustmentAsync(
                new ManualAdjustmentRequest(DatabaseSeeder.ProductArrozId, QuantityDelta: -(currentStock + 50m), Reason: "Merma excesiva"),
                TestAdminUserId
            ));

        Assert.Contains("negativo", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Inventory_ManualAdjustment_WithoutReason_FailsWithBusinessRuleException()
    {
        var (_, _, _, inventoryService) = CreateServices(nameof(Inventory_ManualAdjustment_WithoutReason_FailsWithBusinessRuleException));

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            inventoryService.CreateManualAdjustmentAsync(
                new ManualAdjustmentRequest(DatabaseSeeder.ProductArrozId, QuantityDelta: 5m, Reason: "   "),
                TestAdminUserId
            ));
    }

    [Fact]
    public async Task Inventory_Query_CashierCannotViewCosts_AverageCostIsNull()
    {
        var (_, _, _, inventoryService) = CreateServices(nameof(Inventory_Query_CashierCannotViewCosts_AverageCostIsNull));

        var cashierResult = await inventoryService.GetInventoryAsync(canViewCosts: false);
        Assert.NotEmpty(cashierResult.Items);
        foreach (var item in cashierResult.Items)
        {
            Assert.Null(item.AverageCost);
        }

        var adminResult = await inventoryService.GetInventoryAsync(canViewCosts: true);
        Assert.NotEmpty(adminResult.Items);
        var arroz = adminResult.Items.First(i => i.ProductId == DatabaseSeeder.ProductArrozId);
        Assert.NotNull(arroz.AverageCost);
    }

    [Fact]
    public void PurchasesAndSuppliersControllers_HaveStrictAdminRoleDecorations()
    {
        // Verify SuppliersController is protected by [Authorize(Roles = "Admin")]
        var supplierAuth = typeof(SuppliersController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(supplierAuth);
        Assert.Equal("Admin", supplierAuth.Roles);

        // Verify PurchasesController is protected by [Authorize(Roles = "Admin")]
        var purchasesAuth = typeof(PurchasesController).GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(purchasesAuth);
        Assert.Equal("Admin", purchasesAuth.Roles);

        // Verify Inventory movements & adjustments require Admin
        var invType = typeof(InventoryController);
        var movementsAuth = invType.GetMethod(nameof(InventoryController.GetMovements))?.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(movementsAuth);
        Assert.Equal("Admin", movementsAuth.Roles);

        var adjustAuth = invType.GetMethod(nameof(InventoryController.CreateAdjustment))?.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(adjustAuth);
        Assert.Equal("Admin", adjustAuth.Roles);
    }
}
