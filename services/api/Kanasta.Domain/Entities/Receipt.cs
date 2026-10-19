namespace Kanasta.Domain.Entities;

public class Receipt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SaleId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public string DocumentType { get; set; } = "INTERNAL_TEST_RECEIPT";
    public string BusinessSnapshot { get; set; } = "{}";
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public string DocumentStatus { get; set; } = "ISSUED";

    // Navigations
    public Sale Sale { get; set; } = null!;
}
