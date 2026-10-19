namespace Kanasta.Application.Catalog;

public record TaxRateDto(
    Guid Id,
    string Name,
    decimal Rate,
    string? JurisdictionCode,
    bool IsActive
);
