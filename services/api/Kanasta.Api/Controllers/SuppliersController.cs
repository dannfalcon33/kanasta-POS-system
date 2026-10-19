using Kanasta.Application.Abstractions;
using Kanasta.Application.Suppliers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/suppliers")]
[Authorize(Roles = "Admin")]
public class SuppliersController : ControllerBase
{
    private readonly ISupplierService _supplierService;

    public SuppliersController(ISupplierService supplierService)
    {
        _supplierService = supplierService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupplierDto>>> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var suppliers = await _supplierService.GetSuppliersAsync(includeInactive, ct);
        return Ok(suppliers);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SupplierDto>> GetById([FromRoute] Guid id, CancellationToken ct = default)
    {
        var supplier = await _supplierService.GetSupplierByIdAsync(id, ct);
        return Ok(supplier);
    }

    [HttpPost]
    public async Task<ActionResult<SupplierDto>> Create([FromBody] CreateSupplierRequest request, CancellationToken ct = default)
    {
        var supplier = await _supplierService.CreateSupplierAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, supplier);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SupplierDto>> Update([FromRoute] Guid id, [FromBody] UpdateSupplierRequest request, CancellationToken ct = default)
    {
        var supplier = await _supplierService.UpdateSupplierAsync(id, request, ct);
        return Ok(supplier);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<SupplierDto>> UpdateStatus([FromRoute] Guid id, [FromBody] UpdateSupplierStatusRequest request, CancellationToken ct = default)
    {
        var supplier = await _supplierService.UpdateSupplierStatusAsync(id, request.IsActive, ct);
        return Ok(supplier);
    }
}
