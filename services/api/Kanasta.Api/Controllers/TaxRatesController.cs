using Kanasta.Application.Abstractions;
using Kanasta.Application.Catalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kanasta.Api.Controllers;

[ApiController]
[Route("api/v1/tax-rates")]
[Authorize]
public class TaxRatesController : ControllerBase
{
    private readonly ITaxRateService _taxRateService;

    public TaxRatesController(ITaxRateService taxRateService)
    {
        _taxRateService = taxRateService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaxRateDto>>> GetAll([FromQuery] bool activeOnly = true, CancellationToken ct = default)
    {
        var rates = await _taxRateService.GetTaxRatesAsync(activeOnly, ct);
        return Ok(rates);
    }
}
