import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DashboardMockup from './DashboardMockup';

const APP = 'https://app.tinta-lab.de';

export default function Hero() {
  const t = useTranslations('hero');

  // Honest trust points only. A "50+ smart homes connected" counter with
  // placeholder avatars used to sit here — unverifiable social proof is an
  // UWG risk in Germany and reads as a template to anyone who looks closely.
  const POINTS = [t('badgeData'), t('badgeAccess'), t('badgeHome')];

  return (
    <section
      id="hero"
      aria-label={t('eyebrow')}
      className="relative flex items-center overflow-hidden min-h-[100svh]"
    >
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="aurora absolute -inset-[20%]" />
        <div className="grid-fade absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-slate-950" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 w-full">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-10 items-center">
          <div>
            <div className="enter inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/[0.06] px-3 py-1 text-xs font-medium text-teal-300 mb-7 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-300" />
              </span>
              {t('eyebrow')}
            </div>

            <h1
              className="enter enter-1 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] text-white mb-7"
              style={{ textWrap: 'balance' }}
            >
              {t('h1a')}{' '}
              <span className="text-gradient">{t('h1b')}</span>
            </h1>

            <p className="enter enter-2 text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-xl" style={{ textWrap: 'pretty' }}>
              {t('lead')}
              <strong className="font-medium text-slate-200">{t('leadStrong')}</strong>
            </p>

            <div className="enter enter-3 flex flex-col sm:flex-row gap-3 mb-10">
              <a
                href={`${APP}/contact`}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-teal-400 px-7 py-3.5 text-sm font-semibold text-slate-950 transition-all duration-200 hover:bg-teal-300 hover:shadow-[0_0_40px_-8px_rgb(45_212_191/0.7)]"
              >
                {t('ctaPrimary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-medium text-slate-200 backdrop-blur transition-colors hover:border-white/25 hover:bg-white/[0.06]"
              >
                {t('ctaSecondary')}
              </a>
            </div>

            <ul className="enter enter-4 flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2.5" role="list">
              {POINTS.map(p => (
                <li key={p} className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-400/15">
                    <Check size={10} strokeWidth={3} className="text-teal-300" aria-hidden="true" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="enter enter-3 lg:pl-6">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
