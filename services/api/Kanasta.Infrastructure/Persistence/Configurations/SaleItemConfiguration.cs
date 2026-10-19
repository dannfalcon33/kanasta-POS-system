using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.ToTable("sale_items", t =>
        {
            t.HasCheckConstraint("CK_sale_items_quantity", "quantity > 0");
            t.HasCheckConstraint("CK_sale_items_unit_price", "unit_price >= 0");
        });

        builder.HasKey(si => si.Id);

        builder.Property(si => si.SkuSnapshot)
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(si => si.ProductNameSnapshot)
            .HasMaxLength(180)
            .IsRequired();

        builder.Property(si => si.UnitSnapshot)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(si => si.Quantity)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(si => si.UnitPrice)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(si => si.DiscountAmount)
            .HasPrecision(14, 2)
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Property(si => si.TaxRateSnapshot)
            .HasPrecision(7, 4)
            .IsRequired();

        builder.Property(si => si.TaxAmount)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(si => si.LineTotal)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(si => si.UnitCostSnapshot)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.HasIndex(si => si.SaleId);

        builder.HasOne(si => si.Sale)
            .WithMany(s => s.Items)
            .HasForeignKey(si => si.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(si => si.Product)
            .WithMany(p => p.SaleItems)
            .HasForeignKey(si => si.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
