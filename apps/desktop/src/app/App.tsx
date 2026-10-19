import React, { useState, useEffect } from 'react';
import { api, UserDto } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { AuthScreen } from '../features/auth/AuthScreen';
import { UsersPanel } from '../features/users/UsersPanel';
import { ProductsCatalogPanel } from '../features/products/ProductsCatalogPanel';
import { InventoryPanel } from '../features/inventory/InventoryPanel';
import { PurchasesPanel } from '../features/purchases/PurchasesPanel';
import { CheckoutPanel } from '../features/checkout/CheckoutPanel';
import { DashboardPanel } from '../features/dashboard/DashboardPanel';
import kanastaLogo from '../assets/kanasta.jpg';
import '../index.css';

export const App: React.FC = () => {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'purchases' | 'inventory' | 'users' | 'pos' | 'dashboard'>('pos');

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const checkCurrentSession = async () => {
    const token = localStorage.getItem('kanasta_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const user = await api.getMe();
      setCurrentUser(user);
    } catch {
      localStorage.removeItem('kanasta_token');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', gap: '1.25rem', backgroundColor: 'var(--bg-primary)' }}>
        <img
          src={kanastaLogo}
          alt="Kanasta POS"
          style={{
            height: '84px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 8px 20px rgba(22, 163, 74, 0.18))',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            KANASTA <span style={{ fontWeight: 600, color: 'var(--brand-green)', letterSpacing: '0.06em' }}>POS</span>
          </div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.22em', marginTop: '0.25rem', textTransform: 'uppercase' }}>
            {t.common.tagline}
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.88rem' }}>{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 2rem',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img
            src={kanastaLogo}
            alt="Kanasta POS"
            style={{
              height: '46px',
              width: '46px',
              objectFit: 'contain',
              borderRadius: '8px',
              filter: 'drop-shadow(0 2px 6px rgba(22, 163, 74, 0.16))',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 900, fontSize: '1.35rem', color: 'var(--text-primary)', letterSpacing: '0.03em', lineHeight: 1 }}>
                KANASTA <span style={{ fontWeight: 600, color: 'var(--brand-green)', letterSpacing: '0.05em' }}>POS</span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-brand)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  backgroundColor: 'var(--brand-green-subtle)',
                  color: 'var(--brand-green)',
                  border: '1px solid var(--brand-green-border)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                }}
              >
                {t.common.currencyBadge}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.22em', marginTop: '0.2rem', textTransform: 'uppercase' }}>
              {t.common.tagline}
            </div>
          </div>
        </div>

        {/* Right header actions: Language Selector & User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <LanguageSelector variant="compact" />

          {currentUser && (
            <>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentUser.fullName}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentUser.email}</div>
              </div>

              <span
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: currentUser.role === 'Admin' ? 'var(--brand-green-subtle)' : 'var(--bg-tertiary)',
                  color: currentUser.role === 'Admin' ? 'var(--brand-green)' : 'var(--text-secondary)',
                  border: `1px solid ${currentUser.role === 'Admin' ? 'var(--brand-green-border)' : 'var(--border-color)'}`,
                }}
              >
                {currentUser.role === 'Admin' ? t.nav.adminRole : t.nav.cashierRole}
              </span>

              <button
                onClick={handleLogout}
                style={{
                  padding: '0.45rem 0.9rem',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {t.nav.logout}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: !currentUser ? 'center' : 'flex-start',
          padding: '1.75rem 1.5rem',
        }}
      >
        {!currentUser ? (
          <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />
        ) : (
          <div style={{ width: '100%', maxWidth: '1200px' }}>
            {/* Top Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <button
                onClick={() => setActiveTab('pos')}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: activeTab === 'pos' ? 'var(--brand-green)' : 'transparent',
                  color: activeTab === 'pos' ? '#ffffff' : 'var(--text-secondary)',
                  border: activeTab === 'pos' ? '1px solid var(--brand-green)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: activeTab === 'pos' ? 'var(--shadow-brand)' : 'none',
                }}
              >
                🛒 {t.nav.pos}
              </button>

              <button
                onClick={() => setActiveTab('catalog')}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: activeTab === 'catalog' ? 'var(--brand-green)' : 'transparent',
                  color: activeTab === 'catalog' ? '#ffffff' : 'var(--text-secondary)',
                  border: activeTab === 'catalog' ? '1px solid var(--brand-green)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: activeTab === 'catalog' ? 'var(--shadow-brand)' : 'none',
                }}
              >
                📦 {t.nav.catalog}
              </button>

              <button
                onClick={() => setActiveTab('inventory')}
                style={{
                  padding: '0.6rem 1.25rem',
                  backgroundColor: activeTab === 'inventory' ? 'var(--brand-green)' : 'transparent',
                  color: activeTab === 'inventory' ? '#ffffff' : 'var(--text-secondary)',
                  border: activeTab === 'inventory' ? '1px solid var(--brand-green)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: activeTab === 'inventory' ? 'var(--shadow-brand)' : 'none',
                }}
              >
                📊 {currentUser.role === 'Admin' ? t.nav.inventory : t.nav.stock}
              </button>

              {currentUser.role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('purchases')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: activeTab === 'purchases' ? 'var(--brand-green)' : 'transparent',
                    color: activeTab === 'purchases' ? '#ffffff' : 'var(--text-secondary)',
                    border: activeTab === 'purchases' ? '1px solid var(--brand-green)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: activeTab === 'purchases' ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  🚚 {t.nav.purchases}
                </button>
              )}

              {currentUser.role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: activeTab === 'users' ? 'var(--brand-green)' : 'transparent',
                    color: activeTab === 'users' ? '#ffffff' : 'var(--text-secondary)',
                    border: activeTab === 'users' ? '1px solid var(--brand-green)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: activeTab === 'users' ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  👥 {t.nav.users}
                </button>
              )}

              {currentUser.role === 'Admin' && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    backgroundColor: activeTab === 'dashboard' ? 'var(--brand-green)' : 'transparent',
                    color: activeTab === 'dashboard' ? '#ffffff' : 'var(--text-secondary)',
                    border: activeTab === 'dashboard' ? '1px solid var(--brand-green)' : '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: activeTab === 'dashboard' ? 'var(--shadow-brand)' : 'none',
                  }}
                >
                  📈 {t.nav.dashboard}
                </button>
              )}
            </div>

            {/* Active Tab Panel */}
            {activeTab === 'pos' && (
              <CheckoutPanel userRole={currentUser.role} cashierName={currentUser.fullName} />
            )}

            {activeTab === 'catalog' && (
              <ProductsCatalogPanel userRole={currentUser.role} />
            )}

            {activeTab === 'purchases' && currentUser.role === 'Admin' && (
              <PurchasesPanel />
            )}

            {activeTab === 'inventory' && (
              <InventoryPanel userRole={currentUser.role} />
            )}

            {activeTab === 'users' && currentUser.role === 'Admin' && (
              <UsersPanel />
            )}

            {activeTab === 'dashboard' && currentUser.role === 'Admin' && (
              <DashboardPanel userRole={currentUser.role} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
