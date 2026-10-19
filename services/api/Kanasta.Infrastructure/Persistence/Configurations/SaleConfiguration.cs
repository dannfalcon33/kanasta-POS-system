using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToTable("sales");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.SaleNumber)
            .HasMaxLength(60)
            .IsRequired();

        builder.HasIndex(s => s.SaleNumber)
            .IsUnique();

        builder.Property(s => s.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.Subtotal)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(s => s.DiscountTotal)
            .HasPrecision(14, 2)
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Property(s => s.TaxTotal)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(s => s.Total)
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(s => s.CurrencyCode)
            .HasMaxLength(3)
            .IsFixedLength()
            .IsRequired();

        builder.Property(s => s.VoidReason)
            .HasColumnType("text");

        builder.Property(s => s.CreatedAt)
            .IsRequired();

        builder.HasIndex(s => s.CompletedAt);
        builder.HasIndex(s => s.CashierId);

        builder.HasOne(s => s.Cashier)
            .WithMany(u => u.Sales)
            .HasForeignKey(s => s.CashierId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.VoidedBy)
            .WithMany()
            .HasForeignKey(s => s.VoidedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(s => s.Items)
            .WithOne(i => i.Sale)
            .HasForeignKey(i => i.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(s => s.Payments)
            .WithOne(p => p.Sale)
            .HasForeignKey(p => p.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Receipt)
            .WithOne(r => r.Sale)
            .HasForeignKey<Receipt>(r => r.SaleId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
