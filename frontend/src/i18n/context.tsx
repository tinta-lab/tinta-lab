'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { translations, Locale, LOCALES, DEFAULT_LOCALE, COOKIE_NAME, TranslationKey } from './translations';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
  // Count-aware lookup: the value holds plural forms separated by "|" with
  // a {n} placeholder — Russian one|few|many, the other languages one|other
  // (e.g. "{n} сессия|{n} сессии|{n} сессий"). Picked via Intl.PluralRules,
  // so "1 устройств" / "4 установок" can't happen.
  tn: (key: TranslationKey, n: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  const val = match?.[1] as Locale;
  return LOCALES.includes(val) ? val : DEFAULT_LOCALE;
}

function writeCookie(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${locale}; max-age=${maxAge}; path=/; domain=.tinta-lab.de; SameSite=Lax`;
}

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    const cookieLocale = readCookie();
    if (cookieLocale !== locale) setLocaleState(cookieLocale);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeCookie(l);
  }, []);

  // Keep <html lang> in sync after a switch (screen readers, hyphenation).
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const t = useCallback((key: TranslationKey): string => {
    return translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key;
  }, [locale]);

  const tn = useCallback((key: TranslationKey, n: number): string => {
    const forms = t(key).split('|');
    const cat = new Intl.PluralRules(locale).select(n);
    const idx = forms.length === 3
      ? (cat === 'one' ? 0 : cat === 'few' ? 1 : 2)
      : (cat === 'one' ? 0 : forms.length - 1);
    return (forms[idx] ?? forms[forms.length - 1]).replace('{n}', String(n));
  }, [t, locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tn }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}
