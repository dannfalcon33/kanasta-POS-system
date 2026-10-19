using Kanasta.Domain.Enums;

namespace Kanasta.Domain.Entities;

public class Sale
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SaleNumber { get; set; } = string.Empty;
    public Guid CashierId { get; set; }
    public SaleStatus Status { get; set; } = SaleStatus.Draft;
    public decimal Subtotal { get; set; }
    public decimal DiscountTotal { get; set; } = 0m;
    public decimal TaxTotal { get; set; }
    public decimal Total { get; set; }
    public string CurrencyCode { get; set; } = "USD";
    public DateTime? CompletedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
    public Guid? VoidedById { get; set; }
    public string? VoidReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigations
    public User Cashier { get; set; } = null!;
    public User? VoidedBy { get; set; }
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public Receipt? Receipt { get; set; }
}
