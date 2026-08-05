import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '../globals.css';

const SITE_URL = 'https://tinta-lab.de';
const SITE_NAME = 'Tinta Lab';

const META: Record<string, { title: string; description: string }> = {
  de: {
    title: `${SITE_NAME} — Smart Home als Service`,
    description: 'Professionelles Smart-Home-Management: Einrichtung, Überwachung und Support mit maximaler Datensicherheit.',
  },
  en: {
    title: `${SITE_NAME} — Smart Home as a Service`,
    description: 'Professional smart home management: setup, monitoring and support with maximum data privacy.',
  },
  it: {
    title: `${SITE_NAME} — Smart Home come servizio`,
    description: 'Gestione professionale della smart home: configurazione, monitoraggio e supporto con la massima protezione dei dati.',
  },
  ru: {
    title: `${SITE_NAME} — Умный дом как услуга`,
    description: 'Профессиональное управление умным домом: настройка, мониторинг и поддержка с максимальной защитой данных.',
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
      url: SITE_URL,
      siteName: SITE_NAME,
      title: m.title,
      description: m.description,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE_NAME }],
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: SITE_URL,
      languages: { de: '/', en: '/en', it: '/it', ru: '/ru' },
    },
  };
}

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
    <html lang={locale} className="scroll-smooth">
      <head />
      <body className="bg-slate-950 text-white antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
