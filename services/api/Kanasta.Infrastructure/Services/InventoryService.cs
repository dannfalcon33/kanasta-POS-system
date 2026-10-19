using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Inventory;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class InventoryService : IInventoryService
{
    private readonly KanastaDbContext _db;

    public InventoryService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<InventoryItemDto>> GetInventoryAsync(
        string? search = null,
        Guid? categoryId = null,
        bool? lowStockOnly = null,
        int page = 1,
        int pageSize = 20,
        bool canViewCosts = true,
        CancellationToken ct = default)
    {
        var validPage = page < 1 ? 1 : page;
        var validPageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var query = _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .AsQueryable();

        if (categoryId.HasValue && categoryId.Value != Guid.Empty)
        {
            query = query.Where(p => p.CategoryId == categoryId.Value);
        }

        if (lowStockOnly.HasValue && lowStockOnly.Value)
        {
            query = query.Where(p => p.MinimumStock != null && p.StockQuantity <= p.MinimumStock.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(s) ||
                p.Sku.ToLower().Contains(s) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderBy(p => p.Name)
            .Skip((validPage - 1) * validPageSize)
            .Take(validPageSize)
            .Select(p => new InventoryItemDto(
                p.Id,
                p.Sku,
                p.Barcode,
                p.Name,
                p.Category.Name,
                p.BaseUnit,
                p.StockQuantity,
                p.MinimumStock,
                canViewCosts ? p.AverageCost : null,
                p.SalePrice,
                p.MinimumStock != null && p.StockQuantity <= p.MinimumStock.Value,
                p.IsActive
            ))
            .ToListAsync(ct);

        return new PagedResult<InventoryItemDto>(items, totalCount, validPage, validPageSize);
    }

    public async Task<PagedResult<StockMovementDto>> GetStockMovementsAsync(
        Guid? productId = null,
        string? movementType = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var validPage = page < 1 ? 1 : page;
        var validPageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var query = _db.StockMovements
            .AsNoTracking()
            .Include(m => m.Product)
            .Include(m => m.CreatedBy)
            .AsQueryable();

        if (productId.HasValue && productId.Value != Guid.Empty)
        {
            query = query.Where(m => m.ProductId == productId.Value);
        }

        if (!string.IsNullOrWhiteSpace(movementType))
        {
            if (Enum.TryParse<StockMovementType>(movementType, true, out var parsedType))
            {
                query = query.Where(m => m.MovementType == parsedType);
            }
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip((validPage - 1) * validPageSize)
            .Take(validPageSize)
            .Select(m => new StockMovementDto(
                m.Id,
                m.ProductId,
                m.Product.Sku,
                m.Product.Name,
                m.MovementType.ToString(),
                m.QuantityDelta,
                m.QuantityAfter,
                m.UnitCostSnapshot,
                m.ReferenceType,
                m.ReferenceId,
                m.Reason,
                m.CreatedById,
                m.CreatedBy.FullName,
                m.CreatedAt
            ))
            .ToListAsync(ct);

        return new PagedResult<StockMovementDto>(items, totalCount, validPage, validPageSize);
    }

    public async Task<StockMovementDto> CreateManualAdjustmentAsync(
        ManualAdjustmentRequest request,
        Guid currentUserId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BusinessRuleException("El motivo del ajuste de inventario es obligatorio.");
        }

        if (request.QuantityDelta == 0)
        {
            throw new BusinessRuleException("La cantidad delta a ajustar no puede ser cero.");
        }

        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId, ct);
        if (product == null)
        {
            throw new NotFoundException($"Producto con ID '{request.ProductId}' no encontrado.");
        }

        var newStock = product.StockQuantity + request.QuantityDelta;

        // Prohibición de stock negativo
        if (newStock < 0)
        {
            throw new BusinessRuleException($"El ajuste solicitado dejaría las existencias en negativo ({newStock:F4} {product.BaseUnit}). Operación rechazada.");
        }

        var now = DateTime.UtcNow;
        var movementType = request.QuantityDelta > 0 ? StockMovementType.ManualIn : StockMovementType.ManualOut;

        product.StockQuantity = newStock;
        product.UpdatedAt = now;

        var movement = new StockMovement
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            MovementType = movementType,
            QuantityDelta = request.QuantityDelta,
            QuantityAfter = newStock,
            UnitCostSnapshot = product.AverageCost,
            ReferenceType = "ManualAdjustment",
            ReferenceId = null,
            Reason = request.Reason.Trim(),
            CreatedById = currentUserId,
            CreatedAt = now
        };

        _db.StockMovements.Add(movement);

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = currentUserId,
            Action = "INVENTORY_MANUAL_ADJUSTMENT",
            EntityType = "Product",
            EntityId = product.Id,
            Reason = request.Reason.Trim(),
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);

        var user = await _db.Users.FindAsync(new object[] { currentUserId }, ct);

        return new StockMovementDto(
            movement.Id,
            product.Id,
            product.Sku,
            product.Name,
            movementType.ToString(),
            movement.QuantityDelta,
            movement.QuantityAfter,
            movement.UnitCostSnapshot,
            movement.ReferenceType,
            movement.ReferenceId,
            movement.Reason,
            currentUserId,
            user?.FullName ?? string.Empty,
            movement.CreatedAt
        );
    }
}
