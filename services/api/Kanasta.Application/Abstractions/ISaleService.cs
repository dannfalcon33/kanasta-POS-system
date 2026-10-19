using Kanasta.Application.Common;
using Kanasta.Application.Sales;

namespace Kanasta.Application.Abstractions;

public interface ISaleService
{
    Task<SaleDetailDto> CreateSaleAsync(CreateSaleRequest request, Guid cashierId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<PagedResult<SaleDto>> GetSalesAsync(SaleQueryParams queryParams, Guid currentUserId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<SaleDetailDto> GetSaleByIdAsync(Guid saleId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<SaleDetailDto> VoidSaleAsync(Guid saleId, VoidSaleRequest request, Guid voidedById, CancellationToken cancellationToken = default);
}
