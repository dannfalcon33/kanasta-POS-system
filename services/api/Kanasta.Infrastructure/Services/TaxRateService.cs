using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class TaxRateService : ITaxRateService
{
    private readonly KanastaDbContext _db;

    public TaxRateService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<TaxRateDto>> GetTaxRatesAsync(bool activeOnly = true, CancellationToken ct = default)
    {
        var query = _db.TaxRates.AsNoTracking().AsQueryable();

        if (activeOnly)
        {
            query = query.Where(t => t.IsActive);
        }

        return await query
            .OrderBy(t => t.Name)
            .Select(t => new TaxRateDto(
                t.Id,
                t.Name,
                t.Rate,
                t.JurisdictionCode,
                t.IsActive
            ))
            .ToListAsync(ct);
    }
}
