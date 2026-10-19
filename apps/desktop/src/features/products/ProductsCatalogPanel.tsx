import React, { useState, useEffect, useCallback } from 'react';
import { api, ProductDto, CategoryDto, PagedResult } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { CategoriesModal } from './CategoriesModal';
import { ProductFormModal } from './ProductFormModal';

interface ProductsCatalogPanelProps {
  userRole: 'Admin' | 'Cashier';
}

export const ProductsCatalogPanel: React.FC<ProductsCatalogPanelProps> = ({ userRole }) => {
  const { t } = useLanguage();
  const isAdmin = userRole === 'Admin';

  const [productsData, setProductsData] = useState<PagedResult<ProductDto>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, active, inactive
  const [page, setPage] = useState(1);

  // Quick Barcode / SKU Scanner Simulation
  const [scannerInput, setScannerInput] = useState('');
  const [scannedProduct, setScannedProduct] = useState<ProductDto | null>(null);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);

  // Modals
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductDto | null>(null);
  const [isViewOnlyModal, setIsViewOnlyModal] = useState(false);

  const loadCategories = async () => {
    try {
      const cats = await api.getCategories(true);
      setCategories(cats);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const isActiveFilter =
        selectedStatus === 'active' ? true : selectedStatus === 'inactive' ? false : undefined;

      const data = await api.getProducts({
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        isActive: isActiveFilter,
        page,
        pageSize: 10,
      });

      setProductsData(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar productos del catálogo.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedStatus, page]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  const handleQuickScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = scannerInput.trim();
    if (!query) return;

    try {
      setScannerMessage(null);
      setScannedProduct(null);

      // Attempt barcode first, then SKU
      try {
        const found = await api.getProductByBarcode(query);
        setScannedProduct(found);
      } catch {
        const foundSku = await api.getProductBySku(query);
        setScannedProduct(foundSku);
      }
    } catch {
      setScannerMessage(`${t.catalog.productNotFoundQuery} "${query}".`);
    }
  };

  const handleToggleStatus = async (product: ProductDto) => {
    if (!isAdmin) return;
    try {
      await api.updateProductStatus(product.id, !product.isActive);
      await loadProducts();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado del producto.');
    }
  };

  const openCreateModal = () => {
    setProductToEdit(null);
    setIsViewOnlyModal(false);
    setShowProductModal(true);
  };

  const openEditModal = (product: ProductDto) => {
    setProductToEdit(product);
    setIsViewOnlyModal(false);
    setShowProductModal(true);
  };

  const openViewModal = (product: ProductDto) => {
    setProductToEdit(product);
    setIsViewOnlyModal(true);
    setShowProductModal(true);
  };

  // Stats calculation
  const totalInView = productsData.totalCount;
  const lowStockCount = productsData.items.filter(
    (p) => p.minimumStock !== null && p.stockQuantity <= p.minimumStock
  ).length;

  return (
    <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header and Title */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t.catalog.title}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {isAdmin ? t.catalog.subtitleAdmin : t.catalog.subtitleCashier}
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowCategoriesModal(true)}
              style={{
                padding: '0.6rem 1.1rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              🏷️ {t.catalog.btnCategories} ({categories.length})
            </button>

            <button
              onClick={openCreateModal}
              style={{
                padding: '0.6rem 1.25rem',
                backgroundColor: 'var(--brand-green)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-brand)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              + {t.catalog.btnNewProduct}
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {t.catalog.kpiTotalRegistered}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {totalInView}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {t.catalog.kpiActiveCategories}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {categories.filter((c) => c.isActive).length}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {t.catalog.kpiCriticalStockAlerts}
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: lowStockCount > 0 ? 'var(--warning)' : 'var(--success)',
            }}
          >
            {lowStockCount}
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {t.catalog.kpiCatalogCurrency}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            USD ($)
          </div>
        </div>
      </div>

      {/* Quick Scanner Simulation Box */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🔍 {t.catalog.scanSimulatorTitle}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t.catalog.scanSimulatorDesc}
          </span>
        </div>

        <form onSubmit={handleQuickScan} style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            placeholder={t.catalog.scanPlaceholder}
            style={{
              flex: 1,
              padding: '0.55rem 0.85rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.55rem 1.2rem',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {t.catalog.btnSearchCode}
          </button>
        </form>

        {scannerMessage && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
            ⚠️ {scannerMessage}
          </div>
        )}

        {scannedProduct && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                {scannedProduct.name}
              </span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                ({scannedProduct.sku})
              </span>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {t.catalog.category}: <strong>{scannedProduct.categoryName}</strong> | {t.common.unit}: <strong>{scannedProduct.baseUnit}</strong> | {t.catalog.stock}: <strong>{scannedProduct.stockQuantity}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                ${scannedProduct.salePrice.toFixed(2)} USD
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {scannedProduct.taxRateName ? `${scannedProduct.taxRateName} (${(scannedProduct.taxRate! * 100).toFixed(0)}%)` : t.catalog.exemptTax}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 240px', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.catalog.searchPlaceholder}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 0.9rem',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {t.common.filter}
          </button>
        </form>

        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            minWidth: '160px',
          }}
        >
          <option value="">{t.catalog.filterAllCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            minWidth: '130px',
          }}
        >
          <option value="all">{t.catalog.filterAllStatus}</option>
          <option value="active">{t.catalog.filterActive}</option>
          <option value="inactive">{t.catalog.filterInactive}</option>
        </select>
      </div>

      {/* Main Table */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colSku}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colProduct}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colCategory}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colUnit}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colPrice}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {t.catalog.colCost} {!isAdmin && '🔒'}
                </th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colStock}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colTax}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.catalog.colStatus}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>
                  {t.catalog.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.catalog.loadingProducts}
                  </td>
                </tr>
              ) : productsData.items.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.catalog.noProductsFound}
                  </td>
                </tr>
              ) : (
                productsData.items.map((prod) => {
                  const isLowStock = prod.minimumStock !== null && prod.stockQuantity <= prod.minimumStock;
                  const isOutOfStock = prod.stockQuantity <= 0;

                  return (
                    <tr
                      key={prod.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        opacity: prod.isActive ? 1 : 0.6,
                      }}
                    >
                      {/* SKU / Barcode */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {prod.sku}
                        </div>
                        {prod.barcode && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {prod.barcode}
                          </div>
                        )}
                      </td>

                      {/* Name / Description */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                        {prod.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prod.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {prod.categoryName || t.catalog.uncategorized}
                        </span>
                      </td>

                      {/* Base Unit */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {prod.baseUnit}
                      </td>

                      {/* Sale Price */}
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        ${prod.salePrice.toFixed(2)}
                      </td>

                      {/* Cost */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {isAdmin ? (
                          prod.averageCost !== null ? (
                            <div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                ${prod.averageCost.toFixed(2)}
                              </div>
                              {prod.salePrice > 0 && prod.averageCost > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>
                                  +{(((prod.salePrice - prod.averageCost) / prod.salePrice) * 100).toFixed(0)}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.2rem 0.45rem',
                              backgroundColor: 'rgba(100, 116, 139, 0.15)',
                              color: 'var(--text-muted)',
                              borderRadius: '4px',
                            }}
                          >
                            {t.catalog.protectedCost}
                          </span>
                        )}
                      </td>

                      {/* Stock Quantity */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              color: isOutOfStock
                                ? 'var(--danger)'
                                : isLowStock
                                ? 'var(--warning)'
                                : 'var(--success)',
                            }}
                          >
                            {prod.stockQuantity}
                          </span>
                          {isOutOfStock ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }} title={t.catalog.outOfStockBadge}>
                              ({t.catalog.outOfStockBadge})
                            </span>
                          ) : isLowStock ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--warning)' }} title={t.catalog.lowStockBadge}>
                              ⚠️
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Tax Rate */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {prod.taxRate !== null && prod.taxRate !== undefined
                          ? `${(prod.taxRate * 100).toFixed(1)}%`
                          : t.pos.taxExempt}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: prod.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: prod.isActive ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 600,
                          }}
                        >
                          {prod.isActive ? t.common.active : t.common.inactive}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {isAdmin ? (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => openEditModal(prod)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--accent-primary)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              {t.catalog.btnEdit}
                            </button>
                            <button
                              onClick={() => handleToggleStatus(prod)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: prod.isActive ? 'var(--danger)' : 'var(--success)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              {prod.isActive ? t.common.deactivate : t.common.activate}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openViewModal(prod)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--accent-primary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {t.common.view}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            {t.common.page} <strong>{productsData.page}</strong> {t.common.of} <strong>{Math.max(productsData.totalPages, 1)}</strong> ({productsData.totalCount} {t.common.items})
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={!productsData.hasPreviousPage || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: !productsData.hasPreviousPage ? 'not-allowed' : 'pointer',
                opacity: !productsData.hasPreviousPage ? 0.5 : 1,
              }}
            >
              &larr; {t.common.previous}
            </button>
            <button
              disabled={!productsData.hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: !productsData.hasNextPage ? 'not-allowed' : 'pointer',
                opacity: !productsData.hasNextPage ? 0.5 : 1,
              }}
            >
              {t.common.next} &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CategoriesModal
        isOpen={showCategoriesModal}
        onClose={() => setShowCategoriesModal(false)}
        onCategoriesChanged={() => {
          loadCategories();
          loadProducts();
        }}
      />

      <ProductFormModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onProductSaved={() => {
          loadProducts();
        }}
        productToEdit={productToEdit}
        readOnly={isViewOnlyModal}
      />
    </div>
  );
};
