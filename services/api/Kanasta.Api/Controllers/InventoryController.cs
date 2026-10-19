using System.Security.Claims;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/inventory")]
[Authorize]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    private bool CanViewCosts => User.IsInRole("Admin");

    private Guid CurrentUserId
    {
        get
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(idClaim, out var id) ? id : Guid.Empty;
        }
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<InventoryItemDto>>> GetInventory(
        [FromQuery] string? search = null,
        [FromQuery] Guid? categoryId = null,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _inventoryService.GetInventoryAsync(search, categoryId, lowStockOnly, page, pageSize, CanViewCosts, ct);
        return Ok(result);
    }

    [HttpGet("movements")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResult<StockMovementDto>>> GetMovements(
        [FromQuery] Guid? productId = null,
        [FromQuery] string? movementType = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _inventoryService.GetStockMovementsAsync(productId, movementType, page, pageSize, ct);
        return Ok(result);
    }

    [HttpPost("adjustments")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<StockMovementDto>> CreateAdjustment(
        [FromBody] ManualAdjustmentRequest request,
        CancellationToken ct = default)
    {
        var result = await _inventoryService.CreateManualAdjustmentAsync(request, CurrentUserId, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}
