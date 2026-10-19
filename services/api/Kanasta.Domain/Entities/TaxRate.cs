namespace Kanasta.Domain.Entities;

public class TaxRate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public decimal Rate { get; set; }
    public string? JurisdictionCode { get; set; }
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow;
    public DateTime? ValidTo { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigations
    public ICollection<Product> Products { get; set; } = new List<Product>();
}
