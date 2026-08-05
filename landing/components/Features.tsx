import {
  ShieldCheck, MousePointerClick, Zap,
  Bell, Smartphone, Headphones,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const ICONS = [ShieldCheck, MousePointerClick, Zap, Bell, Smartphone, Headphones];
const ACCENTS = [
  { accent: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20'   },
  { accent: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
  { accent: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  { accent: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20'  },
  { accent: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/20'     },
  { accent: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
];

export default function Features() {
  const t = useTranslations('features');
  const items = t.raw('items') as Array<{ title: string; desc: string }>;

  return (
    <section id="features" aria-labelledby="features-heading" className="py-24 bg-slate-900/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
            {t('eyebrow')}
          </div>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ textWrap: 'balance' }}
          >
            {t('h2')}
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">{t('lead')}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f, i) => {
            const Icon = ICONS[i];
            const { accent, bg } = ACCENTS[i];
            return (
              <article
                key={i}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/60 hover:bg-slate-800/70 transition-all duration-200 group"
              >
                <div className={`inline-flex p-2.5 rounded-xl border ${bg} mb-4`}>
                  <Icon size={20} className={accent} aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2 group-hover:text-teal-300 transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
