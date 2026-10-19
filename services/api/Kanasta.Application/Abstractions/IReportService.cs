using Kanasta.Application.Reports;

namespace Kanasta.Application.Abstractions;

public interface IReportService
{
    Task<DashboardSummaryDto> GetDashboardSummaryAsync(DashboardQueryParams queryParams, CancellationToken cancellationToken = default);
    Task<SalesReportDto> GetSalesReportAsync(SalesReportQueryParams queryParams, CancellationToken cancellationToken = default);
}
