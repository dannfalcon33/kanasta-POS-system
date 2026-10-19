import React, { useState, useEffect, useCallback } from 'react';
import { api, ProductDto, CategoryDto, SaleDto, SaleDetailDto } from '../../lib/api';
import { sound } from '../../lib/sound';
import { useLanguage } from '../../lib/i18n/LanguageContext';

interface CheckoutPanelProps {
  userRole: 'Admin' | 'Cashier';
  cashierName: string;
}

interface CartItem {
  product: ProductDto;
  quantity: number;
}

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({ userRole, cashierName }) => {
  const { t } = useLanguage();
  const isAdmin = userRole === 'Admin';
  const [activeSubTab, setActiveSubTab] = useState<'pos' | 'history'>('pos');

  // Catalog & Search State
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartError, setCartError] = useState<string | null>(null);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<number>(1); // 1: Cash, 2: Card, 3: BankTransfer, 4: Other
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<SaleDetailDto | null>(null);

  // Sales History State
  const [salesHistory, setSalesHistory] = useState<SaleDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<SaleDetailDto | null>(null);

  // Void Sale Modal State
  const [saleToVoid, setSaleToVoid] = useState<SaleDto | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Load Products & Categories
  const loadCatalog = useCallback(async () => {
    try {
      setLoadingCatalog(true);
      const [productsData, categoriesData] = await Promise.all([
        api.getProducts({
          search: searchQuery.trim() || undefined,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          isActive: true,
          page: 1,
          pageSize: 50,
        }),
        api.getCategories(),
      ]);
      setProducts(productsData.items);
      setCategories(categoriesData);
    } catch (err: unknown) {
      console.error('Error al cargar catálogo:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Load Sales History
  const loadSalesHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await api.getSales({
        page: historyPage,
        pageSize: 10,
      });
      setSalesHistory(data.items);
      setHistoryTotalPages(data.totalPages);
    } catch (err: unknown) {
      console.error('Error al cargar historial de ventas:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage]);

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadSalesHistory();
    }
  }, [activeSubTab, loadSalesHistory]);

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.product.salePrice, 0);
  const cartTax = cart.reduce((sum, item) => {
    const rate = item.product.taxRate ?? 0;
    const lineSubtotal = Math.round(item.quantity * item.product.salePrice * 100) / 100;
    return sum + Math.round(lineSubtotal * rate * 100) / 100;
  }, 0);
  const cartTotal = Math.round((cartSubtotal + cartTax) * 100) / 100;

  // Add product to cart with strict stock availability check
  const handleAddToCart = (product: ProductDto) => {
    setCartError(null);
    if (product.stockQuantity <= 0) {
      setCartError(`El producto '${product.name}' está agotado (Stock: 0).`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.stockQuantity) {
          setCartError(`Stock insuficiente para '${product.name}'. Disponible: ${product.stockQuantity}`);
          return prevCart;
        }
        return prevCart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { product, quantity: 1 }];
      }
    });
  };

  // Modify quantity in cart
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    setCartError(null);
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.stockQuantity) {
            setCartError(`Stock insuficiente para '${item.product.name}'. Disponible: ${item.product.stockQuantity}`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setCartError(null);
  };

  // Open Payment Modal
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setPaymentError(null);
    setPaymentMethod(1); // Default Cash
    setPaymentAmount(cartTotal.toFixed(2));
    setPaymentReference('');
    setShowPaymentModal(true);
  };

  // Quick cash amount buttons
  const parsedPaymentAmount = parseFloat(paymentAmount) || 0;
  const changeDue = Math.max(0, parsedPaymentAmount - cartTotal);

  // Submit Sale
  const handleConfirmSale = async () => {
    if (parsedPaymentAmount < cartTotal) {
      setPaymentError(`El monto entregado ($${parsedPaymentAmount.toFixed(2)}) no cubre el total ($${cartTotal.toFixed(2)}).`);
      return;
    }

    try {
      setIsSubmittingSale(true);
      setPaymentError(null);

      const payload = {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        paymentMethod: paymentMethod,
        paymentAmount: parsedPaymentAmount,
        paymentReference: paymentReference.trim() || null,
        discountTotal: 0,
      };

      const result = await api.createSale(payload);
      sound.playCashRegisterSound(); // Sonido clásico "Cachin!" al cerrar la venta en caja
      setShowPaymentModal(false);
      setCart([]);
      setCompletedSale(result);
      loadCatalog(); // Refresh available inventory stock
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Error desconocido al procesar la venta.');
      loadCatalog(); // In case stock changed
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // View historical sale ticket
  const handleViewHistoricalSale = async (sale: SaleDto) => {
    try {
      const detail = await api.getSaleById(sale.id);
      setSelectedSaleDetail(detail);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al obtener detalle de venta.');
    }
  };

  // Void sale (Admin only)
  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    if (!voidReason.trim()) {
      setVoidError('El motivo de la anulación es estrictamente obligatorio.');
      return;
    }

    try {
      setIsSubmittingVoid(true);
      setVoidError(null);
      await api.voidSale(saleToVoid.id, voidReason.trim());
      setSaleToVoid(null);
      setVoidReason('');
      loadSalesHistory();
      loadCatalog();
    } catch (err: unknown) {
      setVoidError(err instanceof Error ? err.message : 'Error al anular la venta.');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header & Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              color: 'var(--accent-primary)',
              fontSize: '1.4rem',
            }}
          >
            🛒
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {t.pos.terminalTitle}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t.pos.cashierLabel}: <strong style={{ color: 'var(--text-secondary)' }}>{cashierName}</strong> • {t.pos.currencyLabel}: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>USD</span> • {t.pos.receiptTypeLabel}: <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{t.pos.nonFiscalNotice}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Sound toggle button */}
          <button
            type="button"
            onClick={() => sound.toggleSound()}
            title={t.pos.soundBell}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: '#ffffff',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            🔔 {t.pos.bellLabel} <strong>{sound.isEnabled() ? t.pos.soundOn : t.pos.soundOff}</strong>
          </button>

          {/* View switcher */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setActiveSubTab('pos')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeSubTab === 'pos' ? 'var(--brand-green)' : 'transparent',
                color: activeSubTab === 'pos' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: activeSubTab === 'pos' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              ⚡ {t.pos.subtabTerminal}
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: activeSubTab === 'history' ? 'var(--brand-green)' : 'transparent',
                color: activeSubTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: activeSubTab === 'history' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              📜 {t.pos.subtabHistory}
            </button>
          </div>
        </div>
      </div>

      {/* POS TERMINAL VIEW */}
      {activeSubTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          {/* LEFT: Product Catalog & Quick Pick */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Search & Category Filter Bar */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder={t.pos.searchProduct}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => {
                    if (products.length > 0) {
                      handleAddToCart(products[0]);
                    }
                  }}
                  title={t.pos.scanSimulate}
                  style={{
                    padding: '0.65rem 1rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📷 {t.pos.scanBtn}
                </button>
              </div>

              {/* Category Pills */}
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                <button
                  onClick={() => setSelectedCategory('all')}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '9999px',
                    border: selectedCategory === 'all' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                    backgroundColor: selectedCategory === 'all' ? 'var(--brand-green)' : '#ffffff',
                    color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: selectedCategory === 'all' ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
                  }}
                >
                  {t.pos.allCategories}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '9999px',
                      border: selectedCategory === c.id ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                      backgroundColor: selectedCategory === c.id ? 'var(--brand-green)' : '#ffffff',
                      color: selectedCategory === c.id ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: selectedCategory === c.id ? 'var(--shadow-brand)' : 'var(--shadow-sm)',
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {cartError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>⚠️ {cartError}</span>
                <button
                  onClick={() => setCartError(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Products Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.75rem',
                maxHeight: '600px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {loadingCatalog ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {t.common.loading}
                </div>
              ) : products.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  {t.catalog.noProductsFound}
                </div>
              ) : (
                products.map((p) => {
                  const isOutOfStock = p.stockQuantity <= 0;
                  const isLow = p.minimumStock !== null && p.stockQuantity <= p.minimumStock && !isOutOfStock;

                  return (
                    <div
                      key={p.id}
                      onClick={() => !isOutOfStock && handleAddToCart(p)}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        padding: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        opacity: isOutOfStock ? 0.6 : 1,
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.sku}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              backgroundColor: isOutOfStock
                                ? 'rgba(239, 68, 68, 0.15)'
                                : isLow
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                              color: isOutOfStock
                                ? 'var(--danger)'
                                : isLow
                                ? 'var(--warning)'
                                : 'var(--success)',
                            }}
                          >
                            {t.catalog.stock}: {p.stockQuantity} {p.baseUnit}
                          </span>
                        </div>
                        <h4
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            margin: '0.4rem 0 0.2rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.3,
                          }}
                        >
                          {p.name}
                        </h4>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.categoryName}</div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                        <div>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            ${p.salePrice.toFixed(2)}
                          </div>
                          {p.taxRate !== null && p.taxRate !== undefined && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              {t.pos.tax}: {(p.taxRate * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>

                        <button
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(p);
                          }}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            backgroundColor: isOutOfStock ? 'var(--border-color)' : 'var(--brand-green)',
                            color: isOutOfStock ? 'var(--text-muted)' : '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                            boxShadow: isOutOfStock ? 'none' : '0 2px 6px rgba(22, 163, 74, 0.25)',
                          }}
                        >
                          + {t.pos.add}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Live Cart & Totals */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 180px)',
              maxHeight: '750px',
            }}
          >
            {/* Cart Header */}
            <div
              style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {t.pos.cart}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {cart.length} {t.pos.itemsCount}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {t.pos.clearButton}
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              {cart.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛒</div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>{t.pos.emptyCart}</p>
                </div>
              ) : (
                cart.map((item) => {
                  const lineTotal = item.quantity * item.product.salePrice;
                  const taxRate = item.product.taxRate ?? 0;

                  return (
                    <div
                      key={item.product.id}
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.product.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ${item.product.salePrice.toFixed(2)} / {item.product.baseUnit} • {t.pos.tax} {(taxRate * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                          ${lineTotal.toFixed(2)}
                        </div>
                      </div>

                      {/* Quantity Controller & Delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stockQuantity}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) handleUpdateQuantity(item.product.id, val);
                            }}
                            style={{
                              width: '45px',
                              textAlign: 'center',
                              padding: '0.2rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          />
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            (Máx: {item.product.stockQuantity})
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                          title={t.common.delete}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cart Summary & Checkout Trigger */}
            <div
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>{t.pos.subtotal}:</span>
                <span>${cartSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>{t.pos.vatLabel}</span>
                <span>${cartTax.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  paddingTop: '0.4rem',
                  borderTop: '1px dashed var(--border-color)',
                }}
              >
                <span>{t.pos.total}:</span>
                <span style={{ color: 'var(--accent-primary)' }}>US$ {cartTotal.toFixed(2)}</span>
              </div>

              <button
                disabled={cart.length === 0}
                onClick={handleOpenPayment}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  backgroundColor: cart.length === 0 ? 'var(--border-color)' : 'var(--brand-green)',
                  color: cart.length === 0 ? 'var(--text-muted)' : '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: cart.length > 0 ? 'var(--shadow-brand)' : 'none',
                }}
              >
                💳 {t.pos.payButton} (${cartTotal.toFixed(2)} USD)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SALES HISTORY VIEW */}
      {activeSubTab === 'history' && (
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {t.pos.historyTitle}
            </h3>
            <button
              onClick={loadSalesHistory}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              🔄 {t.common.refresh}
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colSale}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colDate}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colCashier}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colItems}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colMethod}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colTotal}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t.pos.colStatus}</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{t.pos.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.pos.historyLoading}
                  </td>
                </tr>
              ) : salesHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {t.pos.historyEmpty}
                  </td>
                </tr>
              ) : (
                salesHistory.map((s) => {
                  const isVoided = s.status === 'Voided';

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.saleNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                        {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)' }}>{s.cashierName}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{s.itemCount} {t.pos.itemsCount}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{s.paymentMethod}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                        ${s.total.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            backgroundColor: isVoided ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: isVoided ? 'var(--danger)' : 'var(--success)',
                            fontWeight: 700,
                          }}
                        >
                          {isVoided ? t.pos.voidedStatus : s.status === 'Completed' ? t.pos.completedStatus : s.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewHistoricalSale(s)}
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
                            {t.pos.viewDetail}
                          </button>

                          {isAdmin && !isVoided && (
                            <button
                              onClick={() => {
                                setSaleToVoid(s);
                                setVoidReason('');
                                setVoidError(null);
                              }}
                              style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--danger)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--danger)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              {t.pos.voidSale}
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

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: historyPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: historyPage <= 1 ? 0.5 : 1,
                }}
              >
                {t.common.previous}
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t.common.page} {historyPage} {t.common.of} {historyTotalPages}
              </span>
              <button
                disabled={historyPage >= historyTotalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
                style={{
                  padding: '0.35rem 0.75rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: historyPage >= historyTotalPages ? 'not-allowed' : 'pointer',
                  opacity: historyPage >= historyTotalPages ? 0.5 : 1,
                }}
              >
                {t.common.next}
              </button>
            </div>
          )}
        </div>
      )}

      {/* PAYMENT MODAL */}
      {showPaymentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '460px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {t.pos.processPaymentTitle}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Total Banner */}
            <div
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.pos.totalUsdLabel}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                ${cartTotal.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 600 }}>USD</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t.pos.paymentMethods}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                {[
                  { id: 1, label: t.pos.cashUsd.split(' ')[0], icon: '💵' },
                  { id: 2, label: t.pos.card.split(' ')[0], icon: '💳' },
                  { id: 3, label: t.pos.pagoMovil.split(' ')[0], icon: '🏦' },
                  { id: 4, label: t.dashboard.otherMethod.split(' ')[0], icon: '✨' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    style={{
                      padding: '0.6rem 0.2rem',
                      borderRadius: 'var(--radius-sm)',
                      border: paymentMethod === m.id ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                      backgroundColor: paymentMethod === m.id ? 'var(--brand-green)' : 'var(--bg-tertiary)',
                      color: paymentMethod === m.id ? '#ffffff' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.2rem',
                      boxShadow: paymentMethod === m.id ? 'var(--shadow-brand)' : 'none',
                    }}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Tendered & Quick Buttons */}
            {paymentMethod === 1 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  {t.pos.receivedAmount} (USD)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.3rem', marginBottom: '0.5rem' }}>
                  {[cartTotal, 5, 10, 20, 50, 100].map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPaymentAmount(amt.toFixed(2))}
                      style={{
                        padding: '0.35rem 0.2rem',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {idx === 0 ? '=' : `$${amt}`}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  step="0.01"
                  min={cartTotal}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    outline: 'none',
                    textAlign: 'center',
                  }}
                />

                {/* Change / Vuelto Display */}
                <div
                  style={{
                    marginTop: '0.6rem',
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: changeDue > 0 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    border: changeDue > 0 ? '1px solid var(--success)' : '1px solid transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: changeDue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {t.pos.changeLabel}
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: changeDue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    ${changeDue.toFixed(2)} USD
                  </span>
                </div>
              </div>
            )}

            {/* Reference input for Card / Transfer */}
            {paymentMethod !== 1 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  {t.pos.referenceLabel} ({t.common.optional})
                </label>
                <input
                  type="text"
                  placeholder={t.pos.referencePlaceholder}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {paymentError && (
              <div
                style={{
                  padding: '0.6rem 0.8rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--danger)',
                  fontSize: '0.8rem',
                }}
              >
                ⚠️ {paymentError}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={isSubmittingSale}
                onClick={handleConfirmSale}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  backgroundColor: 'var(--brand-green)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: isSubmittingSale ? 'wait' : 'pointer',
                  opacity: isSubmittingSale ? 0.7 : 1,
                  boxShadow: 'var(--shadow-brand)',
                }}
              >
                {isSubmittingSale ? t.pos.processing : `✅ ${t.pos.confirmPayment}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED SALE RECEIPT MODAL / TICKET VIEWER */}
      {(completedSale || selectedSaleDetail) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '380px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              fontFamily: 'Courier, monospace',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Thermal Ticket Content */}
            {(() => {
              const sale = completedSale || selectedSaleDetail!;
              let snapshotData: Record<string, unknown> = {};
              try {
                if (sale.receipt?.businessSnapshot) {
                  snapshotData = JSON.parse(sale.receipt.businessSnapshot);
                }
              } catch (e) {
                console.error(e);
              }

              return (
                <div>
                  {/* Non-Fiscal Banner */}
                  <div
                    style={{
                      border: '2px dashed #dc2626',
                      padding: '0.4rem',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#dc2626',
                      fontSize: '0.75rem',
                      marginBottom: '1rem',
                      lineHeight: 1.2,
                    }}
                  >
                    *** DOCUMENTO INTERNO DE PRUEBA ***<br />
                    NO VÁLIDO COMO FACTURA FISCAL
                  </div>

                  {/* Business Header */}
                  <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                      {(snapshotData['BusinessName'] as string) || 'KANASTA MINIMARKET'}
                    </div>
                    <div>RIF: {(snapshotData['TaxIdentifier'] as string) || 'J-12345678-0'}</div>
                    <div style={{ fontSize: '0.75rem' }}>{(snapshotData['Address'] as string) || 'Caracas, Venezuela'}</div>
                    <div style={{ fontSize: '0.75rem' }}>Tel: {(snapshotData['Phone'] as string) || '+58 212 5550000'}</div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }} />

                  {/* Sale Metadata */}
                  <div style={{ fontSize: '0.75rem' }}>
                    <div>N° Venta: <strong>{sale.saleNumber}</strong></div>
                    <div>N° Recibo: <strong>{sale.receipt?.documentNumber}</strong></div>
                    <div>Fecha: {new Date(sale.createdAt).toLocaleString()}</div>
                    <div>Cajero: {sale.cashierName}</div>
                    <div>Estado: <strong>{sale.status}</strong></div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }} />

                  {/* Items Table */}
                  <table style={{ width: '100%', fontSize: '0.75rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        <th>Art.</th>
                        <th style={{ textAlign: 'center' }}>Cant</th>
                        <th style={{ textAlign: 'right' }}>P.Unit</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '0.2rem 0' }}>{item.productNameSnapshot}</td>
                          <td style={{ textAlign: 'center', padding: '0.2rem 0' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '0.2rem 0' }}>${item.unitPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', padding: '0.2rem 0', fontWeight: 700 }}>
                            ${item.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }} />

                  {/* Totals Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>${sale.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Impuestos (IVA):</span>
                      <span>${sale.taxTotal.toFixed(2)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 900,
                        fontSize: '1rem',
                        marginTop: '0.2rem',
                        borderTop: '1px solid #000',
                        paddingTop: '0.2rem',
                      }}
                    >
                      <span>TOTAL USD:</span>
                      <span>${sale.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }} />

                  {/* Payment Details */}
                  {sale.payment && (
                    <div style={{ fontSize: '0.75rem' }}>
                      <div>Método: {sale.payment.paymentMethod}</div>
                      <div>Entregado: ${sale.payment.amount.toFixed(2)} USD</div>
                      <div>Vuelto: ${Math.max(0, sale.payment.amount - sale.total).toFixed(2)} USD</div>
                      {sale.payment.reference && <div>Ref: {sale.payment.reference}</div>}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.7rem' }}>
                    ¡Gracias por su compra!<br />
                    Sistema Kanasta POS
                  </div>

                  {/* Buttons for Print / Close */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <button
                      onClick={() => window.print()}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        backgroundColor: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      🖨️ {t.pos.printButton}
                    </button>
                    <button
                      onClick={() => {
                        setCompletedSale(null);
                        setSelectedSaleDetail(null);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        backgroundColor: '#e2e8f0',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      {completedSale ? `✨ ${t.pos.newSaleButton}` : t.common.close}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* VOID SALE MODAL (ADMIN ONLY) */}
      {saleToVoid && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--danger)' }}>
              ⚠️ {t.pos.voidModalTitle}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              ¿Estás seguro de anular la venta <strong>{saleToVoid.saleNumber}</strong> por un importe de <strong>${saleToVoid.total.toFixed(2)} USD</strong>?
            </p>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.4rem' }}>
                {t.pos.voidReasonLabel} *
              </label>
              <textarea
                rows={3}
                placeholder={t.pos.voidReasonPlaceholder}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'none',
                }}
              />
            </div>

            {voidError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>⚠️ {voidError}</div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSaleToVoid(null)}
                style={{
                  padding: '0.6rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={isSubmittingVoid}
                onClick={handleConfirmVoid}
                style={{
                  padding: '0.6rem 1rem',
                  backgroundColor: 'var(--danger)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  cursor: isSubmittingVoid ? 'wait' : 'pointer',
                }}
              >
                {isSubmittingVoid ? '...' : t.pos.confirmVoidBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
