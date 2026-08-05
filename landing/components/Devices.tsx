import { Lightbulb, Thermometer, ShieldAlert, Plug, Music, Radio } from 'lucide-react';
import { useTranslations } from 'next-intl';

const includeDeviceLogos = false;

const CATEGORY_META = [
  { icon: Lightbulb,   color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', brands: ['Philips Hue', 'IKEA TRÅDFRI', 'Yeelight', 'Xiaomi', 'Govee', 'LIFX'] },
  { icon: Thermometer, color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     brands: ['Nest', 'Ecobee', 'Netatmo', 'Tado', 'Mitsubishi', 'Bosch'] },
  { icon: ShieldAlert, color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       brands: ['Ring', 'Aqara', 'Reolink', 'Xiaomi', 'DSC', 'Hikvision'] },
  { icon: Plug,        color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   brands: ['SONOFF', 'Shelly', 'TP-Link Kasa', 'Tuya', 'Meross', 'Eve'] },
  { icon: Music,       color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', brands: ['Sonos', 'Apple TV', 'Chromecast', 'Plex', 'Spotify', 'Samsung TV'] },
  { icon: Radio,       color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',     brands: [] },
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
    <section id="devices" aria-labelledby="devices-heading" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            {t('eyebrow')}
          </div>
          <h2 id="devices-heading" className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('h2')}
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t('lead')}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(c => (
            <article
              key={c.title}
              className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all"
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
                      className="text-xs bg-slate-900/60 border border-slate-700/40 text-slate-400 rounded-md px-2 py-0.5"
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
