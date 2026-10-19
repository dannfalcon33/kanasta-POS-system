using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Kanasta.Application.Common;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class ProductService : IProductService
{
    private readonly KanastaDbContext _db;

    public ProductService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<ProductDto>> GetProductsAsync(ProductQueryParams query, bool canViewCosts, CancellationToken ct = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 20 : Math.Min(query.PageSize, 100);

        var queryable = _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.TaxRate)
            .AsQueryable();

        if (query.IsActive.HasValue)
        {
            queryable = queryable.Where(p => p.IsActive == query.IsActive.Value);
        }

        if (query.CategoryId.HasValue && query.CategoryId.Value != Guid.Empty)
        {
            queryable = queryable.Where(p => p.CategoryId == query.CategoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();
            queryable = queryable.Where(p =>
                p.Name.ToLower().Contains(search) ||
                p.Sku.ToLower().Contains(search) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(search)));
        }

        var totalCount = await queryable.CountAsync(ct);

        var items = await queryable
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => MapToDto(p, canViewCosts))
            .ToListAsync(ct);

        return new PagedResult<ProductDto>(items, totalCount, page, pageSize);
    }

    public async Task<ProductDto> GetProductByIdAsync(Guid id, bool canViewCosts, CancellationToken ct = default)
    {
        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.TaxRate)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null)
        {
            throw new NotFoundException($"Producto con ID '{id}' no encontrado.");
        }

        return MapToDto(product, canViewCosts);
    }

    public async Task<ProductDto> GetProductByBarcodeAsync(string barcode, bool canViewCosts, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(barcode))
        {
            throw new BusinessRuleException("El código de barras es obligatorio.");
        }

        var normalized = barcode.Trim();

        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.TaxRate)
            .FirstOrDefaultAsync(p => p.Barcode == normalized, ct);

        if (product == null)
        {
            throw new NotFoundException($"No se encontró ningún producto con el código de barras '{normalized}'.");
        }

        return MapToDto(product, canViewCosts);
    }

    public async Task<ProductDto> GetProductBySkuAsync(string sku, bool canViewCosts, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(sku))
        {
            throw new BusinessRuleException("El código SKU es obligatorio.");
        }

        var normalized = sku.Trim().ToUpperInvariant();

        var product = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.TaxRate)
            .FirstOrDefaultAsync(p => p.Sku == normalized, ct);

        if (product == null)
        {
            throw new NotFoundException($"No se encontró ningún producto con el SKU '{normalized}'.");
        }

        return MapToDto(product, canViewCosts);
    }

    public async Task<ProductDto> CreateProductAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        await ValidateCreateRequestAsync(request, ct);

        var normalizedSku = request.Sku.Trim().ToUpperInvariant();
        var normalizedBarcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        var initialStock = request.InitialStock.HasValue && request.InitialStock.Value > 0 ? request.InitialStock.Value : 0m;

        var product = new Product
        {
            Id = Guid.NewGuid(),
            Sku = normalizedSku,
            Barcode = normalizedBarcode,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            CategoryId = request.CategoryId,
            BaseUnit = request.BaseUnit.Trim().ToLowerInvariant(),
            SalePrice = request.SalePrice,
            AverageCost = request.AverageCost ?? 0m,
            StockQuantity = initialStock,
            MinimumStock = request.MinimumStock,
            TaxRateId = request.TaxRateId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Products.Add(product);

        if (initialStock > 0)
        {
            var creatorUser = await _db.Users.FirstOrDefaultAsync(u => u.Role == Domain.Enums.UserRole.Admin, ct)
                           ?? await _db.Users.FirstOrDefaultAsync(ct);
            if (creatorUser != null)
            {
                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    MovementType = Domain.Enums.StockMovementType.ManualIn,
                    QuantityDelta = initialStock,
                    QuantityAfter = initialStock,
                    UnitCostSnapshot = product.AverageCost,
                    ReferenceType = "INITIAL_INVENTORY",
                    Reason = "Inventario inicial al registrar producto",
                    CreatedById = creatorUser.Id,
                    CreatedAt = DateTime.UtcNow
                };
                _db.StockMovements.Add(movement);
            }
        }

        await _db.SaveChangesAsync(ct);

        // Reload to include navigation references
        return await GetProductByIdAsync(product.Id, canViewCosts: true, ct);
    }

    public async Task<ProductDto> UpdateProductAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null)
        {
            throw new NotFoundException($"Producto con ID '{id}' no encontrado.");
        }

        await ValidateUpdateRequestAsync(id, request, ct);

        var normalizedSku = request.Sku.Trim().ToUpperInvariant();
        var normalizedBarcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();

        product.Sku = normalizedSku;
        product.Barcode = normalizedBarcode;
        product.Name = request.Name.Trim();
        product.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        product.CategoryId = request.CategoryId;
        product.BaseUnit = request.BaseUnit.Trim().ToLowerInvariant();
        product.SalePrice = request.SalePrice;
        if (request.AverageCost.HasValue)
        {
            product.AverageCost = request.AverageCost.Value;
        }
        product.MinimumStock = request.MinimumStock;
        product.TaxRateId = request.TaxRateId;
        product.UpdatedAt = DateTime.UtcNow;

        if (request.StockQuantity.HasValue && request.StockQuantity.Value != product.StockQuantity)
        {
            if (request.StockQuantity.Value < 0)
            {
                throw new BusinessRuleException("El stock no puede ser negativo.");
            }

            var delta = request.StockQuantity.Value - product.StockQuantity;
            var previousStock = product.StockQuantity;
            product.StockQuantity = request.StockQuantity.Value;

            var creatorUser = await _db.Users.FirstOrDefaultAsync(u => u.Role == Domain.Enums.UserRole.Admin, ct)
                           ?? await _db.Users.FirstOrDefaultAsync(ct);
            if (creatorUser != null)
            {
                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    MovementType = delta > 0 ? Domain.Enums.StockMovementType.ManualIn : Domain.Enums.StockMovementType.ManualOut,
                    QuantityDelta = delta,
                    QuantityAfter = request.StockQuantity.Value,
                    UnitCostSnapshot = product.AverageCost,
                    ReferenceType = "CATALOG_ADJUSTMENT",
                    Reason = !string.IsNullOrWhiteSpace(request.StockAdjustmentReason)
                        ? request.StockAdjustmentReason.Trim()
                        : $"Ajuste directo de existencias en catálogo (De {previousStock:G29} a {request.StockQuantity.Value:G29})",
                    CreatedById = creatorUser.Id,
                    CreatedAt = DateTime.UtcNow
                };
                _db.StockMovements.Add(movement);
            }
        }

        await _db.SaveChangesAsync(ct);

        return await GetProductByIdAsync(product.Id, canViewCosts: true, ct);
    }

    public async Task<ProductDto> UpdateProductStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var product = await _db.Products
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (product == null)
        {
            throw new NotFoundException($"Producto con ID '{id}' no encontrado.");
        }

        product.IsActive = isActive;
        product.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return await GetProductByIdAsync(product.Id, canViewCosts: true, ct);
    }

    private async Task ValidateCreateRequestAsync(CreateProductRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Sku))
        {
            throw new BusinessRuleException("El SKU es obligatorio.");
        }

        var normalizedSku = request.Sku.Trim().ToUpperInvariant();
        var skuExists = await _db.Products.AnyAsync(p => p.Sku == normalizedSku, ct);
        if (skuExists)
        {
            throw new ConflictException($"Ya existe un producto con el SKU '{normalizedSku}'.");
        }

        if (!string.IsNullOrWhiteSpace(request.Barcode))
        {
            var normalizedBarcode = request.Barcode.Trim();
            var barcodeExists = await _db.Products.AnyAsync(p => p.Barcode == normalizedBarcode, ct);
            if (barcodeExists)
            {
                throw new ConflictException($"Ya existe un producto con el código de barras '{normalizedBarcode}'.");
            }
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre del producto es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.BaseUnit))
        {
            throw new BusinessRuleException("La unidad de medida base es obligatoria (ej: unidad, kg, litro).");
        }

        if (request.SalePrice < 0)
        {
            throw new BusinessRuleException("El precio de venta no puede ser negativo.");
        }

        if (request.AverageCost.HasValue && request.AverageCost.Value < 0)
        {
            throw new BusinessRuleException("El costo promedio/referencia no puede ser negativo.");
        }

        if (request.MinimumStock.HasValue && request.MinimumStock.Value < 0)
        {
            throw new BusinessRuleException("El stock mínimo no puede ser negativo.");
        }

        var category = await _db.Categories.FindAsync(new object[] { request.CategoryId }, ct);
        if (category == null)
        {
            throw new NotFoundException($"La categoría con ID '{request.CategoryId}' no existe.");
        }

        if (!category.IsActive)
        {
            throw new BusinessRuleException("No se pueden asociar productos a una categoría inactiva.");
        }

        if (request.TaxRateId.HasValue)
        {
            var taxRate = await _db.TaxRates.FindAsync(new object[] { request.TaxRateId.Value }, ct);
            if (taxRate == null)
            {
                throw new NotFoundException($"La tasa de impuesto con ID '{request.TaxRateId}' no existe.");
            }
        }
    }

    private async Task ValidateUpdateRequestAsync(Guid currentId, UpdateProductRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Sku))
        {
            throw new BusinessRuleException("El SKU es obligatorio.");
        }

        var normalizedSku = request.Sku.Trim().ToUpperInvariant();
        var skuExists = await _db.Products.AnyAsync(p => p.Id != currentId && p.Sku == normalizedSku, ct);
        if (skuExists)
        {
            throw new ConflictException($"Ya existe otro producto con el SKU '{normalizedSku}'.");
        }

        if (!string.IsNullOrWhiteSpace(request.Barcode))
        {
            var normalizedBarcode = request.Barcode.Trim();
            var barcodeExists = await _db.Products.AnyAsync(p => p.Id != currentId && p.Barcode == normalizedBarcode, ct);
            if (barcodeExists)
            {
                throw new ConflictException($"Ya existe otro producto con el código de barras '{normalizedBarcode}'.");
            }
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre del producto es obligatorio.");
        }

        if (string.IsNullOrWhiteSpace(request.BaseUnit))
        {
            throw new BusinessRuleException("La unidad de medida base es obligatoria (ej: unidad, kg, litro).");
        }

        if (request.SalePrice < 0)
        {
            throw new BusinessRuleException("El precio de venta no puede ser negativo.");
        }

        if (request.AverageCost.HasValue && request.AverageCost.Value < 0)
        {
            throw new BusinessRuleException("El costo promedio/referencia no puede ser negativo.");
        }

        if (request.MinimumStock.HasValue && request.MinimumStock.Value < 0)
        {
            throw new BusinessRuleException("El stock mínimo no puede ser negativo.");
        }

        var category = await _db.Categories.FindAsync(new object[] { request.CategoryId }, ct);
        if (category == null)
        {
            throw new NotFoundException($"La categoría con ID '{request.CategoryId}' no existe.");
        }

        if (request.TaxRateId.HasValue)
        {
            var taxRate = await _db.TaxRates.FindAsync(new object[] { request.TaxRateId.Value }, ct);
            if (taxRate == null)
            {
                throw new NotFoundException($"La tasa de impuesto con ID '{request.TaxRateId}' no existe.");
            }
        }
    }

    private static ProductDto MapToDto(Product p, bool canViewCosts)
    {
        return new ProductDto(
            p.Id,
            p.Sku,
            p.Barcode,
            p.Name,
            p.Description,
            p.CategoryId,
            p.Category?.Name ?? string.Empty,
            p.BaseUnit,
            p.SalePrice,
            canViewCosts ? p.AverageCost : null,
            p.StockQuantity,
            p.MinimumStock,
            p.TaxRateId,
            p.TaxRate?.Name,
            p.TaxRate?.Rate,
            p.IsActive,
            p.CreatedAt,
            p.UpdatedAt
        );
    }
}
