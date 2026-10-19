namespace Kanasta.Application.Catalog;

public record ProductDto(
    Guid Id,
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    Guid CategoryId,
    string CategoryName,
    string BaseUnit,
    decimal SalePrice,
    decimal? AverageCost,
    decimal StockQuantity,
    decimal? MinimumStock,
    Guid? TaxRateId,
    string? TaxRateName,
    decimal? TaxRate,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateProductRequest(
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    Guid CategoryId,
    string BaseUnit,
    decimal SalePrice,
    decimal? AverageCost,
    decimal? MinimumStock,
    Guid? TaxRateId,
    decimal? InitialStock = null
);

public record UpdateProductRequest(
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    Guid CategoryId,
    string BaseUnit,
    decimal SalePrice,
    decimal? AverageCost,
    decimal? MinimumStock,
    Guid? TaxRateId,
    decimal? StockQuantity = null,
    string? StockAdjustmentReason = null
);

public record UpdateProductStatusRequest(
    bool IsActive
);

public record ProductQueryParams(
    string? Search = null,
    Guid? CategoryId = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 20
);
