import React, { useState, useEffect } from 'react';
import { api, ProductDto, CategoryDto, TaxRateDto } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductSaved: () => void;
  productToEdit: ProductDto | null;
  readOnly?: boolean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onProductSaved,
  productToEdit,
  readOnly = false,
}) => {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRateDto[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);

  // Form Fields
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnit, setBaseUnit] = useState('unidad');
  const [salePrice, setSalePrice] = useState<string>('0.00');
  const [averageCost, setAverageCost] = useState<string>('0.00');
  const [stockQuantity, setStockQuantity] = useState<string>('0');
  const [minimumStock, setMinimumStock] = useState<string>('');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState<string>('');
  const [taxRateId, setTaxRateId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadLookups();
      if (productToEdit) {
        setSku(productToEdit.sku);
        setBarcode(productToEdit.barcode || '');
        setName(productToEdit.name);
        setDescription(productToEdit.description || '');
        setCategoryId(productToEdit.categoryId);
        setBaseUnit(productToEdit.baseUnit);
        setSalePrice(productToEdit.salePrice.toString());
        setAverageCost(productToEdit.averageCost !== null ? productToEdit.averageCost.toString() : '0.00');
        setStockQuantity(productToEdit.stockQuantity !== null && productToEdit.stockQuantity !== undefined ? productToEdit.stockQuantity.toString() : '0');
        setMinimumStock(productToEdit.minimumStock !== null ? productToEdit.minimumStock.toString() : '');
        setStockAdjustmentReason('');
        setTaxRateId(productToEdit.taxRateId || '');
      } else {
        setSku('');
        setBarcode('');
        setName('');
        setDescription('');
        setBaseUnit('unidad');
        setSalePrice('0.00');
        setAverageCost('0.00');
        setStockQuantity('0');
        setMinimumStock('10');
        setStockAdjustmentReason('');
        setTaxRateId('');
      }
      setError(null);
    }
  }, [isOpen, productToEdit]);

  const loadLookups = async () => {
    try {
      setLoadingLookups(true);
      const [cats, taxes] = await Promise.all([
        api.getCategories(false),
        api.getTaxRates(true),
      ]);
      setCategories(cats);
      setTaxRates(taxes);
      if (!productToEdit && cats.length > 0) {
        setCategoryId(cats[0].id);
      }
      if (!productToEdit && taxes.length > 0) {
        setTaxRateId(taxes[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar opciones auxiliares.');
    } finally {
      setLoadingLookups(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    if (!sku.trim()) {
      setError('El SKU es obligatorio.');
      return;
    }
    if (!name.trim()) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!categoryId) {
      setError('Debe seleccionar una categoría.');
      return;
    }

    const priceNum = parseFloat(salePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('El precio de venta debe ser un número mayor o igual a 0.');
      return;
    }

    const costNum = parseFloat(averageCost);
    if (isNaN(costNum) || costNum < 0) {
      setError('El costo de referencia debe ser un número mayor o igual a 0.');
      return;
    }

    const minStockNum = minimumStock.trim() ? parseFloat(minimumStock) : undefined;
    if (minStockNum !== undefined && (isNaN(minStockNum) || minStockNum < 0)) {
      setError('El stock mínimo de alerta no puede ser negativo.');
      return;
    }

    const stockNum = stockQuantity.trim() ? parseFloat(stockQuantity) : 0;
    if (isNaN(stockNum) || stockNum < 0) {
      setError('La cantidad en stock no puede ser negativa.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (productToEdit) {
        const payload = {
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          categoryId,
          baseUnit: baseUnit.trim().toLowerCase(),
          salePrice: priceNum,
          averageCost: costNum,
          minimumStock: minStockNum,
          taxRateId: taxRateId || undefined,
          stockQuantity: stockNum,
          stockAdjustmentReason: stockAdjustmentReason.trim() || undefined,
        };
        await api.updateProduct(productToEdit.id, payload);
      } else {
        const payload = {
          sku: sku.trim().toUpperCase(),
          barcode: barcode.trim() || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          categoryId,
          baseUnit: baseUnit.trim().toLowerCase(),
          salePrice: priceNum,
          averageCost: costNum,
          minimumStock: minStockNum,
          taxRateId: taxRateId || undefined,
          initialStock: stockNum,
        };
        await api.createProduct(payload);
      }

      onProductSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el producto.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {readOnly ? t.catalog.modalViewTitle : productToEdit ? t.catalog.modalEditTitle : t.catalog.modalNewTitle}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {readOnly
                ? t.catalog.modalSubtitleView
                : productToEdit
                ? t.catalog.modalSubtitleEdit
                : t.catalog.modalSubtitleNew}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '1.5rem', flex: 1 }}>
            {error && (
              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem 1rem',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* SKU */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldSku} *
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ej: VIV-ARR-001"
                  required
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              {/* Barcode */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldBarcode}
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Ej: 7591000111222"
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t.catalog.fieldName} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Arroz Blanco Tradicional 1kg"
                required
                disabled={readOnly}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.8rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t.catalog.fieldDescription}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle comercial, especificaciones o marca"
                rows={2}
                disabled={readOnly}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldCategory} *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={readOnly || loadingLookups}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.isActive ? `(${t.catalog.filterInactive})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base Unit */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldUnit} *
                </label>
                <select
                  value={baseUnit}
                  onChange={(e) => setBaseUnit(e.target.value)}
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="unidad">{t.catalog.unitPiece}</option>
                  <option value="kg">{t.catalog.unitKg}</option>
                  <option value="g">{t.catalog.unitGram}</option>
                  <option value="litro">{t.catalog.unitLiter}</option>
                  <option value="ml">{t.catalog.unitMl}</option>
                  <option value="paquete">{t.catalog.unitPack}</option>
                </select>
              </div>
            </div>

            {/* Precios y Costos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Sale Price */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldSalePrice} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  disabled={readOnly}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              {/* Average / Reference Cost */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  {t.catalog.fieldAvgCost} {readOnly && '🔒'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  disabled={readOnly}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                  }}
                />
              </div>
            </div>

            {/* Control de Inventario y Existencias */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              {/* Stock Inicial o Actual */}
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.06)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                }}
              >
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.35rem' }}>
                  📦 {productToEdit ? t.catalog.stockCurrent : t.catalog.stockInitial} *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    disabled={readOnly}
                    required
                    placeholder="Ej: 100"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.8rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--accent-primary)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '1rem',
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {baseUnit}
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.3 }}>
                  {productToEdit
                    ? t.catalog.stockHelperEdit
                    : t.catalog.stockHelperNew}
                </span>
              </div>

              {/* Minimum Stock */}
              <div
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.06)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                }}
              >
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', marginBottom: '0.35rem' }}>
                  ⚠️ {t.catalog.minStock}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(e.target.value)}
                    placeholder="Ej: 15"
                    disabled={readOnly}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.8rem',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {baseUnit}
                  </span>
                </div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.3 }}>
                  {t.catalog.minStockHelper}
                </span>
              </div>
            </div>

            {/* Motivo de ajuste si se modifica el stock al editar */}
            {productToEdit && parseFloat(stockQuantity || '0') !== productToEdit.stockQuantity && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '0.3rem' }}>
                  {t.catalog.adjustReasonLabel}
                </label>
                <input
                  type="text"
                  value={stockAdjustmentReason}
                  onChange={(e) => setStockAdjustmentReason(e.target.value)}
                  placeholder={t.catalog.adjustReasonPlaceholder}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            )}

            {/* Tax Rate */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                {t.catalog.fieldTax}
              </label>
              <select
                value={taxRateId}
                onChange={(e) => setTaxRateId(e.target.value)}
                disabled={readOnly || loadingLookups}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.8rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">{t.catalog.taxExempt}</option>
                {taxRates.map((tax) => (
                  <option key={tax.id} value={tax.id}>
                    {tax.name} ({(tax.rate * 100).toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1.1rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {readOnly ? t.common.close : t.common.cancel}
            </button>

            {!readOnly && (
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '0.55rem 1.4rem',
                  backgroundColor: 'var(--brand-green)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-brand)',
                }}
              >
                {submitting ? t.catalog.saving : productToEdit ? t.catalog.updateProductBtn : t.catalog.createProductBtn}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
