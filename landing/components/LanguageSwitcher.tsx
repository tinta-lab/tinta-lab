'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTransition } from 'react';

const LANGS = [
  { code: 'de', short: 'DE', label: 'Deutsch'  },
  { code: 'en', short: 'EN', label: 'English'  },
  { code: 'it', short: 'IT', label: 'Italiano' },
  { code: 'ru', short: 'RU', label: 'Русский'  },
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function switchTo(code: string) {
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  }

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Language">
      {LANGS.map((lang, i) => (
        <span key={lang.code} className="flex items-center">
          <button
            onClick={() => switchTo(lang.code)}
            aria-label={lang.label}
            aria-pressed={lang.code === locale}
            title={lang.label}
            className={`text-xs font-semibold tracking-wide px-1.5 py-1 rounded transition-all duration-150 ${
              lang.code === locale
                ? 'text-teal-400'
                : 'text-slate-600 hover:text-slate-300'
            }`}
          >
            {lang.short}
          </button>
          {i < LANGS.length - 1 && (
            <span className="text-slate-800 text-xs select-none" aria-hidden="true">·</span>
          )}
        </span>
      ))}
    </div>
  );
}
