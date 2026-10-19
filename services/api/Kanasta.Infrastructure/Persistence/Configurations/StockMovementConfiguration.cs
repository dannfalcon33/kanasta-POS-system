using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.MovementType)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(m => m.QuantityDelta)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(m => m.QuantityAfter)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(m => m.UnitCostSnapshot)
            .HasPrecision(14, 4);

        builder.Property(m => m.ReferenceType)
            .HasMaxLength(30);

        builder.Property(m => m.Reason)
            .HasColumnType("text");

        builder.Property(m => m.CreatedAt)
            .IsRequired();

        builder.HasIndex(m => new { m.ProductId, m.CreatedAt });

        builder.HasOne(m => m.Product)
            .WithMany(p => p.StockMovements)
            .HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.CreatedBy)
            .WithMany()
            .HasForeignKey(m => m.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
