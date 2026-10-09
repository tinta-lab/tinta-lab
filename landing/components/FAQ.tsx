import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const APP = 'https://app.tinta-lab.de';

// Native <details>: no client JS, keyboard/screen-reader support built in,
// and the answers are in the HTML so search engines can index them.
export default function FAQ() {
  const t = useTranslations('faq');
  const items = t.raw('items') as Array<{ q: string; a: string }>;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-20 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="faq-heading" eyebrow={t('eyebrow')} title={t('h2')} />
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {items.map((f, i) => (
            <details key={i} className="reveal group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-base font-medium text-white leading-snug">{f.q}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-300 group-open:rotate-45 group-open:border-teal-400/40 group-open:bg-teal-400/10">
                  <Plus size={15} className="text-slate-300 group-open:text-teal-300" aria-hidden="true" />
                </span>
              </summary>
              <p className="pb-6 pr-14 text-[15px] leading-relaxed text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-slate-400">
          {t('contactPrompt')}{' '}
          <a href={`${APP}/contact`} className="font-medium text-teal-300 underline decoration-teal-300/30 underline-offset-4 transition-colors hover:decoration-teal-300">
            {t('contactLink')}
          </a>
        </p>
      </div>
    </section>
  );
}
