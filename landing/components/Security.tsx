import { ShieldCheck, Lock, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const ICONS = [ShieldCheck, Lock, Server];
const LABEL_COLORS = [
  'text-teal-200 bg-teal-400/[0.06] border-teal-400/20',
  'text-teal-200 bg-teal-400/[0.06] border-teal-400/20',
  'text-teal-200 bg-teal-400/[0.06] border-teal-400/20',
];

export default function Security() {
  const t = useTranslations('security');
  const pillars = t.raw('pillars') as Array<{ title: string; desc: string; label: string }>;

  return (
    <section id="security" aria-labelledby="security-heading" className="relative py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="security-heading" eyebrow={t('eyebrow')} title={t('h2')} lead={t('lead')} />

        <div className="reveal glass-card rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" aria-hidden="true" />
          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
            {pillars.map((p, i) => {
              const Icon = ICONS[i];
              return (
                <article key={i} className="p-8">
                  <div className="inline-flex p-3 rounded-2xl bg-teal-400/[0.08] border border-teal-400/20 mb-5">
                    <Icon size={22} className="text-teal-300" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-white mb-3 leading-snug" style={{ textWrap: 'balance' }}>
                    {p.title}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-5">{p.desc}</p>
                  <span className={`inline-block text-xs font-medium border rounded-full px-3 py-1 ${LABEL_COLORS[i]}`}>
                    {p.label}
                  </span>
                </article>
              );
            })}
          </div>

          <div className="px-8 py-4 bg-slate-950/40 border-t border-white/[0.06] flex flex-wrap gap-4 items-center justify-between">
            <p className="text-xs text-slate-500">
              {t('poweredBy')}{' '}
              <strong className="text-slate-400">Home Assistant</strong>
              {' '}{t('poweredByAnd')}{' '}
              <strong className="text-slate-400">Cloudflare</strong>
              {' '}{t('poweredByText')}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
              {t('gdpr')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
