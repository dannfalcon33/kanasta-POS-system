using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Kanasta.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/products")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    private bool CanViewCosts => User.IsInRole("Admin");

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProductDto>>> GetAll([FromQuery] ProductQueryParams query, CancellationToken ct = default)
    {
        var result = await _productService.GetProductsAsync(query, CanViewCosts, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById([FromRoute] Guid id, CancellationToken ct = default)
    {
        var product = await _productService.GetProductByIdAsync(id, CanViewCosts, ct);
        return Ok(product);
    }

    [HttpGet("by-barcode/{barcode}")]
    public async Task<ActionResult<ProductDto>> GetByBarcode([FromRoute] string barcode, CancellationToken ct = default)
    {
        var product = await _productService.GetProductByBarcodeAsync(barcode, CanViewCosts, ct);
        return Ok(product);
    }

    [HttpGet("by-sku/{sku}")]
    public async Task<ActionResult<ProductDto>> GetBySku([FromRoute] string sku, CancellationToken ct = default)
    {
        var product = await _productService.GetProductBySkuAsync(sku, CanViewCosts, ct);
        return Ok(product);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> Create([FromBody] CreateProductRequest request, CancellationToken ct = default)
    {
        var product = await _productService.CreateProductAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, product);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> Update([FromRoute] Guid id, [FromBody] UpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _productService.UpdateProductAsync(id, request, ct);
        return Ok(product);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductDto>> UpdateStatus([FromRoute] Guid id, [FromBody] UpdateProductStatusRequest request, CancellationToken ct = default)
    {
        var product = await _productService.UpdateProductStatusAsync(id, request.IsActive, ct);
        return Ok(product);
    }
}
