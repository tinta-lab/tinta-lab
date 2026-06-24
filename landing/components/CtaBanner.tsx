import { ArrowRight, Zap } from 'lucide-react';

const APP = 'https://app.tinta-lab.de';

export default function CtaBanner() {
  return (
    <section
      aria-labelledby="cta-heading"
      className="py-20"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-blue-600 shadow-2xl shadow-blue-500/20">

          {/* Background decoration */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl" />
            {/* Grid overlay */}
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
          </div>

          <div className="relative px-8 sm:px-12 py-14 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs font-medium text-blue-100 mb-6">
              <Zap size={11} aria-hidden="true" />
              Готово к запуску за 15 минут
            </div>

            <h2
              id="cta-heading"
              className="text-3xl sm:text-4xl font-bold text-white mb-4"
            >
              Начните прямо сейчас
            </h2>
            <p className="text-blue-100/80 text-lg mb-8 max-w-lg mx-auto">
              Создайте аккаунт, получите Magic Install Link и подключите
              ваш Home Assistant за несколько минут.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`${APP}/auth/register`}
                className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-7 py-3 rounded-xl transition-all duration-200 hover:shadow-lg group"
              >
                Создать аккаунт
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="mailto:support@tinta-lab.de"
                className="inline-flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 bg-white/10 hover:bg-white/15 text-white font-medium text-sm px-7 py-3 rounded-xl transition-all duration-200"
              >
                Написать нам
              </a>
            </div>

            <p className="text-blue-200/50 text-xs mt-6">
              Нет скрытых платежей · Ваши данные остаются у вас · Поддержка по email
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
