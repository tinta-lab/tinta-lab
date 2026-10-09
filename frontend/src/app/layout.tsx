import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@/i18n/context';
import { COOKIE_NAME, DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n/translations';
import PresenceBeacon from '@/components/PresenceBeacon';
import './globals.css';

const geist = Geist({ subsets: ['latin', 'latin-ext', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Tinta Lab',
  description: 'Smart Home Management Platform',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render in the visitor's language from the first byte: previously every
  // page came out German and switched after hydration (visible flash), and
  // <html lang> stayed "de" for every language.
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value as Locale | undefined;
  const locale: Locale = cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return (
    <html lang={locale}>
      <body className={geist.className}>
        <LocaleProvider initialLocale={locale}>
          {children}
          <Toaster position="top-right" richColors />
          <PresenceBeacon />
        </LocaleProvider>
      </body>
    </html>
  );
}
