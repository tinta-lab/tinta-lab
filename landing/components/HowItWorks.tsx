import { UserPlus, Download, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const ICONS = [UserPlus, Download, CheckCircle];

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const steps = t.raw('steps') as Array<{ title: string; desc: string; note: string }>;

  return (
    <section id="how-it-works" aria-labelledby="hiw-heading" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
            {t('eyebrow')}
          </div>
          <h2
            id="hiw-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ textWrap: 'balance' }}
          >
            {t('h2')}
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">{t('lead')}</p>
        </div>

        <div className="relative">
          <div
            className="hidden lg:block absolute top-12 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"
            aria-hidden="true"
          />
          <ol className="grid lg:grid-cols-3 gap-8 lg:gap-6" role="list">
            {steps.map((s, i) => {
              const Icon = ICONS[i];
              return (
                <li key={i} className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shadow-black/30">
                      <Icon size={24} className="text-teal-400" aria-hidden="true" />
                    </div>
                    <span
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center"
                      aria-label={`${i + 1}`}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-600 mb-1">0{i + 1}</div>
                  <h3 className="text-lg font-semibold text-white mb-3">{s.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-xs lg:max-w-none">{s.desc}</p>
                  <span className="inline-block text-xs bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-full px-3 py-1">
                    {s.note}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
