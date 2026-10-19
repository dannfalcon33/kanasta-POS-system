using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;

namespace Kanasta.Infrastructure.Persistence.Seed;

public static class DatabaseSeeder
{
    public static readonly Guid BusinessId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid TaxRateGeneralId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid CategoryViveresId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid CategoryLacteosId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    public static readonly Guid SupplierPrincipalId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    public static readonly Guid ProductArrozId = Guid.Parse("66666666-6666-6666-6666-666666666661");
    public static readonly Guid ProductHarinaId = Guid.Parse("66666666-6666-6666-6666-666666666662");
    public static readonly Guid ProductLecheId = Guid.Parse("66666666-6666-6666-6666-666666666663");

    public static BusinessSettings GetSeedBusinessSettings() => new()
    {
        Id = BusinessId,
        BusinessName = "Abasto y Supermercado Ejemplo",
        TaxIdentifier = "J-12345678-0",
        Address = "Av. Principal, Local 1, Caracas, Venezuela",
        Phone = "+58 212 5550000",
        CurrencyCode = "USD",
        Timezone = "America/Caracas",
        PricesIncludeTax = false,
        CreatedAt = DateTime.UtcNow
    };

    public static TaxRate GetSeedTaxRate() => new()
    {
        Id = TaxRateGeneralId,
        Name = "IVA General Ilustrativo (16%)",
        Rate = 0.1600m,
        JurisdictionCode = "VE",
        ValidFrom = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        IsActive = true
    };

    public static List<Category> GetSeedCategories() => new()
    {
        new Category
        {
            Id = CategoryViveresId,
            Name = "Víveres",
            Description = "Alimentos no perecederos y granos básicos",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        },
        new Category
        {
            Id = CategoryLacteosId,
            Name = "Lácteos y Refrigerados",
            Description = "Leches, quesos y derivados",
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        }
    };

    public static Supplier GetSeedSupplier() => new()
    {
        Id = SupplierPrincipalId,
        Name = "Distribuidora Nacional de Alimentos C.A.",
        TaxIdentifier = "J-98765432-1",
        Phone = "+58 212 5551122",
        Email = "contacto@distribuidoraficticia.com",
        Address = "Zona Industrial, Caracas",
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };

    public static List<Product> GetSeedProducts() => new()
    {
        new Product
        {
            Id = ProductArrozId,
            Sku = "VIV-ARR-001",
            Barcode = "7591000111222",
            Name = "Arroz Blanco Tradicional 1kg",
            Description = "Arroz de grano largo calidad superior",
            CategoryId = CategoryViveresId,
            BaseUnit = "kg",
            SalePrice = 1.3500m, // USD
            AverageCost = 0.9500m, // USD
            StockQuantity = 150.0000m,
            MinimumStock = 20.0000m,
            TaxRateId = TaxRateGeneralId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        },
        new Product
        {
            Id = ProductHarinaId,
            Sku = "VIV-HAR-002",
            Barcode = "7591000333444",
            Name = "Harina de Maíz Blanco 1kg",
            Description = "Harina precocida para arepas",
            CategoryId = CategoryViveresId,
            BaseUnit = "kg",
            SalePrice = 1.2000m,
            AverageCost = 0.8500m,
            StockQuantity = 200.0000m,
            MinimumStock = 30.0000m,
            TaxRateId = TaxRateGeneralId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        },
        new Product
        {
            Id = ProductLecheId,
            Sku = "LAC-LEC-003",
            Barcode = "7591000555666",
            Name = "Leche Entera Larga Vida 1L",
            Description = "Leche pasteurizada UHT",
            CategoryId = CategoryLacteosId,
            BaseUnit = "litro",
            SalePrice = 2.1000m,
            AverageCost = 1.5500m,
            StockQuantity = 80.0000m,
            MinimumStock = 15.0000m,
            TaxRateId = TaxRateGeneralId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        }
    };

    public static void Seed(KanastaDbContext context)
    {
        if (!context.BusinessSettings.Any())
        {
            context.BusinessSettings.Add(GetSeedBusinessSettings());
        }

        if (!context.TaxRates.Any())
        {
            context.TaxRates.Add(GetSeedTaxRate());
        }

        if (!context.Categories.Any())
        {
            context.Categories.AddRange(GetSeedCategories());
        }

        if (!context.Suppliers.Any())
        {
            context.Suppliers.Add(GetSeedSupplier());
        }

        if (!context.Products.Any())
        {
            context.Products.AddRange(GetSeedProducts());
        }

        context.SaveChanges();
    }
}
