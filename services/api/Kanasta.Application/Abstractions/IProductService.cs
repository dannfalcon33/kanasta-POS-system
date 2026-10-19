using Kanasta.Application.Catalog;
using Kanasta.Application.Common;

namespace Kanasta.Application.Abstractions;

public interface IProductService
{
    Task<PagedResult<ProductDto>> GetProductsAsync(ProductQueryParams query, bool canViewCosts, CancellationToken ct = default);
    Task<ProductDto> GetProductByIdAsync(Guid id, bool canViewCosts, CancellationToken ct = default);
    Task<ProductDto> GetProductByBarcodeAsync(string barcode, bool canViewCosts, CancellationToken ct = default);
    Task<ProductDto> GetProductBySkuAsync(string sku, bool canViewCosts, CancellationToken ct = default);
    Task<ProductDto> CreateProductAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateProductAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateProductStatusAsync(Guid id, bool isActive, CancellationToken ct = default);
}
