import { ArrowRight, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

const APP = 'https://app.tinta-lab.de';

export default function CtaBanner() {
  const t = useTranslations('cta');

  return (
    <section aria-labelledby="cta-heading" className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-blue-700 shadow-2xl shadow-teal-500/20">
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>

          <div className="relative px-8 sm:px-12 py-14 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs font-medium text-teal-100 mb-6">
              <MessageCircle size={11} aria-hidden="true" />
              {t('badge')}
            </div>

            <h2
              id="cta-heading"
              className="text-3xl sm:text-4xl font-bold text-white mb-4"
              style={{ textWrap: 'balance' }}
            >
              {t('h2')}
            </h2>
            <p className="text-teal-100/80 text-lg mb-8 max-w-lg mx-auto">{t('lead')}</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`${APP}/contact`}
                className="inline-flex items-center justify-center gap-2 bg-white text-teal-700 hover:bg-teal-50 font-semibold text-sm px-7 py-3 rounded-xl transition-all duration-200 hover:shadow-lg group"
              >
                {t('primary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="mailto:support@tinta-lab.de"
                className="inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 bg-white/10 hover:bg-white/15 text-white font-medium text-sm px-7 py-3 rounded-xl transition-all duration-200"
              >
                {t('secondary')}
              </a>
            </div>

            <p className="text-teal-200/50 text-xs mt-6">{t('tagline')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
