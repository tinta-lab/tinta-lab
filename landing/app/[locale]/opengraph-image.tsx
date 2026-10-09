import { ImageResponse } from 'next/og';

// Social preview (WhatsApp, LinkedIn, …). Replaces public/og-image.png,
// which was an 11-byte placeholder, so every shared link showed no image.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tinta Lab';

const TEXT: Record<string, { a: string; b: string; sub: string }> = {
  de: { a: 'Smart Home', b: 'ohne Stress', sub: 'Einrichtung · Überwachung · Support – Zugang nur mit Ihrer Erlaubnis' },
  en: { a: 'Smart Home', b: 'without the stress', sub: 'Setup · Monitoring · Support – access only with your permission' },
  it: { a: 'Smart Home', b: 'senza stress', sub: 'Configurazione · Monitoraggio · Supporto – accesso solo con il tuo permesso' },
  ru: { a: 'Умный дом', b: 'без забот', sub: 'Настройка · Мониторинг · Поддержка – доступ только с вашего разрешения' },
};

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = TEXT[locale] ?? TEXT.de;
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: 72, background: 'radial-gradient(60% 80% at 15% 20%, #0f766e 0%, #020617 60%), #020617', color: '#fff',
      }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 6, color: '#5eead4', fontWeight: 600 }}>TINTA LAB</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>{t.a}</div>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.05, color: '#2dd4bf' }}>{t.b}</div>
        </div>
        <div style={{ fontSize: 30, color: '#94a3b8' }}>{t.sub}</div>
      </div>
    ),
    size,
  );
}
