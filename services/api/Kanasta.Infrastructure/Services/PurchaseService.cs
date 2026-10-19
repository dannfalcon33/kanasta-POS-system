using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Purchases;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class PurchaseService : IPurchaseService
{
    private readonly KanastaDbContext _db;

    public PurchaseService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<PurchaseSummaryDto>> GetPurchasesAsync(
        string? status = null,
        Guid? supplierId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var validPage = page < 1 ? 1 : page;
        var validPageSize = pageSize < 1 ? 20 : Math.Min(pageSize, 100);

        var query = _db.Purchases
            .AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.CreatedBy)
            .Include(p => p.Items)
            .AsQueryable();

        if (supplierId.HasValue && supplierId.Value != Guid.Empty)
        {
            query = query.Where(p => p.SupplierId == supplierId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<PurchaseStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(p => p.Status == parsedStatus);
            }
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(p => p.PurchasedAt)
            .Skip((validPage - 1) * validPageSize)
            .Take(validPageSize)
            .Select(p => new PurchaseSummaryDto(
                p.Id,
                p.PurchaseNumber,
                p.SupplierId,
                p.Supplier.Name,
                p.CreatedBy.FullName,
                p.Status.ToString(),
                p.PurchasedAt,
                p.ReceivedAt,
                p.Total,
                p.Items.Count,
                p.CreatedAt
            ))
            .ToListAsync(ct);

        return new PagedResult<PurchaseSummaryDto>(items, totalCount, validPage, validPageSize);
    }

    public async Task<PurchaseDto> GetPurchaseByIdAsync(Guid id, CancellationToken ct = default)
    {
        var purchase = await _db.Purchases
            .AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.CreatedBy)
            .Include(p => p.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (purchase == null)
        {
            throw new NotFoundException($"Compra con ID '{id}' no encontrada.");
        }

        return MapToDto(purchase);
    }

    public async Task<PurchaseDto> CreatePurchaseAsync(CreatePurchaseRequest request, Guid currentUserId, CancellationToken ct = default)
    {
        var supplier = await _db.Suppliers.FindAsync(new object[] { request.SupplierId }, ct);
        if (supplier == null)
        {
            throw new NotFoundException($"El proveedor con ID '{request.SupplierId}' no existe.");
        }

        if (!supplier.IsActive)
        {
            throw new BusinessRuleException("No se pueden registrar compras a un proveedor inactivo.");
        }

        if (request.Items == null || request.Items.Count == 0)
        {
            throw new BusinessRuleException("La compra debe incluir al menos un producto.");
        }

        var purchaseId = Guid.NewGuid();
        var purchaseNumber = string.IsNullOrWhiteSpace(request.PurchaseNumber)
            ? $"PUR-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}"
            : request.PurchaseNumber.Trim().ToUpperInvariant();

        var numberExists = await _db.Purchases.AnyAsync(p => p.PurchaseNumber == purchaseNumber, ct);
        if (numberExists)
        {
            throw new ConflictException($"Ya existe una compra con el número '{purchaseNumber}'.");
        }

        decimal subtotal = 0m;
        decimal taxTotal = 0m;
        var purchaseItems = new List<PurchaseItem>();

        foreach (var itemReq in request.Items)
        {
            var product = await _db.Products.FindAsync(new object[] { itemReq.ProductId }, ct);
            if (product == null)
            {
                throw new NotFoundException($"El producto con ID '{itemReq.ProductId}' no existe.");
            }

            if (itemReq.Quantity <= 0)
            {
                throw new BusinessRuleException($"La cantidad para '{product.Name}' debe ser mayor a 0.");
            }

            if (itemReq.UnitCost < 0)
            {
                throw new BusinessRuleException($"El costo unitario para '{product.Name}' no puede ser negativo.");
            }

            var lineSubtotal = Math.Round(itemReq.Quantity * itemReq.UnitCost, 2);
            var lineTax = Math.Round(lineSubtotal * itemReq.TaxRateSnapshot, 2);
            var lineTotal = lineSubtotal + lineTax;

            subtotal += lineSubtotal;
            taxTotal += lineTax;

            purchaseItems.Add(new PurchaseItem
            {
                Id = Guid.NewGuid(),
                PurchaseId = purchaseId,
                ProductId = itemReq.ProductId,
                Quantity = itemReq.Quantity,
                UnitCost = itemReq.UnitCost,
                TaxRateSnapshot = itemReq.TaxRateSnapshot,
                LineSubtotal = lineSubtotal,
                LineTax = lineTax,
                LineTotal = lineTotal
            });
        }

        var total = subtotal + taxTotal;

        var purchase = new Purchase
        {
            Id = purchaseId,
            PurchaseNumber = purchaseNumber,
            SupplierId = request.SupplierId,
            CreatedById = currentUserId,
            Status = PurchaseStatus.Draft,
            PurchasedAt = request.PurchasedAt ?? DateTime.UtcNow,
            Subtotal = subtotal,
            TaxTotal = taxTotal,
            Total = total,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Items = purchaseItems,
            CreatedAt = DateTime.UtcNow
        };

        _db.Purchases.Add(purchase);
        await _db.SaveChangesAsync(ct);

        return await GetPurchaseByIdAsync(purchase.Id, ct);
    }

    public async Task<PurchaseDto> ReceivePurchaseAsync(Guid id, Guid currentUserId, CancellationToken ct = default)
    {
        var purchase = await _db.Purchases
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (purchase == null)
        {
            throw new NotFoundException($"Compra con ID '{id}' no encontrada.");
        }

        // --- IDEMPOTENCIA ESTRICTA ---
        if (purchase.Status == PurchaseStatus.Received)
        {
            throw new BusinessRuleException("La compra ya fue recibida anteriormente y no puede procesarse nuevamente.");
        }

        if (purchase.Status == PurchaseStatus.Cancelled)
        {
            throw new BusinessRuleException("Una compra cancelada no puede recibirse físicamente.");
        }

        var now = DateTime.UtcNow;

        foreach (var item in purchase.Items)
        {
            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
            if (product == null)
            {
                throw new NotFoundException($"Producto con ID '{item.ProductId}' no encontrado para actualizar inventario.");
            }

            var oldStock = product.StockQuantity;
            var oldCost = product.AverageCost;
            var qPurchased = item.Quantity;
            var unitCost = item.UnitCost;
            var newStock = oldStock + qPurchased;

            // Recálculo de costo promedio ponderado
            decimal newAverageCost;
            if (oldStock <= 0)
            {
                newAverageCost = unitCost;
            }
            else
            {
                var totalValuation = (oldStock * oldCost) + (qPurchased * unitCost);
                newAverageCost = Math.Round(totalValuation / newStock, 4);
            }

            product.StockQuantity = newStock;
            product.AverageCost = newAverageCost;
            product.UpdatedAt = now;

            // Registro histórico append-only de movimiento
            var movement = new StockMovement
            {
                Id = Guid.NewGuid(),
                ProductId = product.Id,
                MovementType = StockMovementType.PurchaseIn,
                QuantityDelta = qPurchased,
                QuantityAfter = newStock,
                UnitCostSnapshot = unitCost,
                ReferenceType = "Purchase",
                ReferenceId = purchase.Id,
                Reason = $"Recepción de compra {purchase.PurchaseNumber}",
                CreatedById = currentUserId,
                CreatedAt = now
            };

            _db.StockMovements.Add(movement);
        }

        purchase.Status = PurchaseStatus.Received;
        purchase.ReceivedAt = now;
        purchase.UpdatedAt = now;

        // Auditoría
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = currentUserId,
            Action = "PURCHASE_RECEIVED",
            EntityType = "Purchase",
            EntityId = purchase.Id,
            Reason = $"Compra {purchase.PurchaseNumber} recibida exitosamente en almacén.",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);

        return await GetPurchaseByIdAsync(purchase.Id, ct);
    }

    public async Task<PurchaseDto> CancelPurchaseAsync(Guid id, Guid currentUserId, string? reason, CancellationToken ct = default)
    {
        var purchase = await _db.Purchases.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (purchase == null)
        {
            throw new NotFoundException($"Compra con ID '{id}' no encontrada.");
        }

        if (purchase.Status != PurchaseStatus.Draft)
        {
            throw new BusinessRuleException($"Solo se pueden cancelar compras en estado Borrador (DRAFT). Estado actual: {purchase.Status}.");
        }

        var now = DateTime.UtcNow;
        purchase.Status = PurchaseStatus.Cancelled;
        purchase.UpdatedAt = now;

        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorUserId = currentUserId,
            Action = "PURCHASE_CANCELLED",
            EntityType = "Purchase",
            EntityId = purchase.Id,
            Reason = reason ?? "Cancelación de orden de compra antes de recepción.",
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);

        return await GetPurchaseByIdAsync(purchase.Id, ct);
    }

    private static PurchaseDto MapToDto(Purchase p)
    {
        return new PurchaseDto(
            p.Id,
            p.PurchaseNumber,
            p.SupplierId,
            p.Supplier?.Name ?? string.Empty,
            p.CreatedById,
            p.CreatedBy?.FullName ?? string.Empty,
            p.Status.ToString(),
            p.PurchasedAt,
            p.ReceivedAt,
            p.Subtotal,
            p.TaxTotal,
            p.Total,
            p.Notes,
            p.Items.Select(i => new PurchaseItemDto(
                i.Id,
                i.ProductId,
                i.Product?.Sku ?? string.Empty,
                i.Product?.Name ?? string.Empty,
                i.Product?.BaseUnit ?? "unidad",
                i.Quantity,
                i.UnitCost,
                i.TaxRateSnapshot,
                i.LineSubtotal,
                i.LineTax,
                i.LineTotal
            )).ToList(),
            p.CreatedAt,
            p.UpdatedAt
        );
    }
}
