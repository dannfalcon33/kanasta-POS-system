using Kanasta.Application.Common;
using Kanasta.Application.Inventory;

namespace Kanasta.Application.Abstractions;

public interface IInventoryService
{
    Task<PagedResult<InventoryItemDto>> GetInventoryAsync(
        string? search = null,
        Guid? categoryId = null,
        bool? lowStockOnly = null,
        int page = 1,
        int pageSize = 20,
        bool canViewCosts = true,
        CancellationToken ct = default);

    Task<PagedResult<StockMovementDto>> GetStockMovementsAsync(
        Guid? productId = null,
        string? movementType = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default);

    Task<StockMovementDto> CreateManualAdjustmentAsync(
        ManualAdjustmentRequest request,
        Guid currentUserId,
        CancellationToken ct = default);
}
