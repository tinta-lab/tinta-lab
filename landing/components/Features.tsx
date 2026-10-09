import {
  ShieldCheck, MousePointerClick, Zap,
  Bell, Smartphone, Headphones, Home, Lock, Wrench,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const ICONS = [ShieldCheck, MousePointerClick, Zap, Bell, Smartphone, Headphones];

// Bento layout (6-col grid on desktop): the two features that make Tinta
// different — invisible from the internet, access only on request — get the
// big tiles with a small illustration of the mechanism; the rest stay compact.
const SPANS = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-6',
];

function TunnelVisual() {
  return (
    <div aria-hidden="true" className="mt-auto pt-10 flex items-center gap-3 sm:gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
        <Home size={20} className="text-slate-300" />
      </div>
      <div className="relative h-px flex-1 bg-gradient-to-r from-teal-400/10 via-teal-400/60 to-teal-400/10">
        <span className="tunnel-dot absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-teal-300 shadow-[0_0_12px_2px_rgb(94_234_212/0.7)]" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-7 flex items-center gap-1 rounded-full border border-teal-400/20 bg-slate-950 px-2 py-0.5 text-[10px] font-medium text-teal-300">
          <Lock size={9} /> TLS
        </span>
      </div>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-400/10">
        <Wrench size={20} className="text-teal-300" />
      </div>
    </div>
  );
}

function ToggleVisual() {
  return (
    <div aria-hidden="true" className="mt-auto pt-0 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_10px_rgb(94_234_212/0.8)]" />
        <span className="text-xs text-slate-300">Tinta Support</span>
      </div>
      <span className="relative h-6 w-11 rounded-full bg-teal-400">
        <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </div>
  );
}

export default function Features() {
  const t = useTranslations('features');
  const items = t.raw('items') as Array<{ title: string; desc: string }>;

  return (
    <section id="features" aria-labelledby="features-heading" className="relative py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="features-heading" eyebrow={t('eyebrow')} title={t('h2')} lead={t('lead')} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {items.map((f, i) => {
            const Icon = ICONS[i];
            const big = i < 2;
            return (
              <article
                key={i}
                className={`reveal glass-card group relative overflow-hidden rounded-3xl p-6 sm:p-7 ${big ? 'flex flex-col' : ''} transition-colors duration-300 hover:border-teal-400/25 ${SPANS[i]} ${i === 0 ? 'sm:col-span-2' : ''} ${i === 5 ? 'sm:col-span-2 lg:flex lg:items-center lg:gap-8' : ''}`}
              >
                {big && (
                  <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />
                )}
                <div className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-400/[0.08] ${i === 5 ? 'mb-5 lg:mb-0' : 'mb-5'}`}>
                  <Icon size={20} className="text-teal-300" aria-hidden="true" />
                </div>
                <div className={`relative ${big ? 'flex flex-1 flex-col' : ''}`}>
                  <h3 className={`font-semibold tracking-tight text-white mb-2 ${big ? 'text-xl' : 'text-base'}`} style={{ textWrap: 'balance' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-400 max-w-prose">{f.desc}</p>
                  {i === 0 && <TunnelVisual />}
                  {i === 1 && <div className="mt-auto pt-8"><ToggleVisual /></div>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
