using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class BusinessSettingsConfiguration : IEntityTypeConfiguration<BusinessSettings>
{
    public void Configure(EntityTypeBuilder<BusinessSettings> builder)
    {
        builder.ToTable("business_settings");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.BusinessName)
            .HasMaxLength(160)
            .IsRequired();

        builder.Property(b => b.TaxIdentifier)
            .HasMaxLength(80);

        builder.Property(b => b.Address)
            .HasColumnType("text");

        builder.Property(b => b.Phone)
            .HasMaxLength(40);

        builder.Property(b => b.CurrencyCode)
            .HasMaxLength(3)
            .IsFixedLength()
            .IsRequired();

        builder.Property(b => b.Timezone)
            .HasMaxLength(80)
            .IsRequired();

        builder.Property(b => b.PricesIncludeTax)
            .IsRequired();

        builder.Property(b => b.CreatedAt)
            .IsRequired();
    }
}
