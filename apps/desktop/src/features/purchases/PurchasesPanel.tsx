import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  PurchaseSummaryDto,
  PurchaseDto,
  SupplierDto,
  ProductDto,
  PagedResult,
} from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';

export const PurchasesPanel: React.FC = () => {
  const { t } = useLanguage();
  const [purchasesData, setPurchasesData] = useState<PagedResult<PurchaseSummaryDto>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<PurchaseDto | null>(null);
  const [receivingPurchase, setReceivingPurchase] = useState<PurchaseSummaryDto | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // New Purchase Form State
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newPurchaseNumber, setNewPurchaseNumber] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [purchaseLines, setPurchaseLines] = useState<
    Array<{ productId: string; quantity: number; unitCost: number; taxRateSnapshot: number }>
  >([]);

  // Suppliers Management State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierTaxId, setNewSupplierTaxId] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);
  const [supplierModalError, setSupplierModalError] = useState<string | null>(null);

  const loadSuppliers = async () => {
    try {
      const data = await api.getSuppliers(true);
      setSuppliers(data);
      if (data.length > 0 && !newSupplierId) {
        setNewSupplierId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error loading suppliers:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const paged = await api.getProducts({ page: 1, pageSize: 100 });
      setCatalogProducts(paged.items);
    } catch (err: any) {
      console.error('Error loading products:', err);
    }
  };

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPurchases({
        status: statusFilter || undefined,
        supplierId: supplierFilter || undefined,
        page,
        pageSize: 10,
      });
      setPurchasesData(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar compras.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, supplierFilter, page]);

  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, []);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const openNewPurchase = () => {
    setNewPurchaseNumber('');
    setNewNotes('');
    if (suppliers.length > 0) setNewSupplierId(suppliers[0].id);
    setPurchaseLines(
      catalogProducts.length > 0
        ? [{ productId: catalogProducts[0].id, quantity: 10, unitCost: 1.0, taxRateSnapshot: catalogProducts[0].taxRate || 0 }]
        : []
    );
    setShowNewPurchaseModal(true);
  };

  const addLine = () => {
    if (catalogProducts.length === 0) return;
    setPurchaseLines([
      ...purchaseLines,
      { productId: catalogProducts[0].id, quantity: 1, unitCost: 1.0, taxRateSnapshot: catalogProducts[0].taxRate || 0 },
    ]);
  };

  const removeLine = (index: number) => {
    setPurchaseLines(purchaseLines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, val: any) => {
    const updated = [...purchaseLines];
    if (field === 'productId') {
      const prod = catalogProducts.find((p) => p.id === val);
      updated[index] = {
        ...updated[index],
        productId: val,
        taxRateSnapshot: prod?.taxRate || 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setPurchaseLines(updated);
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierId) {
      alert('Debe seleccionar un proveedor.');
      return;
    }
    if (purchaseLines.length === 0) {
      alert('Debe incluir al menos un producto en la compra.');
      return;
    }

    try {
      setActionLoading(true);
      await api.createPurchase({
        supplierId: newSupplierId,
        purchaseNumber: newPurchaseNumber.trim() || undefined,
        notes: newNotes.trim() || undefined,
        items: purchaseLines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          taxRateSnapshot: Number(l.taxRateSnapshot),
        })),
      });
      setShowNewPurchaseModal(false);
      await loadPurchases();
    } catch (err: any) {
      alert(err.message || 'Error al registrar la compra.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (!receivingPurchase) return;
    try {
      setActionLoading(true);
      await api.receivePurchase(receivingPurchase.id);
      setReceivingPurchase(null);
      await loadPurchases();
      alert(`¡Mercancía recibida exitosamente! El stock ha sido incrementado y se recalculó el costo promedio ponderado.`);
    } catch (err: any) {
      alert(err.message || 'Error al recibir mercancía.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPurchase = async (p: PurchaseSummaryDto) => {
    const reason = prompt('Ingrese el motivo de cancelación de la orden:');
    if (reason === null) return;
    try {
      setActionLoading(true);
      await api.cancelPurchase(p.id, reason || undefined);
      await loadPurchases();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar la compra.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetail = async (p: PurchaseSummaryDto) => {
    try {
      const full = await api.getPurchaseById(p.id);
      setSelectedPurchaseDetail(full);
    } catch (err: any) {
      alert(err.message || 'Error al consultar detalle.');
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      setSupplierModalError('El nombre del proveedor es obligatorio.');
      return;
    }
    try {
      setSupplierSubmitting(true);
      setSupplierModalError(null);
      await api.createSupplier({
        name: newSupplierName.trim(),
        taxIdentifier: newSupplierTaxId.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        email: newSupplierEmail.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
      });
      setNewSupplierName('');
      setNewSupplierTaxId('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
      await loadSuppliers();
    } catch (err: any) {
      setSupplierModalError(err.message || 'Error al crear proveedor.');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const handleToggleSupplier = async (sup: SupplierDto) => {
    try {
      await api.updateSupplierStatus(sup.id, !sup.isActive);
      await loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar proveedor.');
    }
  };

  // Subtotal & Total of new purchase form
  const formSubtotal = purchaseLines.reduce((acc, l) => acc + (l.quantity * l.unitCost), 0);
  const formTax = purchaseLines.reduce((acc, l) => acc + (l.quantity * l.unitCost * l.taxRateSnapshot), 0);
  const formTotal = formSubtotal + formTax;

  return (
    <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
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
            {t.purchases.title}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t.purchases.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowSuppliersModal(true)}
            style={{
              padding: '0.6rem 1.1rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t.purchases.btnSuppliers} ({suppliers.length})
          </button>

          <button
            onClick={openNewPurchase}
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
            }}
          >
            {t.purchases.newPurchaseBtn}
          </button>
        </div>
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
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.purchases.kpiTotalPurchases}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{purchasesData.totalCount}</div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.purchases.kpiActiveSuppliers}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {suppliers.filter((s) => s.isActive).length}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.purchases.kpiPurchasesValuation}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--success)' }}>
            ${purchasesData.items.reduce((acc, c) => acc + c.total, 0).toFixed(2)} USD
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{t.purchases.kpiValuationMethod}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.purchases.kpiWeightedAvgCost}</div>
        </div>
      </div>

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
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
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
          <option value="">{t.purchases.filterAllStatus}</option>
          <option value="Draft">{t.purchases.statusDraft}</option>
          <option value="Received">{t.purchases.statusReceived}</option>
          <option value="Cancelled">{t.purchases.statusCancelled}</option>
        </select>

        <select
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            minWidth: '200px',
          }}
        >
          <option value="">{t.purchases.filterAllSuppliers}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Purchases Table */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colInvoice}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colSupplier}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colDate}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colItems}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colTotal}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.purchases.colStatus}</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>{t.purchases.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.purchases.loadingPurchases}
                  </td>
                </tr>
              ) : purchasesData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.purchases.noPurchasesFound}
                  </td>
                </tr>
              ) : (
                purchasesData.items.map((p) => {
                  const isDraft = p.status === 'Draft';
                  const isReceived = p.status === 'Received';

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.purchaseNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.supplierName}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {new Date(p.purchasedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {p.itemCount} {p.itemCount === 1 ? t.pos.item : t.pos.items}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        ${p.total.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: isReceived
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isDraft
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            color: isReceived
                              ? 'var(--success)'
                              : isDraft
                              ? 'var(--warning)'
                              : 'var(--danger)',
                            fontWeight: 700,
                          }}
                        >
                          {p.status === 'Received' ? t.purchases.statusReceived : p.status === 'Draft' ? t.purchases.statusDraft : t.purchases.statusCancelled}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewDetail(p)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {t.purchases.btnDetails}
                          </button>

                          {isDraft && (
                            <button
                              onClick={() => setReceivingPurchase(p)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                backgroundColor: 'var(--brand-green)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {t.purchases.btnReceive}
                            </button>
                          )}

                          {isDraft && (
                            <button
                              onClick={() => handleCancelPurchase(p)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--danger)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              {t.common.cancel}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div>
            {t.common.page} <strong>{purchasesData.page}</strong> {t.common.of} <strong>{Math.max(purchasesData.totalPages, 1)}</strong> ({purchasesData.totalCount} {t.purchases.colInvoice.toLowerCase()})
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              disabled={!purchasesData.hasPreviousPage || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: !purchasesData.hasPreviousPage ? 'not-allowed' : 'pointer',
                opacity: !purchasesData.hasPreviousPage ? 0.5 : 1,
              }}
            >
              &larr; {t.common.previous}
            </button>
            <button
              disabled={!purchasesData.hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                cursor: !purchasesData.hasNextPage ? 'not-allowed' : 'pointer',
                opacity: !purchasesData.hasNextPage ? 0.5 : 1,
              }}
            >
              {t.common.next} &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: NUEVA COMPRA */}
      {showNewPurchaseModal && (
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
            if (e.target === e.currentTarget) setShowNewPurchaseModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.purchases.modalPurchaseTitle}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {t.purchases.subtitle}
                </p>
              </div>
              <button onClick={() => setShowNewPurchaseModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '1.5rem', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{t.purchases.supplier} *</label>
                    <select
                      value={newSupplierId}
                      onChange={(e) => setNewSupplierId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    >
                      {suppliers.filter((s) => s.isActive).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{t.purchases.invoiceNumber}</label>
                    <input
                      type="text"
                      value={newPurchaseNumber}
                      onChange={(e) => setNewPurchaseNumber(e.target.value)}
                      placeholder="Ej: PUR-20261017-001"
                      style={{ width: '100%', padding: '0.55rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>{t.common.notes}</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Condiciones de pago, lote, transportista..."
                    style={{ width: '100%', padding: '0.55rem', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                  />
                </div>

                {/* Lines Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '1.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.purchases.addLines}</span>
                  <button type="button" onClick={addLine} style={{ padding: '0.35rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary)', fontSize: '0.75rem', cursor: 'pointer' }}>
                    {t.purchases.addLineBtn}
                  </button>
                </div>

                {/* Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {purchaseLines.map((line, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                        style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      >
                        {catalogProducts.map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder={t.purchases.quantity}
                        style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      />

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unitCost}
                        onChange={(e) => updateLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                        placeholder={t.purchases.unitCost}
                        style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      />

                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-primary)', textAlign: 'right' }}>
                        ${(line.quantity * line.unitCost).toFixed(2)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.3rem' }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.purchases.subtotalLabel}: ${formSubtotal.toFixed(2)} USD</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t.purchases.taxLabel}: ${formTax.toFixed(2)} USD</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                    {t.purchases.totalLabel}: ${formTotal.toFixed(2)} USD
                  </div>
                </div>
              </div>

              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--bg-tertiary)' }}>
                <button type="button" onClick={() => setShowNewPurchaseModal(false)} style={{ padding: '0.55rem 1.1rem', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={actionLoading} style={{ padding: '0.55rem 1.4rem', backgroundColor: 'var(--brand-green)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', cursor: actionLoading ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                  {actionLoading ? t.catalog.saving : t.purchases.registerPurchase}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN DE RECEPCIÓN FÍSICA (IDEMPOTENCIA) */}
      {receivingPurchase && (
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
        >
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '500px', padding: '1.5rem', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {t.purchases.receivingTitle}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {t.purchases.receivingConfirmPrompt} <strong>{receivingPurchase.purchaseNumber}</strong>: <strong>${receivingPurchase.total.toFixed(2)} USD</strong>.
            </p>

            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--success)', marginBottom: '1.25rem' }}>
              ✓ Se incrementarán las existencias en inventario.<br />
              ✓ Se recalculará automáticamente el costo promedio ponderado de los productos.<br />
              ✓ Se generará un movimiento de stock `PURCHASE_IN` inmutable.<br />
              ✓ La operación es <strong>idempotente</strong> (no podrá recibirse nuevamente).
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setReceivingPurchase(null)} style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                {t.common.cancel}
              </button>
              <button onClick={handleConfirmReceive} disabled={actionLoading} style={{ padding: '0.5rem 1.3rem', backgroundColor: 'var(--brand-green)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', cursor: actionLoading ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                {actionLoading ? t.catalog.saving : t.purchases.confirmReceive}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE COMPRA */}
      {selectedPurchaseDetail && (
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
            if (e.target === e.currentTarget) setSelectedPurchaseDetail(null);
          }}
        >
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '650px', padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t.purchases.detailModalTitle} {selectedPurchaseDetail.purchaseNumber}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t.purchases.detailSupplier}: <strong>{selectedPurchaseDetail.supplierName}</strong> | {t.purchases.detailStatus}: <strong>{selectedPurchaseDetail.status}</strong>
                </span>
              </div>
              <button onClick={() => setSelectedPurchaseDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>SKU</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>{t.purchases.lineColProduct}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t.purchases.lineColQty}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t.purchases.lineColCost}</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>{t.purchases.lineColTotal}</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchaseDetail.items.map((i) => (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{i.productSku}</td>
                    <td style={{ padding: '0.5rem' }}>{i.productName}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{i.quantity} {i.baseUnit}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>${i.unitCost.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>${i.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
              <div>{t.purchases.subtotalLabel}: ${selectedPurchaseDetail.subtotal.toFixed(2)} USD</div>
              <div>{t.purchases.taxLabel}: ${selectedPurchaseDetail.taxTotal.toFixed(2)} USD</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.3rem' }}>
                {t.purchases.totalLabel}: ${selectedPurchaseDetail.total.toFixed(2)} USD
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedPurchaseDetail(null)} style={{ padding: '0.5rem 1.2rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GESTIÓN DE PROVEEDORES */}
      {showSuppliersModal && (
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
            if (e.target === e.currentTarget) setShowSuppliersModal(false);
          }}
        >
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '650px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t.purchases.supplierModalTitle}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Directorio de mayoristas y distribuidores autorizados.</p>
              </div>
              <button onClick={() => setShowSuppliersModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {supplierModalError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {supplierModalError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCreateSupplier} style={{ backgroundColor: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{t.purchases.newSupplier}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    placeholder={t.purchases.fieldSupplierName}
                    required
                    style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                  <input
                    type="text"
                    value={newSupplierTaxId}
                    onChange={(e) => setNewSupplierTaxId(e.target.value)}
                    placeholder={t.purchases.fieldSupplierTaxId}
                    style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    placeholder={t.purchases.fieldSupplierPhone}
                    style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                  <input
                    type="email"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    placeholder={t.purchases.fieldSupplierEmail}
                    style={{ padding: '0.45rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={supplierSubmitting} style={{ padding: '0.45rem 1.15rem', backgroundColor: 'var(--brand-green)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.8rem', cursor: supplierSubmitting ? 'not-allowed' : 'pointer', boxShadow: 'var(--shadow-brand)' }}>
                    {supplierSubmitting ? t.catalog.saving : t.purchases.createSupplierBtn}
                  </button>
                </div>
              </form>

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {suppliers.map((s) => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        RIF: {s.taxIdentifier || 'N/A'} | Tel: {s.phone || 'N/A'} | Compras: {s.purchaseCount}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleSupplier(s)}
                      style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: s.isActive ? 'var(--danger)' : 'var(--success)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {s.isActive ? t.common.deactivate : t.common.activate}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
