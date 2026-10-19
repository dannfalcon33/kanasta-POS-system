using Kanasta.Application.Catalog;

namespace Kanasta.Application.Abstractions;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<CategoryDto> GetCategoryByIdAsync(Guid id, CancellationToken ct = default);
    Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default);
    Task<CategoryDto> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default);
    Task<CategoryDto> UpdateCategoryStatusAsync(Guid id, bool isActive, CancellationToken ct = default);
}
