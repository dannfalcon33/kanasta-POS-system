using Kanasta.Application.Abstractions;
using Kanasta.Application.Reports;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class ReportService : IReportService
{
    private readonly KanastaDbContext _db;

    public ReportService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardSummaryDto> GetDashboardSummaryAsync(DashboardQueryParams queryParams, CancellationToken cancellationToken = default)
    {
        // 1. Consulta de ventas completadas
        var salesQuery = _db.Sales
            .AsNoTracking()
            .Include(s => s.Cashier)
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .Where(s => s.Status == SaleStatus.Completed);

        if (queryParams.StartDate.HasValue)
        {
            salesQuery = salesQuery.Where(s => s.CreatedAt >= queryParams.StartDate.Value);
        }

        if (queryParams.EndDate.HasValue)
        {
            salesQuery = salesQuery.Where(s => s.CreatedAt <= queryParams.EndDate.Value);
        }

        if (queryParams.CashierId.HasValue)
        {
            salesQuery = salesQuery.Where(s => s.CashierId == queryParams.CashierId.Value);
        }

        var completedSales = await salesQuery.ToListAsync(cancellationToken);

        // 2. Conteo de ventas anuladas en el período (excluidas de las finanzas)
        var voidedSalesQuery = _db.Sales
            .AsNoTracking()
            .Where(s => s.Status == SaleStatus.Voided);

        if (queryParams.StartDate.HasValue)
        {
            voidedSalesQuery = voidedSalesQuery.Where(s => s.CreatedAt >= queryParams.StartDate.Value);
        }

        if (queryParams.EndDate.HasValue)
        {
            voidedSalesQuery = voidedSalesQuery.Where(s => s.CreatedAt <= queryParams.EndDate.Value);
        }

        if (queryParams.CashierId.HasValue)
        {
            voidedSalesQuery = voidedSalesQuery.Where(s => s.CashierId == queryParams.CashierId.Value);
        }

        var totalVoidedSalesCount = await voidedSalesQuery.CountAsync(cancellationToken);

        // 3. Métricas Financieras Principales
        var grossSales = completedSales.Sum(s => s.Total);
        var netSales = completedSales.Sum(s => s.Subtotal - s.DiscountTotal);
        var taxTotal = completedSales.Sum(s => s.TaxTotal);
        var totalSalesCount = completedSales.Count;
        var averageTicket = totalSalesCount > 0 ? Math.Round(grossSales / totalSalesCount, 2) : 0m;

        // Cost of Goods Sold (CMV) a partir de los snapshots inmutables de costo unitario
        var allItems = completedSales.SelectMany(s => s.Items).ToList();
        var costOfGoodsSold = allItems.Sum(i => i.Quantity * i.UnitCostSnapshot);

        // Margen Bruto y Porcentaje
        var grossMargin = netSales - costOfGoodsSold;
        var grossMarginPercentage = netSales > 0 ? Math.Round((grossMargin / netSales) * 100m, 2) : 0m;

        // 4. Inventario Valorizado Global (Compatible con SQLite y PostgreSQL, sumando en cliente)
        var activeProducts = await _db.Products
            .AsNoTracking()
            .Where(p => p.IsActive)
            .Select(p => new { p.StockQuantity, p.AverageCost })
            .ToListAsync(cancellationToken);
        var inventoryValuation = activeProducts.Sum(p => p.StockQuantity * p.AverageCost);

        // 5. Alertas de Stock Bajo
        var rawLowStock = await _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.IsActive && p.MinimumStock != null && p.StockQuantity <= p.MinimumStock)
            .Select(p => new LowStockAlertDto(
                p.Id,
                p.Name,
                p.Sku,
                p.Category.Name,
                p.StockQuantity,
                p.MinimumStock ?? 0m,
                p.AverageCost,
                p.BaseUnit
            ))
            .ToListAsync(cancellationToken);

        var lowStockProducts = rawLowStock
            .OrderBy(p => p.StockQuantity)
            .ToList();

        // 6. Top 10 Productos Más Vendidos
        var topSellingProducts = allItems
            .GroupBy(i => new { i.ProductId, i.ProductNameSnapshot, i.SkuSnapshot })
            .Select(g =>
            {
                var unitsSold = g.Sum(x => x.Quantity);
                var revenue = g.Sum(x => x.LineTotal);
                var cost = g.Sum(x => x.Quantity * x.UnitCostSnapshot);
                var profit = revenue - cost;
                var profitPercent = revenue > 0 ? Math.Round((profit / revenue) * 100m, 2) : 0m;

                return new TopProductDto(
                    g.Key.ProductId,
                    g.Key.ProductNameSnapshot,
                    g.Key.SkuSnapshot,
                    unitsSold,
                    revenue,
                    cost,
                    profit,
                    profitPercent
                );
            })
            .OrderByDescending(tp => tp.Revenue)
            .Take(10)
            .ToList();

        // 7. Desglose por Método de Pago
        var allPayments = completedSales.SelectMany(s => s.Payments).ToList();
        var totalPaymentsAmount = allPayments.Sum(p => p.Amount);
        var salesByPaymentMethod = allPayments
            .GroupBy(p => p.PaymentMethod.ToString())
            .Select(g =>
            {
                var methodTotal = g.Sum(x => x.Amount);
                var count = g.Count();
                var pct = totalPaymentsAmount > 0 ? Math.Round((methodTotal / totalPaymentsAmount) * 100m, 2) : 0m;
                return new PaymentMethodBreakdownDto(g.Key, methodTotal, count, pct);
            })
            .OrderByDescending(pm => pm.TotalAmount)
            .ToList();

        // 8. Desglose por Cajero
        var salesByCashier = completedSales
            .GroupBy(s => new { s.CashierId, s.Cashier.FullName })
            .Select(g =>
            {
                var cashierNet = g.Sum(x => x.Subtotal - x.DiscountTotal);
                var cashierTotal = g.Sum(x => x.Total);
                var count = g.Count();
                var avgTicket = count > 0 ? Math.Round(cashierTotal / count, 2) : 0m;
                return new CashierBreakdownDto(
                    g.Key.CashierId,
                    g.Key.FullName,
                    cashierNet,
                    cashierTotal,
                    avgTicket,
                    count
                );
            })
            .OrderByDescending(c => c.TotalSales)
            .ToList();

        // 9. Tendencia Diaria de Ventas
        var dailySalesTrend = completedSales
            .GroupBy(s => s.CreatedAt.ToString("yyyy-MM-dd"))
            .Select(g =>
            {
                var dailyNet = g.Sum(x => x.Subtotal - x.DiscountTotal);
                var dailyCost = g.SelectMany(x => x.Items).Sum(i => i.Quantity * i.UnitCostSnapshot);
                var dailyMargin = dailyNet - dailyCost;

                return new DailySalesDto(
                    g.Key,
                    dailyNet,
                    dailyCost,
                    dailyMargin,
                    g.Count()
                );
            })
            .OrderBy(d => d.Date)
            .ToList();

        return new DashboardSummaryDto(
            grossSales,
            netSales,
            taxTotal,
            costOfGoodsSold,
            grossMargin,
            grossMarginPercentage,
            inventoryValuation,
            lowStockProducts.Count,
            totalSalesCount,
            totalVoidedSalesCount,
            averageTicket,
            "USD",
            topSellingProducts,
            salesByPaymentMethod,
            salesByCashier,
            dailySalesTrend,
            lowStockProducts
        );
    }

    public async Task<SalesReportDto> GetSalesReportAsync(SalesReportQueryParams queryParams, CancellationToken cancellationToken = default)
    {
        var query = _db.SaleItems
            .AsNoTracking()
            .Include(si => si.Sale)
                .ThenInclude(s => s.Cashier)
            .Where(si => si.Sale.Status == SaleStatus.Completed);

        if (queryParams.StartDate.HasValue)
        {
            query = query.Where(si => si.Sale.CreatedAt >= queryParams.StartDate.Value);
        }

        if (queryParams.EndDate.HasValue)
        {
            query = query.Where(si => si.Sale.CreatedAt <= queryParams.EndDate.Value);
        }

        if (queryParams.CashierId.HasValue)
        {
            query = query.Where(si => si.Sale.CashierId == queryParams.CashierId.Value);
        }

        if (queryParams.ProductId.HasValue)
        {
            query = query.Where(si => si.ProductId == queryParams.ProductId.Value);
        }

        var allMatchingItems = await query.ToListAsync(cancellationToken);

        var totalGrossSales = allMatchingItems.Sum(i => i.LineTotal);
        var totalNetSales = allMatchingItems.Sum(i => (i.Quantity * i.UnitPrice) - i.DiscountAmount);
        var totalCmv = allMatchingItems.Sum(i => i.Quantity * i.UnitCostSnapshot);
        var totalGrossProfit = totalNetSales - totalCmv;
        var totalTax = allMatchingItems.Sum(i => i.TaxAmount);

        var items = allMatchingItems
            .OrderByDescending(i => i.Sale.CreatedAt)
            .Select(i =>
            {
                var lineSubtotal = Math.Round(i.Quantity * i.UnitPrice, 2, MidpointRounding.AwayFromZero);
                var lineCost = Math.Round(i.Quantity * i.UnitCostSnapshot, 2, MidpointRounding.AwayFromZero);
                var lineNet = lineSubtotal - i.DiscountAmount;
                var lineMargin = lineNet - lineCost;

                return new SalesReportItemDto(
                    i.SaleId,
                    i.Sale.SaleNumber,
                    i.Sale.CreatedAt,
                    i.Sale.Cashier.FullName,
                    i.ProductId,
                    i.ProductNameSnapshot,
                    i.SkuSnapshot,
                    i.Quantity,
                    i.UnitPrice,
                    i.UnitCostSnapshot,
                    lineSubtotal,
                    i.DiscountAmount,
                    lineNet,
                    lineCost,
                    lineMargin,
                    i.TaxAmount,
                    i.LineTotal
                );
            })
            .ToList();

        return new SalesReportDto(
            items,
            items.Count,
            totalGrossSales,
            totalNetSales,
            totalCmv,
            totalGrossProfit,
            totalTax
        );
    }
}
