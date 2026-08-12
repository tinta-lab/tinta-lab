import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Toaster } from 'sonner';
import { LocaleProvider } from '@/i18n/context';
import PresenceBeacon from '@/components/PresenceBeacon';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tinta Lab',
  description: 'Smart Home Management Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={geist.className}>
        <LocaleProvider>
          {children}
          <Toaster position="top-right" richColors />
          <PresenceBeacon />
        </LocaleProvider>
      </body>
    </html>
  );
}
