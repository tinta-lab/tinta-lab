import { Lightbulb, Thermometer, ShieldAlert, Plug, Music, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const includeDeviceLogos = false;

const CATEGORY_META = [
  { icon: Lightbulb,   color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20', brands: ['Philips Hue', 'IKEA TRÅDFRI', 'Yeelight', 'Xiaomi', 'Govee', 'LIFX'] },
  { icon: Thermometer, color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20',     brands: ['Nest', 'Ecobee', 'Netatmo', 'Tado', 'Mitsubishi', 'Bosch'] },
  { icon: ShieldAlert, color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20',       brands: ['Ring', 'Aqara', 'Reolink', 'Xiaomi', 'DSC', 'Hikvision'] },
  { icon: Plug,        color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20',   brands: ['SONOFF', 'Shelly', 'TP-Link Kasa', 'Tuya', 'Meross', 'Eve'] },
  { icon: Music,       color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20', brands: ['Sonos', 'Apple TV', 'Chromecast', 'Plex', 'Spotify', 'Samsung TV'] },
  { icon: Radio,       color: 'text-teal-300', bg: 'bg-teal-400/[0.08] border-teal-400/20',     brands: [] },
];

export default function Devices() {
  const t = useTranslations('devices');
  const categories = t.raw('categories') as Array<{ title: string }>;
  const sensorBrands = t.raw('sensorBrands') as string[];

  const CATEGORIES = CATEGORY_META.map((m, i) => ({
    ...m,
    title: categories[i]?.title ?? '',
    brands: i === 5 ? sensorBrands : m.brands,
  }));

  return (
    <section id="devices" aria-labelledby="devices-heading" className="relative py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="devices-heading" eyebrow={t('eyebrow')} title={t('h2')} lead={t('lead')} />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(c => (
            <article
              key={c.title}
              className="reveal glass-card rounded-3xl p-6 transition-colors hover:border-teal-400/25"
            >
              <div className={`inline-flex p-2 rounded-lg border ${c.bg} mb-4`}>
                <c.icon size={18} className={c.color} aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-3">{c.title}</h3>
              {!includeDeviceLogos && (
                <ul className="flex flex-wrap gap-1.5" role="list">
                  {c.brands.map(b => (
                    <li
                      key={b}
                      className="text-xs bg-white/[0.03] border border-white/[0.08] text-slate-400 rounded-full px-2.5 py-0.5"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">{t('footer')}</p>
      </div>
    </section>
  );
}
