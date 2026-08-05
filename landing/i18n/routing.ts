import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['de', 'en', 'it', 'ru'],
  defaultLocale: 'de',
  localePrefix: 'as-needed',
  localeCookie: { name: 'tl_locale', maxAge: 60 * 60 * 24 * 365 },
});
