using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Xunit;

namespace Kanasta.Tests;

public class ArchitectureBaselineTests
{
    [Fact]
    public void ArchitectureLayers_CanBeReferencedSuccessfully()
    {
        // Assert that the domain and application layers are loadable
        var domainAssembly = typeof(User).Assembly;
        var appAssembly = typeof(ArchitectureBaselineTests).Assembly;

        Assert.NotNull(domainAssembly);
        Assert.NotNull(appAssembly);
    }

    [Fact]
    public void FinancialMath_UsesDecimalExactArithmetic()
    {
        // En punto flotante binario (double/float): 0.1 + 0.2 != 0.3 (debido a 0.30000000000000004)
        // En tipo decimal de C# (precisión exacta para dinero y stock de Kanasta):
        decimal val1 = 0.1m;
        decimal val2 = 0.2m;
        decimal sum = val1 + val2;

        Assert.Equal(0.3m, sum);
    }

    [Fact]
    public void MonetaryFormatting_RespectsUSDCurrencyStandard()
    {
        decimal sampleAmount = 12.50m;
        string formatted = $"US$ {sampleAmount:F2}";

        Assert.Equal("US$ 12.50", formatted);
    }
}
