namespace Kanasta.Application.Purchases;

public record PurchaseItemDto(
    Guid Id,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string BaseUnit,
    decimal Quantity,
    decimal UnitCost,
    decimal TaxRateSnapshot,
    decimal LineSubtotal,
    decimal LineTax,
    decimal LineTotal
);

public record PurchaseDto(
    Guid Id,
    string PurchaseNumber,
    Guid SupplierId,
    string SupplierName,
    Guid CreatedById,
    string CreatedByName,
    string Status,
    DateTime PurchasedAt,
    DateTime? ReceivedAt,
    decimal Subtotal,
    decimal TaxTotal,
    decimal Total,
    string? Notes,
    IReadOnlyList<PurchaseItemDto> Items,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record PurchaseSummaryDto(
    Guid Id,
    string PurchaseNumber,
    Guid SupplierId,
    string SupplierName,
    string CreatedByName,
    string Status,
    DateTime PurchasedAt,
    DateTime? ReceivedAt,
    decimal Total,
    int ItemCount,
    DateTime CreatedAt
);

public record CreatePurchaseItemRequest(
    Guid ProductId,
    decimal Quantity,
    decimal UnitCost,
    decimal TaxRateSnapshot = 0m
);

public record CreatePurchaseRequest(
    Guid SupplierId,
    string? PurchaseNumber,
    DateTime? PurchasedAt,
    string? Notes,
    IReadOnlyList<CreatePurchaseItemRequest> Items
);
