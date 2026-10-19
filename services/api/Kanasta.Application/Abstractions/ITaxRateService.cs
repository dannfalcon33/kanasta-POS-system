using Kanasta.Application.Catalog;

namespace Kanasta.Application.Abstractions;

public interface ITaxRateService
{
    Task<IReadOnlyList<TaxRateDto>> GetTaxRatesAsync(bool activeOnly = true, CancellationToken ct = default);
}
