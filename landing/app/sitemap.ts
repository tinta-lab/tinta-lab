import type { MetadataRoute } from 'next';

const SITE = 'https://tinta-lab.de';
const LOCALES = ['de', 'en', 'it', 'ru'] as const;
// Legal pages are noindex (see their generateMetadata), so only the home page
// in each language belongs here.
const PAGES = [''];

// German is served without a prefix (localePrefix: 'as-needed').
const url = (locale: string, page: string) => `${SITE}${locale === 'de' ? '' : `/${locale}`}${page}` || SITE;

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(page =>
    LOCALES.map(locale => ({
      url: url(locale, page),
      changeFrequency: page ? 'yearly' as const : 'monthly' as const,
      priority: page ? 0.3 : 1,
      alternates: { languages: Object.fromEntries(LOCALES.map(l => [l, url(l, page)])) },
    })),
  );
}
