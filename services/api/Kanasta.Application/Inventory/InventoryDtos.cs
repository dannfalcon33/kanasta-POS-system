namespace Kanasta.Application.Inventory;

public record InventoryItemDto(
    Guid ProductId,
    string Sku,
    string? Barcode,
    string ProductName,
    string CategoryName,
    string BaseUnit,
    decimal StockQuantity,
    decimal? MinimumStock,
    decimal? AverageCost,
    decimal SalePrice,
    bool IsLowStock,
    bool IsActive
);

public record StockMovementDto(
    Guid Id,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string MovementType,
    decimal QuantityDelta,
    decimal QuantityAfter,
    decimal? UnitCostSnapshot,
    string? ReferenceType,
    Guid? ReferenceId,
    string? Reason,
    Guid CreatedById,
    string CreatedByName,
    DateTime CreatedAt
);

public record ManualAdjustmentRequest(
    Guid ProductId,
    decimal QuantityDelta,
    string Reason
);
