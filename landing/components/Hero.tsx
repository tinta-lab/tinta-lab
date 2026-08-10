import { ArrowRight, ShieldCheck, Home, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DashboardMockup from './DashboardMockup';

const APP = 'https://app.tinta-lab.de';

export default function Hero() {
  const t = useTranslations('hero');

  const BADGES = [
    { icon: ShieldCheck, label: t('badgeData')   },
    { icon: Users,       label: t('badgeAccess') },
    { icon: Home,        label: t('badgeHome')   },
  ];

  return (
    <section
      id="hero"
      aria-label={t('eyebrow')}
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
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
          <div>
            <div className="inline-flex items-center gap-2 bg-teal-600/10 border border-teal-500/20 rounded-full px-3 py-1 text-xs font-medium text-teal-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              {t('eyebrow')}
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-tight mb-6"
              style={{ textWrap: 'balance' }}
            >
              {t('h1a')}{' '}
              <span className="text-teal-400">{t('h1b')}</span>
            </h1>

            <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-lg">
              {t('lead')}
              <strong className="text-slate-300">{t('leadStrong')}</strong>
            </p>

            {/* Social proof */}
            <div className="flex items-center gap-2 mb-8">
              <div className="flex -space-x-2">
                {(['bg-teal-500','bg-blue-500','bg-indigo-500','bg-violet-500'] as const).map((c, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full ${c} border-2 border-slate-950 flex items-center justify-center text-[9px] text-white font-bold`}
                  >
                    {['A','B','M','S'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-400">
                <strong className="text-white">50+</strong> {t('socialProof').replace('50+ ', '')}
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <a
                href={`${APP}/contact`}
                className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25 group"
              >
                {t('ctaPrimary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-sm px-6 py-3 rounded-xl transition-all duration-200 hover:bg-slate-800/50"
              >
                {t('ctaSecondary')}
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3" role="list" aria-label={t('eyebrow')}>
              {BADGES.map(b => (
                <div
                  key={b.label}
                  role="listitem"
                  className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 rounded-lg px-2.5 py-1.5"
                >
                  <b.icon size={12} className="text-teal-400 shrink-0" aria-hidden="true" />
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:pl-8">
            <DashboardMockup />
          </div>
        </div>

        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 text-slate-600"
          aria-hidden="true"
        >
          <span className="text-xs">{t('scrollHint')}</span>
          <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
        </div>
      </div>
    </section>
  );
}
