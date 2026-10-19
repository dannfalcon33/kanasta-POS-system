using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Kanasta.Application.Exceptions;
using Kanasta.Domain.Entities;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class CategoryService : ICategoryService
{
    private readonly KanastaDbContext _db;

    public CategoryService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var query = _db.Categories
            .AsNoTracking()
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(c => c.IsActive);
        }

        var categories = await query
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.Description,
                c.IsActive,
                c.CreatedAt,
                c.UpdatedAt,
                c.Products.Count(p => p.IsActive)
            ))
            .ToListAsync(ct);

        return categories;
    }

    public async Task<CategoryDto> GetCategoryByIdAsync(Guid id, CancellationToken ct = default)
    {
        var category = await _db.Categories
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.Description,
                c.IsActive,
                c.CreatedAt,
                c.UpdatedAt,
                c.Products.Count(p => p.IsActive)
            ))
            .FirstOrDefaultAsync(ct);

        if (category == null)
        {
            throw new NotFoundException($"Categoría con ID '{id}' no encontrada.");
        }

        return category;
    }

    public async Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre de la categoría es obligatorio.");
        }

        var normalizedName = request.Name.Trim();

        var exists = await _db.Categories
            .AnyAsync(c => c.Name.ToLower() == normalizedName.ToLower(), ct);

        if (exists)
        {
            throw new ConflictException($"Ya existe una categoría con el nombre '{normalizedName}'.");
        }

        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync(ct);

        return new CategoryDto(
            category.Id,
            category.Name,
            category.Description,
            category.IsActive,
            category.CreatedAt,
            category.UpdatedAt,
            0
        );
    }

    public async Task<CategoryDto> UpdateCategoryAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre de la categoría es obligatorio.");
        }

        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (category == null)
        {
            throw new NotFoundException($"Categoría con ID '{id}' no encontrada.");
        }

        var normalizedName = request.Name.Trim();

        if (!string.Equals(category.Name, normalizedName, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _db.Categories
                .AnyAsync(c => c.Id != id && c.Name.ToLower() == normalizedName.ToLower(), ct);

            if (exists)
            {
                throw new ConflictException($"Ya existe otra categoría con el nombre '{normalizedName}'.");
            }
        }

        category.Name = normalizedName;
        category.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        category.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new CategoryDto(
            category.Id,
            category.Name,
            category.Description,
            category.IsActive,
            category.CreatedAt,
            category.UpdatedAt,
            category.Products.Count(p => p.IsActive)
        );
    }

    public async Task<CategoryDto> UpdateCategoryStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        if (category == null)
        {
            throw new NotFoundException($"Categoría con ID '{id}' no encontrada.");
        }

        category.IsActive = isActive;
        category.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new CategoryDto(
            category.Id,
            category.Name,
            category.Description,
            category.IsActive,
            category.CreatedAt,
            category.UpdatedAt,
            category.Products.Count(p => p.IsActive)
        );
    }
}
