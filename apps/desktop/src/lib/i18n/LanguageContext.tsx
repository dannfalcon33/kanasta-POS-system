import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Language, LanguageOption, SUPPORTED_LANGUAGES, TranslationSchema } from './types';
import { es } from './translations/es';
import { en } from './translations/en';
import { pt } from './translations/pt';

const TRANSLATIONS: Record<Language, TranslationSchema> = {
  es,
  en,
  pt,
};

const STORAGE_KEY = 'kanasta_language';

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationSchema;
  translate: (path: string, fallback?: string) => string;
  languages: LanguageOption[];
  currentLanguageOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language;
      if (saved && (saved === 'es' || saved === 'en' || saved === 'pt')) {
        return saved;
      }
      // Detect browser language if available
      if (typeof navigator !== 'undefined' && navigator.language) {
        const navLang = navigator.language.slice(0, 2).toLowerCase();
        if (navLang === 'pt') return 'pt';
        if (navLang === 'en') return 'en';
      }
    } catch {
      // Fallback for SSR or restricted localStorage
    }
    return 'es';
  });

  const setLanguage = (lang: Language) => {
    if (lang === 'es' || lang === 'en' || lang === 'pt') {
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
        // Also update HTML lang attribute
        document.documentElement.lang = lang;
      } catch {
        // Ignore storage errors
      }
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // Ignore
    }
  }, [language]);

  const t = useMemo(() => TRANSLATIONS[language] || es, [language]);

  const currentLanguageOption = useMemo(
    () => SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0],
    [language]
  );

  const translate = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    let result: unknown = t;

    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = (result as Record<string, unknown>)[key];
      } else {
        // Fallback to Spanish if key missing
        let esResult: unknown = es;
        for (const esKey of keys) {
          if (esResult && typeof esResult === 'object' && esKey in esResult) {
            esResult = (esResult as Record<string, unknown>)[esKey];
          } else {
            return fallback || path;
          }
        }
        return typeof esResult === 'string' ? esResult : fallback || path;
      }
    }

    return typeof result === 'string' ? result : fallback || path;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translate,
        languages: SUPPORTED_LANGUAGES,
        currentLanguageOption,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
