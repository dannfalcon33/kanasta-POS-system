using System.Security.Claims;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Purchases;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/purchases")]
[Authorize(Roles = "Admin")]
public class PurchasesController : ControllerBase
{
    private readonly IPurchaseService _purchaseService;

    public PurchasesController(IPurchaseService purchaseService)
    {
        _purchaseService = purchaseService;
    }

    private Guid CurrentUserId
    {
        get
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(idClaim, out var id) ? id : Guid.Empty;
        }
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<PurchaseSummaryDto>>> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] Guid? supplierId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _purchaseService.GetPurchasesAsync(status, supplierId, page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PurchaseDto>> GetById([FromRoute] Guid id, CancellationToken ct = default)
    {
        var purchase = await _purchaseService.GetPurchaseByIdAsync(id, ct);
        return Ok(purchase);
    }

    [HttpPost]
    public async Task<ActionResult<PurchaseDto>> Create([FromBody] CreatePurchaseRequest request, CancellationToken ct = default)
    {
        var purchase = await _purchaseService.CreatePurchaseAsync(request, CurrentUserId, ct);
        return StatusCode(StatusCodes.Status201Created, purchase);
    }

    [HttpPost("{id:guid}/receive")]
    public async Task<ActionResult<PurchaseDto>> Receive([FromRoute] Guid id, CancellationToken ct = default)
    {
        var purchase = await _purchaseService.ReceivePurchaseAsync(id, CurrentUserId, ct);
        return Ok(purchase);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<PurchaseDto>> Cancel([FromRoute] Guid id, [FromBody] CancelPurchaseRequest? request = null, CancellationToken ct = default)
    {
        var purchase = await _purchaseService.CancelPurchaseAsync(id, CurrentUserId, request?.Reason, ct);
        return Ok(purchase);
    }
}

public record CancelPurchaseRequest(string? Reason);
