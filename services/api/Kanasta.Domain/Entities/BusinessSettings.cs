namespace Kanasta.Domain.Entities;

public class BusinessSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BusinessName { get; set; } = string.Empty;
    public string? TaxIdentifier { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public string Timezone { get; set; } = "America/Caracas";
    public bool PricesIncludeTax { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
