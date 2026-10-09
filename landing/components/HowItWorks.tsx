import { UserPlus, Download, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const ICONS = [UserPlus, Download, CheckCircle];

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const steps = t.raw('steps') as Array<{ title: string; desc: string; note: string }>;

  return (
    <section id="how-it-works" aria-labelledby="hiw-heading" className="relative py-20 sm:py-24">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="hiw-heading" eyebrow={t('eyebrow')} title={t('h2')} lead={t('lead')} />

        <ol className="relative grid gap-4 lg:grid-cols-3" role="list">
          {steps.map((s, i) => {
            const Icon = ICONS[i];
            return (
              <li key={i} className="reveal glass-card relative overflow-hidden rounded-3xl p-7">
                <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] font-semibold leading-none tracking-tighter text-white/[0.04]">
                  {i + 1}
                </span>
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-400/20 bg-teal-400/[0.08]">
                  <Icon size={22} className="text-teal-300" aria-hidden="true" />
                </div>
                <div className="mb-2 text-xs font-medium text-slate-500">{t('eyebrow')} · {i + 1}/3</div>
                <h3 className="mb-3 text-xl font-semibold tracking-tight text-white">{s.title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-slate-400">{s.desc}</p>
                <span className="inline-flex items-center rounded-full border border-teal-400/20 bg-teal-400/[0.06] px-3 py-1 text-xs text-teal-200">
                  {s.note}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
