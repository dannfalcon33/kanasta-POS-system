using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class ReceiptConfiguration : IEntityTypeConfiguration<Receipt>
{
    public void Configure(EntityTypeBuilder<Receipt> builder)
    {
        builder.ToTable("receipts");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.DocumentNumber)
            .HasMaxLength(80)
            .IsRequired();

        builder.HasIndex(r => r.DocumentNumber)
            .IsUnique();

        builder.Property(r => r.DocumentType)
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(r => r.BusinessSnapshot)
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.DocumentStatus)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.IssuedAt)
            .IsRequired();

        builder.HasIndex(r => r.SaleId)
            .IsUnique();
    }
}
