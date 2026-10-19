using System.Reflection;
using System.Security.Claims;
using Kanasta.Api.Controllers;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Infrastructure.Persistence;
using Kanasta.Infrastructure.Persistence.Seed;
using Kanasta.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kanasta.Tests;

public class CatalogTests
{
    private (KanastaDbContext db, ICategoryService categoryService, IProductService productService, ITaxRateService taxRateService) CreateServices(string dbName)
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
            db.SaveChanges();
        }

        var categoryService = new CategoryService(db);
        var productService = new ProductService(db);
        var taxRateService = new TaxRateService(db);

        return (db, categoryService, productService, taxRateService);
    }

    [Fact]
    public async Task Category_Create_Succeeds_AndDuplicateName_FailsWithConflict()
    {
        var (_, categoryService, _, _) = CreateServices(nameof(Category_Create_Succeeds_AndDuplicateName_FailsWithConflict));

        var created = await categoryService.CreateCategoryAsync(new CreateCategoryRequest("Bebidas y Jugos", "Refrescos y jugos pasteurizados"));

        Assert.NotNull(created);
        Assert.Equal("Bebidas y Jugos", created.Name);
        Assert.True(created.IsActive);

        // Duplicate name (case-insensitive) should throw ConflictException
        await Assert.ThrowsAsync<ConflictException>(() =>
            categoryService.CreateCategoryAsync(new CreateCategoryRequest("bebidas y jugos", "Otra descripcion")));
    }

    [Fact]
    public async Task Category_Update_And_StatusToggle_Succeeds()
    {
        var (_, categoryService, _, _) = CreateServices(nameof(Category_Update_And_StatusToggle_Succeeds));

        var created = await categoryService.CreateCategoryAsync(new CreateCategoryRequest("Snacks", "Golosinas"));
        
        var updated = await categoryService.UpdateCategoryAsync(created.Id, new UpdateCategoryRequest("Snacks y Dulces", "Snacks salados y dulces"));
        Assert.Equal("Snacks y Dulces", updated.Name);

        var deactivated = await categoryService.UpdateCategoryStatusAsync(created.Id, false);
        Assert.False(deactivated.IsActive);
    }

    [Fact]
    public async Task Product_Create_Succeeds_WithValidCategoryAndTaxRate()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Create_Succeeds_WithValidCategoryAndTaxRate));

        var request = new CreateProductRequest(
            Sku: "BEB-AGU-001",
            Barcode: "7591000999001",
            Name: "Agua Mineral 500ml",
            Description: "Agua purificada sin gas",
            CategoryId: DatabaseSeeder.CategoryViveresId,
            BaseUnit: "unidad",
            SalePrice: 0.75m,
            AverageCost: 0.40m,
            MinimumStock: 24m,
            TaxRateId: DatabaseSeeder.TaxRateGeneralId
        );

        var product = await productService.CreateProductAsync(request);

        Assert.NotNull(product);
        Assert.Equal("BEB-AGU-001", product.Sku);
        Assert.Equal("7591000999001", product.Barcode);
        Assert.Equal(0.75m, product.SalePrice);
        Assert.Equal(0.40m, product.AverageCost);
        Assert.Equal("Víveres", product.CategoryName);
        Assert.Equal(0.1600m, product.TaxRate);
        Assert.True(product.IsActive);
    }

    [Fact]
    public async Task Product_Create_DuplicateSku_FailsWithConflict()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Create_DuplicateSku_FailsWithConflict));

        // Existing SKU from seed: VIV-ARR-001
        var request = new CreateProductRequest(
            Sku: "VIV-ARR-001",
            Barcode: "9999999999999",
            Name: "Arroz Copia",
            Description: null,
            CategoryId: DatabaseSeeder.CategoryViveresId,
            BaseUnit: "kg",
            SalePrice: 1.50m,
            AverageCost: 1.00m,
            MinimumStock: 10m,
            TaxRateId: null
        );

        await Assert.ThrowsAsync<ConflictException>(() => productService.CreateProductAsync(request));
    }

    [Fact]
    public async Task Product_Create_DuplicateBarcode_FailsWithConflict()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Create_DuplicateBarcode_FailsWithConflict));

        // Existing Barcode from seed: 7591000111222
        var request = new CreateProductRequest(
            Sku: "NUEVO-SKU-999",
            Barcode: "7591000111222",
            Name: "Producto con Barcode duplicado",
            Description: null,
            CategoryId: DatabaseSeeder.CategoryViveresId,
            BaseUnit: "unidad",
            SalePrice: 2.00m,
            AverageCost: 1.00m,
            MinimumStock: 5m,
            TaxRateId: null
        );

        await Assert.ThrowsAsync<ConflictException>(() => productService.CreateProductAsync(request));
    }

    [Fact]
    public async Task Product_Create_NegativePrices_FailsWithBusinessRule()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Create_NegativePrices_FailsWithBusinessRule));

        var requestNegativeSale = new CreateProductRequest(
            Sku: "TEST-NEG-001",
            Barcode: null,
            Name: "Precio Negativo",
            Description: null,
            CategoryId: DatabaseSeeder.CategoryViveresId,
            BaseUnit: "unidad",
            SalePrice: -1.50m,
            AverageCost: 1.00m,
            MinimumStock: 0m,
            TaxRateId: null
        );

        await Assert.ThrowsAsync<BusinessRuleException>(() => productService.CreateProductAsync(requestNegativeSale));

        var requestNegativeCost = new CreateProductRequest(
            Sku: "TEST-NEG-002",
            Barcode: null,
            Name: "Costo Negativo",
            Description: null,
            CategoryId: DatabaseSeeder.CategoryViveresId,
            BaseUnit: "unidad",
            SalePrice: 2.50m,
            AverageCost: -0.50m,
            MinimumStock: 0m,
            TaxRateId: null
        );

        await Assert.ThrowsAsync<BusinessRuleException>(() => productService.CreateProductAsync(requestNegativeCost));
    }

    [Fact]
    public async Task Product_Query_FiltersBySearchAndCategory_WithPagination()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Query_FiltersBySearchAndCategory_WithPagination));

        // Search by SKU substring
        var resultSku = await productService.GetProductsAsync(new ProductQueryParams(Search: "HAR-002"), canViewCosts: true);
        Assert.Single(resultSku.Items);
        Assert.Equal("VIV-HAR-002", resultSku.Items[0].Sku);

        // Search by name substring
        var resultName = await productService.GetProductsAsync(new ProductQueryParams(Search: "Leche"), canViewCosts: true);
        Assert.Single(resultName.Items);
        Assert.Equal("Leche Entera Larga Vida 1L", resultName.Items[0].Name);

        // Filter by category
        var resultCat = await productService.GetProductsAsync(new ProductQueryParams(CategoryId: DatabaseSeeder.CategoryViveresId), canViewCosts: true);
        Assert.Equal(2, resultCat.Items.Count);

        // Pagination test
        var pagedResult = await productService.GetProductsAsync(new ProductQueryParams(Page: 1, PageSize: 2), canViewCosts: true);
        Assert.Equal(2, pagedResult.Items.Count);
        Assert.Equal(3, pagedResult.TotalCount);
        Assert.Equal(2, pagedResult.TotalPages);
        Assert.True(pagedResult.HasNextPage);
    }

    [Fact]
    public async Task Product_Query_CashierCannotViewCosts_AverageCostIsNull()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Query_CashierCannotViewCosts_AverageCostIsNull));

        // When canViewCosts is false (Cashier role)
        var result = await productService.GetProductsAsync(new ProductQueryParams(), canViewCosts: false);

        Assert.NotEmpty(result.Items);
        foreach (var item in result.Items)
        {
            Assert.Null(item.AverageCost);
        }

        // Also test GetById
        var singleProduct = await productService.GetProductByIdAsync(DatabaseSeeder.ProductArrozId, canViewCosts: false);
        Assert.Null(singleProduct.AverageCost);

        // Also test GetByBarcode
        var byBarcode = await productService.GetProductByBarcodeAsync("7591000111222", canViewCosts: false);
        Assert.Null(byBarcode.AverageCost);
    }

    [Fact]
    public async Task Product_Query_AdminCanViewCosts_AverageCostIsReturned()
    {
        var (_, _, productService, _) = CreateServices(nameof(Product_Query_AdminCanViewCosts_AverageCostIsReturned));

        // When canViewCosts is true (Admin role)
        var result = await productService.GetProductsAsync(new ProductQueryParams(), canViewCosts: true);

        Assert.NotEmpty(result.Items);
        var arroz = result.Items.First(p => p.Id == DatabaseSeeder.ProductArrozId);
        Assert.NotNull(arroz.AverageCost);
        Assert.Equal(0.9500m, arroz.AverageCost.Value);
    }

    [Fact]
    public void ProductsController_And_CategoriesController_HaveStrictAdminRoleDecorations()
    {
        // Verify CategoriesController modification endpoints have [Authorize(Roles = "Admin")]
        var catType = typeof(CategoriesController);

        var createCatMethod = catType.GetMethod(nameof(CategoriesController.Create));
        Assert.NotNull(createCatMethod);
        var createCatAuth = createCatMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(createCatAuth);
        Assert.Equal("Admin", createCatAuth.Roles);

        var updateCatMethod = catType.GetMethod(nameof(CategoriesController.Update));
        Assert.NotNull(updateCatMethod);
        var updateCatAuth = updateCatMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateCatAuth);
        Assert.Equal("Admin", updateCatAuth.Roles);

        var updateCatStatusMethod = catType.GetMethod(nameof(CategoriesController.UpdateStatus));
        Assert.NotNull(updateCatStatusMethod);
        var updateCatStatusAuth = updateCatStatusMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateCatStatusAuth);
        Assert.Equal("Admin", updateCatStatusAuth.Roles);

        // Verify ProductsController modification endpoints have [Authorize(Roles = "Admin")]
        var prodType = typeof(ProductsController);

        var createProdMethod = prodType.GetMethod(nameof(ProductsController.Create));
        Assert.NotNull(createProdMethod);
        var createProdAuth = createProdMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(createProdAuth);
        Assert.Equal("Admin", createProdAuth.Roles);

        var updateProdMethod = prodType.GetMethod(nameof(ProductsController.Update));
        Assert.NotNull(updateProdMethod);
        var updateProdAuth = updateProdMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateProdAuth);
        Assert.Equal("Admin", updateProdAuth.Roles);

        var updateProdStatusMethod = prodType.GetMethod(nameof(ProductsController.UpdateStatus));
        Assert.NotNull(updateProdStatusMethod);
        var updateProdStatusAuth = updateProdStatusMethod.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateProdStatusAuth);
        Assert.Equal("Admin", updateProdStatusAuth.Roles);
    }

    [Fact]
    public async Task ProductsController_GetAll_MasksCostsWhenCallerIsCashier()
    {
        var (_, _, productService, _) = CreateServices(nameof(ProductsController_GetAll_MasksCostsWhenCallerIsCashier));

        var controller = new ProductsController(productService);

        // Simulate Cashier ClaimsPrincipal
        var cashierIdentity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Role, "Cashier")
        }, "TestAuth");

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(cashierIdentity) }
        };

        var response = await controller.GetAll(new ProductQueryParams());
        var okResult = Assert.IsType<OkObjectResult>(response.Result);
        var pagedResult = Assert.IsType<Kanasta.Application.Common.PagedResult<ProductDto>>(okResult.Value);

        Assert.NotEmpty(pagedResult.Items);
        foreach (var item in pagedResult.Items)
        {
            Assert.Null(item.AverageCost);
        }
    }
}
