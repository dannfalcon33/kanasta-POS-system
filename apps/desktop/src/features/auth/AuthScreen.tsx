import React, { useState, useEffect } from 'react';
import { api, UserDto } from '../../lib/api';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import kanastaLogo from '../../assets/kanasta.jpg';

interface AuthScreenProps {
  onAuthSuccess: (user: UserDto) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { t } = useLanguage();
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.checkAdminStatus();
      setHasAdmin(res.hasAdmin);
    } catch {
      setError(t.auth.apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.login({ email, password, terminalName: 'Caja Principal Web' });
      onAuthSuccess(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await api.setupInitialAdmin({ email, password, fullName });
      onAuthSuccess(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '1.25rem' }}>
        <img
          src={kanastaLogo}
          alt="Kanasta POS"
          style={{
            height: '80px',
            width: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 16px rgba(22, 163, 74, 0.16))',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            KANASTA <span style={{ fontWeight: 600, color: 'var(--brand-green)' }}>POS</span>
          </div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
            {t.common.tagline}
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.88rem' }}>{t.common.connecting}</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        padding: '2.5rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* Top Bar inside Auth Card for Language Selection */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
        <LanguageSelector variant="pills" />
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <img
          src={kanastaLogo}
          alt="Kanasta POS"
          style={{
            height: '84px',
            width: 'auto',
            objectFit: 'contain',
            margin: '0 auto 0.75rem auto',
            display: 'block',
            filter: 'drop-shadow(0 4px 14px rgba(22, 163, 74, 0.15))',
          }}
        />
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
          KANASTA <span style={{ fontWeight: 600, color: 'var(--brand-green)', letterSpacing: '0.05em' }}>POS</span>
        </div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
          {t.common.tagline}
        </div>

        <div
          style={{
            display: 'inline-block',
            padding: '0.25rem 0.85rem',
            backgroundColor: 'var(--brand-green-subtle)',
            color: 'var(--brand-green)',
            border: '1px solid var(--brand-green-border)',
            fontSize: '0.78rem',
            fontWeight: 700,
            borderRadius: '9999px',
            marginBottom: '0.75rem',
          }}
        >
          {hasAdmin ? t.auth.loginBadge : t.auth.setupBadge}
        </div>
        <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {hasAdmin ? t.auth.loginTitle : t.auth.setupTitle}
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          {hasAdmin ? t.auth.loginSubtitle : t.auth.setupSubtitle}
        </p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            marginBottom: '1.5rem',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {hasAdmin ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t.auth.email}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t.auth.password}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              backgroundColor: 'var(--brand-green)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            {submitting ? t.auth.authenticating : t.auth.submitLogin}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSetupAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t.auth.fullName}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t.auth.fullNamePlaceholder}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t.auth.email} (Admin)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              {t.auth.password} (min. 6)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              backgroundColor: 'var(--brand-green)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            {submitting ? t.auth.configuring : t.auth.submitSetup}
          </button>
        </form>
      )}

      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <button
          onClick={checkStatus}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {t.common.connecting}
        </button>
      </div>
    </div>
  );
};

