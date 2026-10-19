using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class TaxRateConfiguration : IEntityTypeConfiguration<TaxRate>
{
    public void Configure(EntityTypeBuilder<TaxRate> builder)
    {
        builder.ToTable("tax_rates", t =>
        {
            t.HasCheckConstraint("CK_tax_rates_rate", "rate >= 0");
        });

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(t => t.Rate)
            .HasPrecision(7, 4)
            .IsRequired();

        builder.Property(t => t.JurisdictionCode)
            .HasMaxLength(40);

        builder.Property(t => t.ValidFrom)
            .IsRequired();

        builder.Property(t => t.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.HasMany(t => t.Products)
            .WithOne(p => p.TaxRate)
            .HasForeignKey(p => p.TaxRateId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
