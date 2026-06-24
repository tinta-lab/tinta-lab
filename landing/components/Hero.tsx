import { ArrowRight, ShieldCheck, CloudLightning, Home } from 'lucide-react';
import DashboardMockup from './DashboardMockup';

const APP = 'https://app.tinta-lab.de';

const BADGES = [
  { icon: ShieldCheck,     label: 'Zero Trust безопасность'  },
  { icon: CloudLightning,  label: 'Cloudflare Tunnel'         },
  { icon: Home,            label: 'Home Assistant Native'     },
];

export default function Hero() {
  return (
    <section
      id="hero"
      aria-label="Главный экран"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Background gradients */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/6 rounded-full blur-3xl" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          {/* Left — copy */}
          <div>
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-3 py-1 text-xs font-medium text-blue-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Managed Home Assistant Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-tight mb-6">
              Умный дом{' '}
              <span className="text-blue-400">без головной боли</span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-lg">
              Tinta Lab берёт на себя управление Home Assistant. Настройка,
              мониторинг и поддержка — всё включено. Специалист получает доступ
              <strong className="text-slate-300"> только с вашего явного разрешения.</strong>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <a
                href={`${APP}/auth/register`}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25 group"
              >
                Начать бесплатно
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-sm px-6 py-3 rounded-xl transition-all duration-200 hover:bg-slate-800/50"
              >
                Как это работает
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3" role="list" aria-label="Ключевые преимущества">
              {BADGES.map(b => (
                <div
                  key={b.label}
                  role="listitem"
                  className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2.5 py-1.5"
                >
                  <b.icon size={12} className="text-slate-400" aria-hidden="true" />
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right — mockup */}
          <div className="lg:pl-8">
            <DashboardMockup />
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 text-slate-600" aria-hidden="true">
          <span className="text-xs">Прокрутите</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
        </div>
      </div>
    </section>
  );
}
