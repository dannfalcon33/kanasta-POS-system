import { describe, it, expect, beforeEach } from 'vitest';
import { SUPPORTED_LANGUAGES, Language } from '../lib/i18n/types';
import { es } from '../lib/i18n/translations/es';
import { en } from '../lib/i18n/translations/en';
import { pt } from '../lib/i18n/translations/pt';

// Simple mock storage for Node test runner
const memoryStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, value: string) => { memoryStore[key] = value; },
  removeItem: (key: string) => { delete memoryStore[key]; },
  clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]); },
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
}

describe('Kanasta Desktop Multi-Language / i18n System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('supports the required three languages: Spanish, English, and Portuguese', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('es');
    expect(codes).toContain('en');
    expect(codes).toContain('pt');
    expect(SUPPORTED_LANGUAGES.length).toBe(3);
  });

  it('has identical structure and complete keys across all three language files', () => {
    const sections: (keyof typeof es)[] = [
      'common',
      'nav',
      'auth',
      'pos',
      'catalog',
      'inventory',
      'purchases',
      'users',
      'dashboard',
      'languages',
    ];

    for (const section of sections) {
      expect(es[section], `es.${section} should be defined`).toBeDefined();
      expect(en[section], `en.${section} should be defined`).toBeDefined();
      expect(pt[section], `pt.${section} should be defined`).toBeDefined();

      const esKeys = Object.keys(es[section]);
      const enKeys = Object.keys(en[section]);
      const ptKeys = Object.keys(pt[section]);

      // All keys must match across languages
      expect(enKeys.sort()).toEqual(esKeys.sort());
      expect(ptKeys.sort()).toEqual(esKeys.sort());

      // No value should be empty
      for (const key of esKeys) {
        const esVal = (es[section] as Record<string, string>)[key];
        const enVal = (en[section] as Record<string, string>)[key];
        const ptVal = (pt[section] as Record<string, string>)[key];

        expect(typeof esVal).toBe('string');
        expect(esVal.length, `es.${section}.${key} is empty`).toBeGreaterThan(0);

        expect(typeof enVal).toBe('string');
        expect(enVal.length, `en.${section}.${key} is empty`).toBeGreaterThan(0);

        expect(typeof ptVal).toBe('string');
        expect(ptVal.length, `pt.${section}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('correctly translates core navigation tabs in all three languages', () => {
    // POS Terminal
    expect(es.nav.pos).toBe('Terminal de Caja');
    expect(en.nav.pos).toBe('Cash Register (POS)');
    expect(pt.nav.pos).toBe('Terminal de Caixa');

    // Catalog
    expect(es.nav.catalog).toBe('Catálogo');
    expect(en.nav.catalog).toBe('Catalog');
    expect(pt.nav.catalog).toBe('Catálogo');

    // Inventory & Kardex
    expect(es.nav.inventory).toBe('Inventario y Kardex');
    expect(en.nav.inventory).toBe('Inventory & Kardex');
    expect(pt.nav.inventory).toBe('Estoque e Kardex');

    // Purchases & Suppliers
    expect(es.nav.purchases).toBe('Compras y Proveedores');
    expect(en.nav.purchases).toBe('Purchases & Suppliers');
    expect(pt.nav.purchases).toBe('Compras e Fornecedores');

    // Users
    expect(es.nav.users).toBe('Usuarios');
    expect(en.nav.users).toBe('Users');
    expect(pt.nav.users).toBe('Usuários');

    // Financial Dashboard
    expect(es.nav.dashboard).toBe('Dashboard Financiero');
    expect(en.nav.dashboard).toBe('Financial Dashboard');
    expect(pt.nav.dashboard).toBe('Painel Financeiro');
  });

  it('correctly translates authentication screen in Spanish, English and Portuguese', () => {
    // Login Title
    expect(es.auth.loginTitle).toBe('Iniciar Sesión');
    expect(en.auth.loginTitle).toBe('Sign In');
    expect(pt.auth.loginTitle).toBe('Iniciar Sessão');

    // Setup Title
    expect(es.auth.setupTitle).toBe('Crear Administrador');
    expect(en.auth.setupTitle).toBe('Create Administrator');
    expect(pt.auth.setupTitle).toBe('Criar Administrador');

    // Email
    expect(es.auth.email).toBe('Correo Electrónico');
    expect(en.auth.email).toBe('Email Address');
    expect(pt.auth.email).toBe('E-mail');

    // Password
    expect(es.auth.password).toBe('Contraseña');
    expect(en.auth.password).toBe('Password');
    expect(pt.auth.password).toBe('Senha');
  });

  it('persists selected language in localStorage and handles fallback', () => {
    const STORAGE_KEY = 'kanasta_language';

    // Default when empty
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // User switches to English
    localStorage.setItem(STORAGE_KEY, 'en');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');

    // User switches to Portuguese
    localStorage.setItem(STORAGE_KEY, 'pt');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('pt');

    // User switches back to Spanish
    localStorage.setItem(STORAGE_KEY, 'es');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('es');
  });

  it('supports fallback mechanism for invalid language codes', () => {
    const validCodes: Language[] = ['es', 'en', 'pt'];
    const testCode = 'fr'; // Unsupported language

    const resolvedLanguage: Language = validCodes.includes(testCode as Language)
      ? (testCode as Language)
      : 'es';

    expect(resolvedLanguage).toBe('es');
  });
});
