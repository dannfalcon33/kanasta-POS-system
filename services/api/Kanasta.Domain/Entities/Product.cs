namespace Kanasta.Domain.Entities;

public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid CategoryId { get; set; }
    public string BaseUnit { get; set; } = "unidad";
    public decimal SalePrice { get; set; }
    public decimal AverageCost { get; set; } = 0m;
    public decimal StockQuantity { get; set; } = 0m;
    public decimal? MinimumStock { get; set; }
    public Guid? TaxRateId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigations
    public Category Category { get; set; } = null!;
    public TaxRate? TaxRate { get; set; }
    public ICollection<StockMovement> StockMovements { get; set; } = new List<StockMovement>();
    public ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
    public ICollection<PurchaseItem> PurchaseItems { get; set; } = new List<PurchaseItem>();
}
