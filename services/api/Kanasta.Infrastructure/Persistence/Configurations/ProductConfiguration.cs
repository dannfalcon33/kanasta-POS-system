using Kanasta.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Kanasta.Infrastructure.Persistence.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products", t =>
        {
            t.HasCheckConstraint("CK_products_sale_price", "sale_price >= 0");
            t.HasCheckConstraint("CK_products_average_cost", "average_cost >= 0");
            t.HasCheckConstraint("CK_products_stock_quantity", "stock_quantity >= 0");
        });

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Sku)
            .HasMaxLength(80)
            .IsRequired();

        builder.HasIndex(p => p.Sku)
            .IsUnique();

        builder.Property(p => p.Barcode)
            .HasMaxLength(100);

        builder.HasIndex(p => p.Barcode)
            .IsUnique();

        builder.Property(p => p.Name)
            .HasMaxLength(180)
            .IsRequired();

        builder.Property(p => p.Description)
            .HasColumnType("text");

        builder.Property(p => p.BaseUnit)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.SalePrice)
            .HasPrecision(14, 4)
            .IsRequired();

        builder.Property(p => p.AverageCost)
            .HasPrecision(14, 4)
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Property(p => p.StockQuantity)
            .HasPrecision(14, 4)
            .IsRequired()
            .HasDefaultValue(0m);

        builder.Property(p => p.MinimumStock)
            .HasPrecision(14, 4);

        builder.Property(p => p.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        builder.Property(p => p.CreatedAt)
            .IsRequired();

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.TaxRate)
            .WithMany(t => t.Products)
            .HasForeignKey(p => p.TaxRateId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(p => p.StockMovements)
            .WithOne(m => m.Product)
            .HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.SaleItems)
            .WithOne(si => si.Product)
            .HasForeignKey(si => si.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(p => p.PurchaseItems)
            .WithOne(pi => pi.Product)
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
