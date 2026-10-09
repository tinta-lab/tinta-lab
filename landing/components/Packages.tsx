import { ArrowRight, Check, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionHeading from './SectionHeading';

const APP = 'https://app.tinta-lab.de';

type Card = { title: string; tag: string; desc: string; items: string[]; sizes?: string[] };
type Tier = { name: string; desc: string };

// The three things we sell — consulting, on-site setup, ongoing care — and
// the one thing we deliberately don't: hardware. Prices are intentionally
// not shown yet (draft pricing, see business plan 2026); the fixed price for
// our work is given in the free initial call.
export default function Packages() {
  const t = useTranslations('packages');
  const consult = t.raw('consult') as Card;
  const setup = t.raw('setup') as Card;
  const care = t.raw('care') as Omit<Card, 'items'> & { tiers: Tier[] };

  return (
    <section id="packages" aria-labelledby="packages-heading" className="relative py-20 sm:py-24">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading id="packages-heading" eyebrow={t('eyebrow')} title={t('h2')} lead={t('lead')} />

        <div className="grid gap-4 lg:grid-cols-3">
          <PackageCard card={consult} />
          <PackageCard card={setup} highlight />

          <article className="reveal glass-card flex flex-col rounded-3xl p-7">
            <Header title={care.title} tag={care.tag} desc={care.desc} />
            <ul className="mt-6 space-y-3" role="list">
              {care.tiers.map(tier => (
                <li key={tier.name} className="rounded-2xl border border-white/[0.07] bg-slate-950/40 p-4">
                  <div className="text-sm font-semibold text-white">{tier.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{tier.desc}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="reveal mt-4 flex flex-col gap-5 rounded-3xl border border-teal-400/20 bg-teal-400/[0.04] p-6 sm:flex-row sm:items-center sm:p-7">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-teal-400/25 bg-teal-400/10">
            <ShoppingBag size={20} className="text-teal-300" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">{t('hardwareTitle')}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{t('hardwareText')}</p>
          </div>
          <a
            href={`${APP}/contact`}
            className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-teal-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-300"
          >
            {t('cta')}
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Header({ title, tag, desc, highlight }: { title: string; tag: string; desc: string; highlight?: boolean }) {
  return (
    <div>
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${highlight ? 'border-teal-300/40 bg-teal-300/15 text-teal-200' : 'border-white/10 bg-white/[0.03] text-slate-300'}`}>
        {tag}
      </span>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

function PackageCard({ card, highlight }: { card: Card; highlight?: boolean }) {
  return (
    <article
      className={`reveal flex flex-col rounded-3xl p-7 ${highlight ? 'relative border border-teal-300/30 bg-gradient-to-b from-teal-400/[0.10] to-slate-900/60 shadow-[0_0_60px_-20px_rgb(45_212_191/0.45)]' : 'glass-card'}`}
    >
      <Header title={card.title} tag={card.tag} desc={card.desc} highlight={highlight} />
      <ul className="mt-6 space-y-2.5" role="list">
        {card.items.map(item => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-400/15">
              <Check size={10} strokeWidth={3} className="text-teal-300" aria-hidden="true" />
            </span>
            {item}
          </li>
        ))}
      </ul>
      {card.sizes && (
        <div className="mt-auto pt-6 space-y-1.5">
          {card.sizes.map(s => (
            <div key={s} className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-3 py-2 text-xs text-slate-300">{s}</div>
          ))}
        </div>
      )}
    </article>
  );
}
