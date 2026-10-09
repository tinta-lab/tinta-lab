// Single source for the provider details shown on every legal page in every
// language — fill in the street once here (required by § 5 DDG and in the
// withdrawal notice) and it appears everywhere.
export const COMPANY = {
  owner: 'Viktor Goloviznin',
  brand: 'Tinta Lab',
  street: '[Straße und Hausnummer]',
  city: '65719 Hofheim am Taunus (Ortsteil Diedenbergen)',
  email: 'info@tinta-lab.de',
  contactForm: 'https://app.tinta-lab.de/contact',
} as const;

export const COUNTRY: Record<string, string> = {
  de: 'Deutschland', en: 'Germany', it: 'Germania', ru: 'Германия',
};

// German is served without a locale prefix (localePrefix: 'as-needed').
export const legalHref = (locale: string, page: string) => (locale === 'de' ? `/${page}` : `/${locale}/${page}`);
