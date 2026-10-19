using Kanasta.Domain.Enums;

namespace Kanasta.Application.Sales;

public record SaleDto(
    Guid Id,
    string SaleNumber,
    Guid CashierId,
    string CashierName,
    string Status,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal Total,
    string CurrencyCode,
    DateTime? CompletedAt,
    DateTime? VoidedAt,
    string? VoidReason,
    DateTime CreatedAt,
    int ItemCount,
    string PaymentMethod,
    decimal PaymentAmount,
    string? PaymentReference
);

public record SaleItemDto(
    Guid Id,
    Guid ProductId,
    string SkuSnapshot,
    string ProductNameSnapshot,
    string UnitSnapshot,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal TaxRateSnapshot,
    decimal TaxAmount,
    decimal LineTotal,
    decimal? UnitCostSnapshot // Nullable for Cashier role privacy
);

public record PaymentDto(
    Guid Id,
    string PaymentMethod,
    decimal Amount,
    string? Reference,
    DateTime PaidAt,
    string ReceivedByName
);

public record ReceiptDto(
    Guid Id,
    string DocumentNumber,
    string DocumentType,
    string BusinessSnapshot,
    DateTime IssuedAt,
    string DocumentStatus
);

public record SaleDetailDto(
    Guid Id,
    string SaleNumber,
    Guid CashierId,
    string CashierName,
    string Status,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal Total,
    string CurrencyCode,
    DateTime? CompletedAt,
    DateTime? VoidedAt,
    string? VoidReason,
    DateTime CreatedAt,
    IReadOnlyList<SaleItemDto> Items,
    PaymentDto? Payment,
    ReceiptDto? Receipt
);

public record CreateSaleItemRequest(
    Guid ProductId,
    decimal Quantity
);

public record CreateSaleRequest(
    IReadOnlyList<CreateSaleItemRequest> Items,
    PaymentMethod PaymentMethod,
    decimal PaymentAmount,
    string? PaymentReference,
    decimal DiscountTotal = 0m
);

public record VoidSaleRequest(
    string Reason
);

public record SaleQueryParams(
    Guid? CashierId = null,
    SaleStatus? Status = null,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    int Page = 1,
    int PageSize = 10
);
