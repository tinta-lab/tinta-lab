'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const APP = 'https://app.tinta-lab.de';

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-800/30 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white leading-snug">{q}</span>
        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const t = useTranslations('faq');
  const items = t.raw('items') as Array<{ q: string; a: string }>;

  return (
    <section id="faq" aria-labelledby="faq-heading" className="py-24 bg-slate-900/40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-widest mb-3">
            {t('eyebrow')}
          </div>
          <h2
            id="faq-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ textWrap: 'balance' }}
          >
            {t('h2')}
          </h2>
          <p className="text-slate-400 text-lg">
            {t('contactPrompt')}{' '}
            <a
              href={`${APP}/contact`}
              className="text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
            >
              {t('contactLink')}
            </a>
          </p>
        </div>
        <div className="space-y-3">
          {items.map((f, i) => <Item key={i} q={f.q} a={f.a} />)}
        </div>
      </div>
    </section>
  );
}
