import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = 'https://tinta-lab.de';
const SITE_NAME = 'Tinta Lab';
const DESCRIPTION =
  'Tinta Lab — платформа для управления Home Assistant как услугой. ' +
  'Удалённая поддержка через Cloudflare Tunnel, без открытых портов. ' +
  'Поддержка подключается только с явного разрешения клиента.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Умный дом как услуга`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'Home Assistant', 'умный дом', 'MSP', 'управление', 'Cloudflare Tunnel',
    'Zero Trust', 'автоматизация', 'поддержка умного дома', 'Tinta Lab',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Умный дом без головной боли`,
    description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: SITE_NAME }],
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Умный дом без головной боли`,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="scroll-smooth">
      <head>
        {/*
          Analytics insertion point.
          analytics option: 'none' | 'plausible' | 'matomo' | 'ga4'
          To enable Plausible: uncomment the script below and set your domain.

          <script defer data-domain="tinta-lab.de" src="https://plausible.io/js/script.js" />

          To enable GA4: set NEXT_PUBLIC_GA_ID in .env.local
          and add the GoogleAnalytics component from @next/third-parties/google
        */}
      </head>
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
