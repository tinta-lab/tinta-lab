import type { Locale } from '@/i18n/translations';

// Single source of truth for locale → Intl locale tag — no component should
// ever hardcode 'de-DE' (or any other region tag) itself. That hardcoding
// is exactly how the dashboard ended up showing German-formatted dates
// under every locale regardless of the selected language (2026-09-22 i18n
// audit, Phase 2).
const INTL_LOCALE: Record<Locale, string> = {
  de: 'de-DE',
  en: 'en-US',
  it: 'it-IT',
  ru: 'ru-RU',
};

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString(INTL_LOCALE[locale], options) : '—';
}

export function formatTime(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(INTL_LOCALE[locale], options) : '—';
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  return d ? d.toLocaleString(INTL_LOCALE[locale], options) : '—';
}
