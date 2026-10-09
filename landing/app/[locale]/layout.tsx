import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

// Self-hosted at build time by next/font — no request to Google at runtime
// (matters for DSGVO: no visitor IP leaves for fonts.googleapis.com).
const geist = Geist({ subsets: ['latin', 'cyrillic'], display: 'swap', variable: '--font-geist' });

const SITE_URL = 'https://tinta-lab.de';
const SITE_NAME = 'Tinta Lab';

const META: Record<string, { title: string; description: string }> = {
  de: {
    title: `${SITE_NAME} — Smart Home als Service`,
    description: 'Herstellerunabhängige Smart-Home-Beratung, Einrichtung und Betreuung. Wir verkaufen keine Geräte – Sie kaufen direkt beim Händler, wir planen, installieren und betreuen.',
  },
  en: {
    title: `${SITE_NAME} — Smart Home as a Service`,
    description: "Independent smart home consulting, setup and support. We don't sell devices – you buy directly from the retailer, we plan, install and look after it.",
  },
  it: {
    title: `${SITE_NAME} — Smart Home come servizio`,
    description: 'Consulenza, installazione e assistenza smart home indipendenti. Non vendiamo dispositivi: li acquisti dal rivenditore, noi progettiamo, installiamo e assistiamo.',
  },
  ru: {
    title: `${SITE_NAME} — Умный дом как услуга`,
    description: 'Независимый консалтинг, установка и поддержка умного дома. Мы не продаём оборудование — вы покупаете у продавца, мы проектируем, устанавливаем и обслуживаем.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = META[locale] ?? META.de;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: m.title, template: `%s | ${SITE_NAME}` },
    description: m.description,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: m.title,
      description: m.description,
      locale,
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
    robots: { index: true, follow: true },
    // canonical/hreflang are set per page (see [locale]/page.tsx). Setting
    // canonical here made every page — Impressum, AGB, every language —
    // declare itself a duplicate of the German home page.
  };
}

export const viewport: Viewport = {
  themeColor: '#020617',
  colorScheme: 'dark',
};

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`scroll-smooth ${geist.variable}`}>
      <head />
      <body className="bg-slate-950 text-white antialiased font-sans">
        <script
          type="application/ld+json"
          // Organization data for search engines (name, logo, contact)
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/logo.png`,
            email: 'info@tinta-lab.de',
          }) }}
        />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
