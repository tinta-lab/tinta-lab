import { ShieldCheck, Lock, Server } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ICONS = [ShieldCheck, Lock, Server];
const LABEL_COLORS = [
  'text-teal-400 bg-teal-500/10 border-teal-500/20',
  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'text-violet-400 bg-violet-500/10 border-violet-500/20',
];

export default function Security() {
  const t = useTranslations('security');
  const pillars = t.raw('pillars') as Array<{ title: string; desc: string; label: string }>;

  return (
    <section id="security" aria-labelledby="security-heading" className="py-24 bg-slate-900/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
            {t('eyebrow')}
          </div>
          <h2
            id="security-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ textWrap: 'balance' }}
          >
            {t('h2')}
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t('lead')}</p>
        </div>

        <div className="bg-slate-950 border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" aria-hidden="true" />
          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/60">
            {pillars.map((p, i) => {
              const Icon = ICONS[i];
              return (
                <article key={i} className="p-8">
                  <div className="inline-flex p-3 rounded-xl bg-teal-600/10 border border-teal-500/20 mb-5">
                    <Icon size={22} className="text-teal-400" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3 leading-snug" style={{ textWrap: 'balance' }}>
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

          <div className="px-8 py-4 bg-slate-900/50 border-t border-slate-800/60 flex flex-wrap gap-4 items-center justify-between">
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
