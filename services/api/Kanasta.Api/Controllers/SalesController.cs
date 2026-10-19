using System.Security.Claims;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Sales;
using Kanasta.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/sales")]
[Authorize]
public class SalesController : ControllerBase
{
    private readonly ISaleService _saleService;

    public SalesController(ISaleService saleService)
    {
        _saleService = saleService;
    }

    private bool IsAdmin => User.IsInRole("Admin");

    private Guid CurrentUserId
    {
        get
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(idClaim, out var id) ? id : Guid.Empty;
        }
    }

    [HttpPost]
    public async Task<ActionResult<SaleDetailDto>> CreateSale([FromBody] CreateSaleRequest request, CancellationToken ct = default)
    {
        var result = await _saleService.CreateSaleAsync(request, CurrentUserId, IsAdmin, ct);
        return CreatedAtAction(nameof(GetSaleById), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<SaleDto>>> GetSales(
        [FromQuery] Guid? cashierId = null,
        [FromQuery] SaleStatus? status = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var queryParams = new SaleQueryParams(cashierId, status, startDate, endDate, page, pageSize);
        var result = await _saleService.GetSalesAsync(queryParams, CurrentUserId, IsAdmin, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SaleDetailDto>> GetSaleById(Guid id, CancellationToken ct = default)
    {
        var result = await _saleService.GetSaleByIdAsync(id, IsAdmin, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/void")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SaleDetailDto>> VoidSale(Guid id, [FromBody] VoidSaleRequest request, CancellationToken ct = default)
    {
        var result = await _saleService.VoidSaleAsync(id, request, CurrentUserId, ct);
        return Ok(result);
    }
}
