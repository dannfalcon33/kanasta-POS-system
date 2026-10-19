using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kanasta.Infrastructure.Persistence;

public class KanastaDbContextFactory : IDesignTimeDbContextFactory<KanastaDbContext>
{
    public KanastaDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<KanastaDbContext>();

        // Default connection string used for design-time migrations generation
        var connectionString = "Host=localhost;Port=5432;Database=kanasta_db;Username=kanasta_user;Password=kanasta_pass";

        optionsBuilder.UseNpgsql(connectionString)
                      .UseSnakeCaseNamingConvention();

        return new KanastaDbContext(optionsBuilder.Options);
    }
}
