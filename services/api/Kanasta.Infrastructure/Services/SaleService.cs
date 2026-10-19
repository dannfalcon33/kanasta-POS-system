using System.Text.Json;
using Kanasta.Application.Abstractions;
using Kanasta.Application.Common;
using Kanasta.Application.Exceptions;
using Kanasta.Application.Sales;
using Kanasta.Domain.Entities;
using Kanasta.Domain.Enums;
using Kanasta.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Kanasta.Infrastructure.Services;

public class SaleService : ISaleService
{
    private readonly KanastaDbContext _db;

    public SaleService(KanastaDbContext db)
    {
        _db = db;
    }

    public async Task<SaleDetailDto> CreateSaleAsync(CreateSaleRequest request, Guid cashierId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new BusinessRuleException("La venta debe incluir al menos un producto.");
        }

        var executionStrategy = _db.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(async () =>
        {
            var isRelational = _db.Database.IsRelational();
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
            if (isRelational)
            {
                tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            }

            try
            {

            var cashier = await _db.Users.FirstOrDefaultAsync(u => u.Id == cashierId, cancellationToken);
            if (cashier == null)
            {
                throw new NotFoundException($"Cajero con ID '{cashierId}' no encontrado.");
            }

            var saleId = Guid.NewGuid();
            var saleNumber = $"VTA-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}";
            var now = DateTime.UtcNow;

            decimal subtotal = 0m;
            decimal taxTotal = 0m;
            var saleItems = new List<SaleItem>();
            var stockMovements = new List<StockMovement>();

            foreach (var itemReq in request.Items)
            {
                if (itemReq.Quantity <= 0)
                {
                    throw new BusinessRuleException("La cantidad de cada producto debe ser mayor a 0.");
                }

                var product = await _db.Products
                    .Include(p => p.TaxRate)
                    .FirstOrDefaultAsync(p => p.Id == itemReq.ProductId, cancellationToken);

                if (product == null)
                {
                    throw new NotFoundException($"El producto con ID '{itemReq.ProductId}' no existe.");
                }

                if (!product.IsActive)
                {
                    throw new BusinessRuleException($"El producto '{product.Name}' está inactivo y no puede venderse.");
                }

                // --- VALIDACIÓN ESTRICTA DE STOCK (PROHIBIDO SALDO NEGATIVO) ---
                if (product.StockQuantity < itemReq.Quantity)
                {
                    throw new BusinessRuleException($"Stock insuficiente para el producto '{product.Name}'. Disponible: {product.StockQuantity}, Solicitado: {itemReq.Quantity}. La venta fue rechazada para evitar saldo negativo.");
                }

                var unitPrice = product.SalePrice;
                var unitCost = product.AverageCost;
                var taxRate = product.TaxRate != null && product.TaxRate.IsActive ? product.TaxRate.Rate : 0m;

                var lineSubtotal = Math.Round(itemReq.Quantity * unitPrice, 2, MidpointRounding.AwayFromZero);
                var lineTax = Math.Round(lineSubtotal * taxRate, 2, MidpointRounding.AwayFromZero);
                var lineTotal = lineSubtotal + lineTax;

                subtotal += lineSubtotal;
                taxTotal += lineTax;

                // Descuento de stock en producto
                product.StockQuantity -= itemReq.Quantity;
                product.UpdatedAt = now;

                var saleItem = new SaleItem
                {
                    Id = Guid.NewGuid(),
                    SaleId = saleId,
                    ProductId = product.Id,
                    SkuSnapshot = product.Sku,
                    ProductNameSnapshot = product.Name,
                    UnitSnapshot = product.BaseUnit,
                    Quantity = itemReq.Quantity,
                    UnitPrice = unitPrice,
                    DiscountAmount = 0m,
                    TaxRateSnapshot = taxRate,
                    TaxAmount = lineTax,
                    LineTotal = lineTotal,
                    UnitCostSnapshot = unitCost
                };
                saleItems.Add(saleItem);

                // Movimiento auditado de salida
                var movement = new StockMovement
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    MovementType = StockMovementType.SaleOut,
                    QuantityDelta = -itemReq.Quantity,
                    QuantityAfter = product.StockQuantity,
                    UnitCostSnapshot = unitCost,
                    ReferenceType = "Sale",
                    ReferenceId = saleId,
                    Reason = $"Venta {saleNumber}",
                    CreatedById = cashierId,
                    CreatedAt = now
                };
                stockMovements.Add(movement);
            }

            var discountTotal = Math.Max(0m, request.DiscountTotal);
            var grandTotal = Math.Max(0m, subtotal - discountTotal + taxTotal);

            if (request.PaymentAmount < grandTotal)
            {
                throw new BusinessRuleException($"El monto abonado ({request.PaymentAmount:F2} USD) no cubre el total de la venta ({grandTotal:F2} USD).");
            }

            var sale = new Sale
            {
                Id = saleId,
                SaleNumber = saleNumber,
                CashierId = cashierId,
                Status = SaleStatus.Completed,
                Subtotal = subtotal,
                DiscountTotal = discountTotal,
                TaxTotal = taxTotal,
                Total = grandTotal,
                CurrencyCode = "USD",
                CompletedAt = now,
                CreatedAt = now,
                Items = saleItems
            };

            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                SaleId = saleId,
                PaymentMethod = request.PaymentMethod,
                Amount = request.PaymentAmount,
                Reference = string.IsNullOrWhiteSpace(request.PaymentReference) ? null : request.PaymentReference.Trim(),
                PaidAt = now,
                ReceivedById = cashierId
            };
            sale.Payments.Add(payment);

            // Obtener o generar configuración de negocio para el comprobante
            var settings = await _db.BusinessSettings.FirstOrDefaultAsync(cancellationToken);
            var businessName = settings?.BusinessName ?? "Kanasta Minimarket";
            var taxId = settings?.TaxIdentifier ?? "J-12345678-0";
            var address = settings?.Address ?? "Caracas, Venezuela";
            var phone = settings?.Phone ?? "+58 212 5550000";

            var receiptSnapshotObj = new
            {
                Disclaimer = "DOCUMENTO INTERNO DE PRUEBA - NO FISCAL (Ambiente de evaluación MVP)",
                BusinessName = businessName,
                TaxIdentifier = taxId,
                Address = address,
                Phone = phone,
                Currency = "USD",
                SaleNumber = saleNumber,
                CashierName = cashier.FullName,
                IssuedAt = now.ToString("yyyy-MM-dd HH:mm:ss 'UTC'"),
                Subtotal = subtotal,
                DiscountTotal = discountTotal,
                TaxTotal = taxTotal,
                Total = grandTotal,
                PaymentMethod = request.PaymentMethod.ToString(),
                AmountPaid = request.PaymentAmount,
                Change = Math.Max(0m, request.PaymentAmount - grandTotal),
                Items = saleItems.Select(si => new
                {
                    si.ProductNameSnapshot,
                    si.SkuSnapshot,
                    si.Quantity,
                    si.UnitSnapshot,
                    si.UnitPrice,
                    TaxRatePercentage = si.TaxRateSnapshot * 100m,
                    si.TaxAmount,
                    si.LineTotal
                }).ToList()
            };

            var receipt = new Receipt
            {
                Id = Guid.NewGuid(),
                SaleId = saleId,
                DocumentNumber = $"REC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpperInvariant()}",
                DocumentType = "INTERNAL_TEST_RECEIPT",
                BusinessSnapshot = JsonSerializer.Serialize(receiptSnapshotObj, new JsonSerializerOptions { WriteIndented = true }),
                IssuedAt = now,
                DocumentStatus = "ISSUED"
            };
            sale.Receipt = receipt;

            _db.Sales.Add(sale);
            _db.StockMovements.AddRange(stockMovements);

            // Auditoría
            _db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = cashierId,
                Action = "SALE_COMPLETED",
                EntityType = "Sale",
                EntityId = saleId,
                Reason = $"Venta {saleNumber} registrada exitosamente por ${grandTotal:F2} USD.",
                CreatedAt = now
            });

            await _db.SaveChangesAsync(cancellationToken);
            if (tx != null)
            {
                await tx.CommitAsync(cancellationToken);
            }

            return MapToDetailDto(sale, cashier.FullName, isAdmin);
        }
        catch
        {
            if (tx != null)
            {
                await tx.RollbackAsync(cancellationToken);
            }
            throw;
        }
        finally
        {
            if (tx != null)
            {
                await tx.DisposeAsync();
            }
        }
        });
    }

    public async Task<PagedResult<SaleDto>> GetSalesAsync(SaleQueryParams queryParams, Guid currentUserId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        var query = _db.Sales
            .AsNoTracking()
            .Include(s => s.Cashier)
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .AsQueryable();

        // Control de acceso: Cajeros solo ven sus propias ventas
        if (!isAdmin)
        {
            query = query.Where(s => s.CashierId == currentUserId);
        }
        else if (queryParams.CashierId.HasValue)
        {
            query = query.Where(s => s.CashierId == queryParams.CashierId.Value);
        }

        if (queryParams.Status.HasValue)
        {
            query = query.Where(s => s.Status == queryParams.Status.Value);
        }

        if (queryParams.StartDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt >= queryParams.StartDate.Value);
        }

        if (queryParams.EndDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt <= queryParams.EndDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = queryParams.Page < 1 ? 1 : queryParams.Page;
        var pageSize = queryParams.PageSize < 1 ? 10 : queryParams.PageSize;

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new SaleDto(
                s.Id,
                s.SaleNumber,
                s.CashierId,
                s.Cashier.FullName,
                s.Status.ToString(),
                s.Subtotal,
                s.DiscountTotal,
                s.TaxTotal,
                s.Total,
                s.CurrencyCode,
                s.CompletedAt,
                s.VoidedAt,
                s.VoidReason,
                s.CreatedAt,
                s.Items.Count,
                s.Payments.Select(p => p.PaymentMethod.ToString()).FirstOrDefault() ?? "Cash",
                s.Payments.Select(p => p.Amount).FirstOrDefault(),
                s.Payments.Select(p => p.Reference).FirstOrDefault()
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<SaleDto>(items, totalCount, page, pageSize);
    }

    public async Task<SaleDetailDto> GetSaleByIdAsync(Guid saleId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        var sale = await _db.Sales
            .AsNoTracking()
            .Include(s => s.Cashier)
            .Include(s => s.VoidedBy)
            .Include(s => s.Items)
            .Include(s => s.Payments)
                .ThenInclude(p => p.ReceivedBy)
            .Include(s => s.Receipt)
            .FirstOrDefaultAsync(s => s.Id == saleId, cancellationToken);

        if (sale == null)
        {
            throw new NotFoundException($"Venta con ID '{saleId}' no encontrada.");
        }

        return MapToDetailDto(sale, sale.Cashier.FullName, isAdmin);
    }

    public async Task<SaleDetailDto> VoidSaleAsync(Guid saleId, VoidSaleRequest request, Guid voidedById, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BusinessRuleException("El motivo de la anulación es estrictamente obligatorio.");
        }

        var executionStrategy = _db.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(async () =>
        {
            var isRelational = _db.Database.IsRelational();
            Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? tx = null;
            if (isRelational)
            {
                tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            }

            try
            {

            var sale = await _db.Sales
                .Include(s => s.Cashier)
                .Include(s => s.Items)
                .Include(s => s.Payments)
                .Include(s => s.Receipt)
                .FirstOrDefaultAsync(s => s.Id == saleId, cancellationToken);

            if (sale == null)
            {
                throw new NotFoundException($"Venta con ID '{saleId}' no encontrada.");
            }

            if (sale.Status == SaleStatus.Voided)
            {
                throw new BusinessRuleException("La venta ya ha sido anulada anteriormente.");
            }

            if (sale.Status != SaleStatus.Completed)
            {
                throw new BusinessRuleException($"Solo se pueden anular ventas en estado 'Completed'. Estado actual: '{sale.Status}'.");
            }

            var now = DateTime.UtcNow;

            // Reversión de existencias y generación de movimientos SALE_REVERSAL_IN
            foreach (var item in sale.Items)
            {
                var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
                if (product != null)
                {
                    product.StockQuantity += item.Quantity;
                    product.UpdatedAt = now;

                    var reversalMovement = new StockMovement
                    {
                        Id = Guid.NewGuid(),
                        ProductId = product.Id,
                        MovementType = StockMovementType.SaleReversalIn,
                        QuantityDelta = item.Quantity,
                        QuantityAfter = product.StockQuantity,
                        UnitCostSnapshot = item.UnitCostSnapshot,
                        ReferenceType = "SaleVoid",
                        ReferenceId = sale.Id,
                        Reason = $"Anulación de venta {sale.SaleNumber}: {request.Reason.Trim()}",
                        CreatedById = voidedById,
                        CreatedAt = now
                    };
                    _db.StockMovements.Add(reversalMovement);
                }
            }

            sale.Status = SaleStatus.Voided;
            sale.VoidedAt = now;
            sale.VoidedById = voidedById;
            sale.VoidReason = request.Reason.Trim();

            if (sale.Receipt != null)
            {
                sale.Receipt.DocumentStatus = "VOIDED";
            }

            _db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorUserId = voidedById,
                Action = "SALE_VOIDED",
                EntityType = "Sale",
                EntityId = sale.Id,
                Reason = $"Venta {sale.SaleNumber} anulada: {request.Reason.Trim()}",
                CreatedAt = now
            });

            await _db.SaveChangesAsync(cancellationToken);
            if (tx != null)
            {
                await tx.CommitAsync(cancellationToken);
            }

            return MapToDetailDto(sale, sale.Cashier.FullName, isAdmin: true);
        }
        catch
        {
            if (tx != null)
            {
                await tx.RollbackAsync(cancellationToken);
            }
            throw;
        }
        finally
        {
            if (tx != null)
            {
                await tx.DisposeAsync();
            }
        }
        });
    }

    private static SaleDetailDto MapToDetailDto(Sale sale, string cashierName, bool isAdmin)
    {
        var primaryPayment = sale.Payments.FirstOrDefault();
        PaymentDto? paymentDto = null;
        if (primaryPayment != null)
        {
            paymentDto = new PaymentDto(
                primaryPayment.Id,
                primaryPayment.PaymentMethod.ToString(),
                primaryPayment.Amount,
                primaryPayment.Reference,
                primaryPayment.PaidAt,
                primaryPayment.ReceivedBy?.FullName ?? cashierName
            );
        }

        ReceiptDto? receiptDto = null;
        if (sale.Receipt != null)
        {
            receiptDto = new ReceiptDto(
                sale.Receipt.Id,
                sale.Receipt.DocumentNumber,
                sale.Receipt.DocumentType,
                sale.Receipt.BusinessSnapshot,
                sale.Receipt.IssuedAt,
                sale.Receipt.DocumentStatus
            );
        }

        var itemDtos = sale.Items.Select(i => new SaleItemDto(
            i.Id,
            i.ProductId,
            i.SkuSnapshot,
            i.ProductNameSnapshot,
            i.UnitSnapshot,
            i.Quantity,
            i.UnitPrice,
            i.DiscountAmount,
            i.TaxRateSnapshot,
            i.TaxAmount,
            i.LineTotal,
            // Confidencialidad de costos: oculto para rol cajero
            isAdmin ? i.UnitCostSnapshot : null
        )).ToList();

        return new SaleDetailDto(
            sale.Id,
            sale.SaleNumber,
            sale.CashierId,
            cashierName,
            sale.Status.ToString(),
            sale.Subtotal,
            sale.DiscountTotal,
            sale.TaxTotal,
            sale.Total,
            sale.CurrencyCode,
            sale.CompletedAt,
            sale.VoidedAt,
            sale.VoidReason,
            sale.CreatedAt,
            itemDtos,
            paymentDto,
            receiptDto
        );
    }
}
