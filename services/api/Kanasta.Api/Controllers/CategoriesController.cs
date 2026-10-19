using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/categories")]
[Authorize]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default)
    {
        var categories = await _categoryService.GetCategoriesAsync(includeInactive, ct);
        return Ok(categories);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> GetById([FromRoute] Guid id, CancellationToken ct = default)
    {
        var category = await _categoryService.GetCategoryByIdAsync(id, ct);
        return Ok(category);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CreateCategoryRequest request, CancellationToken ct = default)
    {
        var category = await _categoryService.CreateCategoryAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, category);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<CategoryDto>> Update([FromRoute] Guid id, [FromBody] UpdateCategoryRequest request, CancellationToken ct = default)
    {
        var category = await _categoryService.UpdateCategoryAsync(id, request, ct);
        return Ok(category);
    }

    [HttpPatch("{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<CategoryDto>> UpdateStatus([FromRoute] Guid id, [FromBody] UpdateCategoryStatusRequest request, CancellationToken ct = default)
    {
        var category = await _categoryService.UpdateCategoryStatusAsync(id, request.IsActive, ct);
        return Ok(category);
    }
}
