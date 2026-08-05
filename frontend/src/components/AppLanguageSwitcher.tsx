'use client';

import { useLocale } from '@/i18n/context';
import { Locale, LOCALES } from '@/i18n/translations';

const LANG_LABELS: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
  it: 'Italiano',
  ru: 'Русский',
};

export default function AppLanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Language">
      {LOCALES.map((code, i) => (
        <span key={code} className="flex items-center">
          <button
            onClick={() => setLocale(code)}
            aria-label={LANG_LABELS[code]}
            aria-pressed={code === locale}
            title={LANG_LABELS[code]}
            className={`text-xs font-semibold tracking-wide px-1.5 py-1 rounded transition-all duration-150 ${
              code === locale
                ? 'text-teal-400'
                : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            {code.toUpperCase()}
          </button>
          {i < LOCALES.length - 1 && (
            <span className="text-slate-800 text-xs select-none" aria-hidden="true">·</span>
          )}
        </span>
      ))}
    </div>
  );
}
