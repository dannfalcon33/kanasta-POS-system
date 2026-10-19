using Kanasta.Application.Common;
using Kanasta.Application.Purchases;

namespace Kanasta.Application.Abstractions;

public interface IPurchaseService
{
    Task<PagedResult<PurchaseSummaryDto>> GetPurchasesAsync(
        string? status = null,
        Guid? supplierId = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default);

    Task<PurchaseDto> GetPurchaseByIdAsync(Guid id, CancellationToken ct = default);

    Task<PurchaseDto> CreatePurchaseAsync(CreatePurchaseRequest request, Guid currentUserId, CancellationToken ct = default);

    Task<PurchaseDto> ReceivePurchaseAsync(Guid id, Guid currentUserId, CancellationToken ct = default);

    Task<PurchaseDto> CancelPurchaseAsync(Guid id, Guid currentUserId, string? reason, CancellationToken ct = default);
}
