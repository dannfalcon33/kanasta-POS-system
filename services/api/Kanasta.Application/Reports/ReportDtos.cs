namespace Kanasta.Application.Reports;

public record TopProductDto(
    Guid ProductId,
    string ProductName,
    string Sku,
    decimal UnitsSold,
    decimal Revenue,
    decimal CostOfGoodsSold,
    decimal GrossMargin,
    decimal GrossMarginPercentage
);

public record PaymentMethodBreakdownDto(
    string PaymentMethod,
    decimal TotalAmount,
    int TransactionCount,
    decimal Percentage
);

public record CashierBreakdownDto(
    Guid CashierId,
    string CashierName,
    decimal NetSales,
    decimal TotalSales,
    decimal AverageTicket,
    int SalesCount
);

public record DailySalesDto(
    string Date,
    decimal NetSales,
    decimal CostOfGoodsSold,
    decimal GrossMargin,
    int SalesCount
);

public record LowStockAlertDto(
    Guid ProductId,
    string ProductName,
    string Sku,
    string CategoryName,
    decimal StockQuantity,
    decimal MinimumStock,
    decimal AverageCost,
    string BaseUnit
);

public record DashboardSummaryDto(
    decimal GrossSales,
    decimal NetSales,
    decimal TaxTotal,
    decimal CostOfGoodsSold,
    decimal GrossMargin,
    decimal GrossMarginPercentage,
    decimal InventoryValuation,
    int LowStockAlertsCount,
    int TotalSalesCount,
    int TotalVoidedSalesCount,
    decimal AverageTicket,
    string CurrencyCode,
    IReadOnlyList<TopProductDto> TopSellingProducts,
    IReadOnlyList<PaymentMethodBreakdownDto> SalesByPaymentMethod,
    IReadOnlyList<CashierBreakdownDto> SalesByCashier,
    IReadOnlyList<DailySalesDto> DailySalesTrend,
    IReadOnlyList<LowStockAlertDto> LowStockAlerts
);

public record DashboardQueryParams(
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    Guid? CashierId = null
);

public record SalesReportItemDto(
    Guid SaleId,
    string SaleNumber,
    DateTime CompletedAt,
    string CashierName,
    Guid ProductId,
    string ProductName,
    string Sku,
    decimal Quantity,
    decimal UnitPrice,
    decimal UnitCostSnapshot,
    decimal LineSubtotal,
    decimal LineDiscount,
    decimal LineNetSales,
    decimal LineCmv,
    decimal LineGrossProfit,
    decimal LineTax,
    decimal LineTotal
);

public record SalesReportDto(
    IReadOnlyList<SalesReportItemDto> Items,
    int TotalLines,
    decimal TotalGrossSales,
    decimal TotalNetSales,
    decimal TotalCmv,
    decimal TotalGrossProfit,
    decimal TotalTax
);

public record SalesReportQueryParams(
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    Guid? CashierId = null,
    Guid? ProductId = null,
    int Page = 1,
    int PageSize = 100
);
