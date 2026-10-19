namespace Kanasta.Application.Catalog;

public record CategoryDto(
    Guid Id,
    string Name,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int ProductCount
);

public record CreateCategoryRequest(
    string Name,
    string? Description
);

public record UpdateCategoryRequest(
    string Name,
    string? Description
);

public record UpdateCategoryStatusRequest(
    bool IsActive
);
