using Kanasta.Application.Abstractions;
using Kanasta.Application.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize(Roles = "Admin")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardSummaryDto>> GetDashboardSummary(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? cashierId = null,
        CancellationToken ct = default)
    {
        var queryParams = new DashboardQueryParams(startDate, endDate, cashierId);
        var result = await _reportService.GetDashboardSummaryAsync(queryParams, ct);
        return Ok(result);
    }

    [HttpGet("sales")]
    public async Task<ActionResult<SalesReportDto>> GetSalesReport(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] Guid? cashierId = null,
        [FromQuery] Guid? productId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var queryParams = new SalesReportQueryParams(startDate, endDate, cashierId, productId, page, pageSize);
        var result = await _reportService.GetSalesReportAsync(queryParams, ct);
        return Ok(result);
    }
}
