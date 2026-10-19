using Kanasta.Application.Suppliers;

namespace Kanasta.Application.Abstractions;

public interface ISupplierService
{
    Task<IReadOnlyList<SupplierDto>> GetSuppliersAsync(bool includeInactive = false, CancellationToken ct = default);
    Task<SupplierDto> GetSupplierByIdAsync(Guid id, CancellationToken ct = default);
    Task<SupplierDto> CreateSupplierAsync(CreateSupplierRequest request, CancellationToken ct = default);
    Task<SupplierDto> UpdateSupplierAsync(Guid id, UpdateSupplierRequest request, CancellationToken ct = default);
    Task<SupplierDto> UpdateSupplierStatusAsync(Guid id, bool isActive, CancellationToken ct = default);
}
