import { Lightbulb, Thermometer, ShieldAlert, Plug, Music, Radio } from 'lucide-react';

/* Set includeDeviceLogos: true to render SVG logos from public/devices/  */
const includeDeviceLogos = false;

const CATEGORIES = [
  {
    icon: Lightbulb,
    title: 'Освещение',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    brands: ['Philips Hue', 'IKEA TRÅDFRI', 'Yeelight', 'Xiaomi', 'Govee', 'LIFX'],
  },
  {
    icon: Thermometer,
    title: 'Климат',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    brands: ['Nest', 'Ecobee', 'Netatmo', 'Tado', 'Mitsubishi', 'Bosch'],
  },
  {
    icon: ShieldAlert,
    title: 'Безопасность',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    brands: ['Ring', 'Aqara', 'Reolink', 'Xiaomi', 'DSC', 'Hikvision'],
  },
  {
    icon: Plug,
    title: 'Умные розетки',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    brands: ['SONOFF', 'Shelly', 'TP-Link Kasa', 'Tuya', 'Meross', 'Eve'],
  },
  {
    icon: Music,
    title: 'Мультимедиа',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    brands: ['Sonos', 'Apple TV', 'Chromecast', 'Plex', 'Spotify', 'Samsung TV'],
  },
  {
    icon: Radio,
    title: 'Датчики',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    brands: ['Температура', 'Влажность', 'Движение', 'Открытие', 'Дым', 'CO₂'],
  },
];

export default function Devices() {
  return (
    <section
      id="devices"
      aria-labelledby="devices-heading"
      className="py-24"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            Совместимость
          </div>
          <h2
            id="devices-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
          >
            Работает с вашими устройствами
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Home Assistant поддерживает более 3 000 интеграций. Tinta Lab
            управляет любой из них.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {CATEGORIES.map(c => (
            <article
              key={c.title}
              className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-slate-600/60 transition-all"
            >
              <div className={`inline-flex p-2 rounded-lg border ${c.bg} mb-4`}>
                <c.icon size={18} className={c.color} aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-3">{c.title}</h3>

              {includeDeviceLogos ? (
                /* Device logo grid — place SVGs in public/devices/{slug}.svg */
                <p className="text-xs text-slate-500">Логотипы устройств</p>
              ) : (
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

        {/* Bottom hint */}
        <p className="text-center text-slate-500 text-sm mt-8">
          И ещё тысячи устройств через{' '}
          <span className="text-slate-400">Home Assistant</span>{' '}
          — Zigbee, Z-Wave, Wi-Fi, Thread, Matter
        </p>
      </div>
    </section>
  );
}
