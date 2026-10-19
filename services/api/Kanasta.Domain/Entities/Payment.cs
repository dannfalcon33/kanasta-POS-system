using Kanasta.Domain.Enums;

namespace Kanasta.Domain.Entities;

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SaleId { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public decimal Amount { get; set; }
    public string? Reference { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public Guid ReceivedById { get; set; }

    // Navigations
    public Sale Sale { get; set; } = null!;
    public User ReceivedBy { get; set; } = null!;
}
