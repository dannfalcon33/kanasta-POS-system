import React, { useState, useEffect, useCallback } from 'react';
import { api, InventoryItemDto, StockMovementDto, PagedResult } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';

interface InventoryPanelProps {
  userRole: 'Admin' | 'Cashier';
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ userRole }) => {
  const { t } = useLanguage();
  const isAdmin = userRole === 'Admin';
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements'>('stock');

  // Inventory Stock State
  const [inventoryData, setInventoryData] = useState<PagedResult<InventoryItemDto>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Stock Movements State
  const [movementsData, setMovementsData] = useState<PagedResult<StockMovementDto>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementsPage, setMovementsPage] = useState(1);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Manual Adjustment Modal State
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [selectedProductForAdj, setSelectedProductForAdj] = useState<InventoryItemDto | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    try {
      setLoadingStock(true);
      setStockError(null);
      const data = await api.getInventory({
        search: search.trim() || undefined,
        lowStockOnly: lowStockFilter || undefined,
        page: stockPage,
        pageSize: 10,
      });
      setInventoryData(data);
    } catch (err: any) {
      setStockError(err.message || 'Error al cargar inventario.');
    } finally {
      setLoadingStock(false);
    }
  }, [search, lowStockFilter, stockPage]);

  const loadMovements = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingMovements(true);
      const data = await api.getStockMovements({
        movementType: movementTypeFilter || undefined,
        page: movementsPage,
        pageSize: 10,
      });
      setMovementsData(data);
    } catch (err: any) {
      console.error('Error loading stock movements:', err);
    } finally {
      setLoadingMovements(false);
    }
  }, [isAdmin, movementTypeFilter, movementsPage]);

  useEffect(() => {
    if (activeSubTab === 'stock') {
      loadInventory();
    } else if (activeSubTab === 'movements') {
      loadMovements();
    }
  }, [activeSubTab, loadInventory, loadMovements]);

  const openAdjustmentModal = (item: InventoryItemDto) => {
    setSelectedProductForAdj(item);
    setAdjustmentDelta('');
    setAdjustmentReason('');
    setAdjustmentError(null);
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdj) return;

    const deltaNum = parseFloat(adjustmentDelta);
    if (isNaN(deltaNum) || deltaNum === 0) {
      setAdjustmentError('La cantidad delta a ajustar no puede ser cero.');
      return;
    }

    if (!adjustmentReason.trim()) {
      setAdjustmentError('El motivo del ajuste es obligatorio.');
      return;
    }

    const projectedStock = selectedProductForAdj.stockQuantity + deltaNum;
    if (projectedStock < 0) {
      setAdjustmentError(`Operación rechazada: el ajuste generaría stock negativo (${projectedStock.toFixed(2)} ${selectedProductForAdj.baseUnit}).`);
      return;
    }

    try {
      setSubmittingAdjustment(true);
      setAdjustmentError(null);
      await api.createManualAdjustment({
        productId: selectedProductForAdj.productId,
        quantityDelta: deltaNum,
        reason: adjustmentReason.trim(),
      });
      setShowAdjustmentModal(false);
      await loadInventory();
      if (isAdmin) loadMovements();
    } catch (err: any) {
      setAdjustmentError(err.message || 'Error al procesar el ajuste.');
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  // KPI calculations
  const totalValuation = inventoryData.items.reduce(
    (acc, curr) => acc + (curr.averageCost ? curr.averageCost * curr.stockQuantity : 0),
    0
  );

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
            {t.inventory.title}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {isAdmin ? t.inventory.subtitleAdmin : t.inventory.subtitleCashier}
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveSubTab('stock')}
              style={{
                padding: '0.55rem 1.15rem',
                backgroundColor: activeSubTab === 'stock' ? 'var(--brand-green)' : '#ffffff',
                color: activeSubTab === 'stock' ? '#ffffff' : 'var(--text-secondary)',
                border: activeSubTab === 'stock' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'stock' ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
              }}
            >
              {t.inventory.subtabStock}
            </button>
            <button
              onClick={() => setActiveSubTab('movements')}
              style={{
                padding: '0.55rem 1.15rem',
                backgroundColor: activeSubTab === 'movements' ? 'var(--brand-green)' : '#ffffff',
                color: activeSubTab === 'movements' ? '#ffffff' : 'var(--text-secondary)',
                border: activeSubTab === 'movements' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: activeSubTab === 'movements' ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
              }}
            >
              {t.inventory.subtabKardex}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
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
            {t.inventory.kpiTotalItems}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {inventoryData.totalCount}
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
            {t.inventory.kpiLowStockAlerts}
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: inventoryData.items.some((i) => i.isLowStock) ? 'var(--warning)' : 'var(--success)',
            }}
          >
            {inventoryData.items.filter((i) => i.isLowStock).length}
          </div>
        </div>

        {isAdmin && (
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {t.inventory.kpiValuationUsd}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              ${totalValuation.toFixed(2)}
            </div>
          </div>
        )}

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            {t.inventory.kpiStockPolicy}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>
            {t.inventory.kpiNoNegativeStock}
          </div>
        </div>
      </div>

      {/* SUB-TAB: STOCK ACTUAL */}
      {activeSubTab === 'stock' && (
        <>
          {/* Filters */}
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
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setStockPage(1);
              }}
              placeholder={t.inventory.searchInventoryPlaceholder}
              style={{
                flex: '1 1 250px',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => {
                  setLowStockFilter(e.target.checked);
                  setStockPage(1);
                }}
              />
              {t.inventory.filterLowStockOnly}
            </label>
          </div>

          {stockError && (
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
              {stockError}
            </div>
          )}

          {/* Table */}
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
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colSku}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colProduct}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colCategory}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colUnit}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colCurrentStock}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colMinStock}</th>
                    {isAdmin && (
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {t.inventory.colWeightedCost}
                      </th>
                    )}
                    {isAdmin && (
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {t.inventory.colTotalValue}
                      </th>
                    )}
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colStatus}</th>
                    {isAdmin && (
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>
                        {t.inventory.colAction}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loadingStock ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t.inventory.loadingInventory}
                      </td>
                    </tr>
                  ) : inventoryData.items.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t.inventory.noInventoryFound}
                      </td>
                    </tr>
                  ) : (
                    inventoryData.items.map((item) => {
                      const isOutOfStock = item.stockQuantity <= 0;
                      return (
                        <tr key={item.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {item.sku}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.productName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {item.categoryName}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {item.baseUnit}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: isOutOfStock
                                  ? 'var(--danger)'
                                  : item.isLowStock
                                  ? 'var(--warning)'
                                  : 'var(--success)',
                              }}
                            >
                              {item.stockQuantity} {item.baseUnit}
                            </span>
                            {item.isLowStock && !isOutOfStock && (
                              <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', color: 'var(--warning)' }}>
                                {t.inventory.badgeLow}
                              </span>
                            )}
                            {isOutOfStock && (
                              <span style={{ marginLeft: '0.3rem', fontSize: '0.75rem', color: 'var(--danger)' }}>
                                {t.inventory.badgeOut}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {item.minimumStock !== null ? `${item.minimumStock} ${item.baseUnit}` : '-'}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>
                              {item.averageCost !== null ? `$${item.averageCost.toFixed(4)}` : '-'}
                            </td>
                          )}
                          {isAdmin && (
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                              {item.averageCost !== null ? `$${(item.averageCost * item.stockQuantity).toFixed(2)}` : '-'}
                            </td>
                          )}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '12px',
                                backgroundColor: item.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: item.isActive ? 'var(--success)' : 'var(--danger)',
                                fontWeight: 600,
                              }}
                            >
                              {item.isActive ? t.common.active : t.common.inactive}
                            </span>
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <button
                                onClick={() => openAdjustmentModal(item)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--accent-primary)',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {t.inventory.adjustBtn}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                {t.common.page} <strong>{inventoryData.page}</strong> {t.common.of} <strong>{Math.max(inventoryData.totalPages, 1)}</strong> ({inventoryData.totalCount} {t.pos.items})
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={!inventoryData.hasPreviousPage || loadingStock}
                  onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    cursor: !inventoryData.hasPreviousPage ? 'not-allowed' : 'pointer',
                    opacity: !inventoryData.hasPreviousPage ? 0.5 : 1,
                  }}
                >
                  &larr; {t.common.previous}
                </button>
                <button
                  disabled={!inventoryData.hasNextPage || loadingStock}
                  onClick={() => setStockPage((p) => p + 1)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    cursor: !inventoryData.hasNextPage ? 'not-allowed' : 'pointer',
                    opacity: !inventoryData.hasNextPage ? 0.5 : 1,
                  }}
                >
                  {t.common.next} &rarr;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SUB-TAB: HISTORIAL DE MOVIMIENTOS (KARDEX APPEND-ONLY) */}
      {activeSubTab === 'movements' && isAdmin && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
            }}
          >
            <select
              value={movementTypeFilter}
              onChange={(e) => {
                setMovementTypeFilter(e.target.value);
                setMovementsPage(1);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                minWidth: '220px',
              }}
            >
              <option value="">{t.inventory.filterAllTypes}</option>
              <option value="PurchaseIn">{t.inventory.typePurchase}</option>
              <option value="ManualIn">{t.inventory.typeManualIn}</option>
              <option value="ManualOut">{t.inventory.typeManualOut}</option>
              <option value="SaleOut">{t.inventory.typeSale}</option>
            </select>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t.inventory.kardexNotice}
            </span>
          </div>

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
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colDate}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colProduct}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colMovementType}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colDelta}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colNewStock}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colCostSnapshot}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colReason}</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.inventory.colUser}</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t.inventory.loadingMovements}
                      </td>
                    </tr>
                  ) : movementsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {t.inventory.noMovementsFound}
                      </td>
                    </tr>
                  ) : (
                    movementsData.items.map((m) => {
                      const isPositive = m.quantityDelta > 0;
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.productName}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {m.productSku}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isPositive ? 'var(--success)' : 'var(--danger)',
                                fontWeight: 600,
                              }}
                            >
                              {m.movementType}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                            {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {m.quantityAfter}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {m.unitCostSnapshot !== null ? `$${m.unitCostSnapshot.toFixed(4)}` : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {m.reason || '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {m.createdByName}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Movements */}
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
                {t.common.page} <strong>{movementsData.page}</strong> {t.common.of} <strong>{Math.max(movementsData.totalPages, 1)}</strong> ({movementsData.totalCount} {t.pos.items})
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  disabled={!movementsData.hasPreviousPage || loadingMovements}
                  onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    cursor: !movementsData.hasPreviousPage ? 'not-allowed' : 'pointer',
                    opacity: !movementsData.hasPreviousPage ? 0.5 : 1,
                  }}
                >
                  &larr; {t.common.previous}
                </button>
                <button
                  disabled={!movementsData.hasNextPage || loadingMovements}
                  onClick={() => setMovementsPage((p) => p + 1)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    cursor: !movementsData.hasNextPage ? 'not-allowed' : 'pointer',
                    opacity: !movementsData.hasNextPage ? 0.5 : 1,
                  }}
                >
                  {t.common.next} &rarr;
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual Adjustment Modal */}
      {showAdjustmentModal && selectedProductForAdj && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdjustmentModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t.inventory.adjustModalTitle}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedProductForAdj.productName} ({selectedProductForAdj.sku})
                </p>
              </div>
              <button
                onClick={() => setShowAdjustmentModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {adjustmentError && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {adjustmentError}
              </div>
            )}

            <form onSubmit={handleAdjustmentSubmit}>
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.inventory.currentStockLabel}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {selectedProductForAdj.stockQuantity} {selectedProductForAdj.baseUnit}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.inventory.adjustQtyDelta}
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={adjustmentDelta}
                  onChange={(e) => setAdjustmentDelta(e.target.value)}
                  placeholder="Ej: +10 o -2.5"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                />
                {adjustmentDelta && !isNaN(parseFloat(adjustmentDelta)) && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {t.inventory.projectedStockLabel}:{' '}
                    <strong>
                      {(selectedProductForAdj.stockQuantity + parseFloat(adjustmentDelta)).toFixed(4)}{' '}
                      {selectedProductForAdj.baseUnit}
                    </strong>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.inventory.adjustReasonLabel}
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder={t.inventory.adjustReasonPlaceholder}
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjustment}
                  style={{
                    padding: '0.55rem 1.35rem',
                    backgroundColor: 'var(--brand-green)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: submittingAdjustment ? 'not-allowed' : 'pointer',
                    boxShadow: 'var(--shadow-brand)',
                  }}
                >
                  {submittingAdjustment ? t.inventory.submittingAdjustment : t.inventory.applyAdjustmentBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
