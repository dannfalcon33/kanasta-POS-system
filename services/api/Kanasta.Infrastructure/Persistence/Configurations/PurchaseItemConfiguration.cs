using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class PurchaseItemConfiguration : IEntityTypeConfiguration<PurchaseItem>
{
    public void Configure(EntityTypeBuilder<PurchaseItem> builder)
    {
        builder.ToTable("purchase_items", t =>
        {
            t.HasCheckConstraint("CK_purchase_items_quantity", "quantity > 0");
            t.HasCheckConstraint("CK_purchase_items_unit_cost", "unit_cost >= 0");
        });

        builder.HasKey(pi => pi.Id);

        builder.Property(pi => pi.Quantity)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(pi => pi.UnitCost)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(pi => pi.TaxRateSnapshot)
            .HasPrecision(7, 4)
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Property(pi => pi.LineSubtotal)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(pi => pi.LineTax)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(pi => pi.LineTotal)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.HasIndex(pi => pi.PurchaseId);

        builder.HasOne(pi => pi.Purchase)
            .WithMany(p => p.Items)
            .HasForeignKey(pi => pi.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(pi => pi.Product)
            .WithMany(p => p.PurchaseItems)
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
