using Kanasta.Application.Abstractions;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Suppliers;
using Kanasta.Domain.Entities;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class SupplierService : ISupplierService
{
    private readonly KanastaDbContext _db;

    public SupplierService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<SupplierDto>> GetSuppliersAsync(bool includeInactive = false, CancellationToken ct = default)
    {
        var query = _db.Suppliers.AsNoTracking().AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(s => s.IsActive);
        }

        return await query
            .OrderBy(s => s.Name)
            .Select(s => new SupplierDto(
                s.Id,
                s.Name,
                s.TaxIdentifier,
                s.Phone,
                s.Email,
                s.Address,
                s.IsActive,
                s.CreatedAt,
                s.UpdatedAt,
                s.Purchases.Count
            ))
            .ToListAsync(ct);
    }

    public async Task<SupplierDto> GetSupplierByIdAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await _db.Suppliers
            .AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new SupplierDto(
                s.Id,
                s.Name,
                s.TaxIdentifier,
                s.Phone,
                s.Email,
                s.Address,
                s.IsActive,
                s.CreatedAt,
                s.UpdatedAt,
                s.Purchases.Count
            ))
            .FirstOrDefaultAsync(ct);

        if (supplier == null)
        {
            throw new NotFoundException($"Proveedor con ID '{id}' no encontrado.");
        }

        return supplier;
    }

    public async Task<SupplierDto> CreateSupplierAsync(CreateSupplierRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre del proveedor es obligatorio.");
        }

        var normalizedName = request.Name.Trim();

        var exists = await _db.Suppliers
            .AnyAsync(s => s.Name.ToLower() == normalizedName.ToLower(), ct);

        if (exists)
        {
            throw new ConflictException($"Ya existe un proveedor con el nombre '{normalizedName}'.");
        }

        var supplier = new Supplier
        {
            Id = Guid.NewGuid(),
            Name = normalizedName,
            TaxIdentifier = string.IsNullOrWhiteSpace(request.TaxIdentifier) ? null : request.TaxIdentifier.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync(ct);

        return new SupplierDto(
            supplier.Id,
            supplier.Name,
            supplier.TaxIdentifier,
            supplier.Phone,
            supplier.Email,
            supplier.Address,
            supplier.IsActive,
            supplier.CreatedAt,
            supplier.UpdatedAt,
            0
        );
    }

    public async Task<SupplierDto> UpdateSupplierAsync(Guid id, UpdateSupplierRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessRuleException("El nombre del proveedor es obligatorio.");
        }

        var supplier = await _db.Suppliers
            .Include(s => s.Purchases)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (supplier == null)
        {
            throw new NotFoundException($"Proveedor con ID '{id}' no encontrado.");
        }

        var normalizedName = request.Name.Trim();

        if (!string.Equals(supplier.Name, normalizedName, StringComparison.OrdinalIgnoreCase))
        {
            var exists = await _db.Suppliers
                .AnyAsync(s => s.Id != id && s.Name.ToLower() == normalizedName.ToLower(), ct);

            if (exists)
            {
                throw new ConflictException($"Ya existe otro proveedor con el nombre '{normalizedName}'.");
            }
        }

        supplier.Name = normalizedName;
        supplier.TaxIdentifier = string.IsNullOrWhiteSpace(request.TaxIdentifier) ? null : request.TaxIdentifier.Trim();
        supplier.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        supplier.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        supplier.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        supplier.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new SupplierDto(
            supplier.Id,
            supplier.Name,
            supplier.TaxIdentifier,
            supplier.Phone,
            supplier.Email,
            supplier.Address,
            supplier.IsActive,
            supplier.CreatedAt,
            supplier.UpdatedAt,
            supplier.Purchases.Count
        );
    }

    public async Task<SupplierDto> UpdateSupplierStatusAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var supplier = await _db.Suppliers
            .Include(s => s.Purchases)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (supplier == null)
        {
            throw new NotFoundException($"Proveedor con ID '{id}' no encontrado.");
        }

        supplier.IsActive = isActive;
        supplier.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return new SupplierDto(
            supplier.Id,
            supplier.Name,
            supplier.TaxIdentifier,
            supplier.Phone,
            supplier.Email,
            supplier.Address,
            supplier.IsActive,
            supplier.CreatedAt,
            supplier.UpdatedAt,
            supplier.Purchases.Count
        );
    }
}
