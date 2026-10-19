namespace Kanasta.Application.Suppliers;

public record SupplierDto(
    Guid Id,
    string Name,
    string? TaxIdentifier,
    string? Phone,
    string? Email,
    string? Address,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    int PurchaseCount
);

public record CreateSupplierRequest(
    string Name,
    string? TaxIdentifier,
    string? Phone,
    string? Email,
    string? Address
);

public record UpdateSupplierRequest(
    string Name,
    string? TaxIdentifier,
    string? Phone,
    string? Email,
    string? Address
);

public record UpdateSupplierStatusRequest(
    bool IsActive
);
