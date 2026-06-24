import { UserPlus, Download, CheckCircle } from 'lucide-react';

const STEPS = [
  {
    n: '01',
    icon: UserPlus,
    title: 'Создайте аккаунт',
    desc: 'Заполните форму за 2 минуты. Наш менеджер свяжется с вами и настроит персональный поддомен для вашего Home Assistant.',
    note: 'Без технических знаний',
  },
  {
    n: '02',
    icon: Download,
    title: 'Установите агент',
    desc: 'Получите Magic Install Link — откройте ссылку и следуйте инструкции. Один аддон в Home Assistant, один клик «Запустить».',
    note: '5 минут на установку',
  },
  {
    n: '03',
    icon: CheckCircle,
    title: 'Пользуйтесь',
    desc: 'Система подключена. Управляйте устройствами из личного кабинета, разрешайте доступ поддержке когда нужна помощь.',
    note: 'Поддержка 24/7',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-heading"
      className="py-24"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            Как работает
          </div>
          <h2
            id="hiw-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
          >
            Три шага до умного дома
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            От регистрации до полностью работающей системы — меньше 15 минут.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-12 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"
            aria-hidden="true"
          />

          <ol className="grid lg:grid-cols-3 gap-8 lg:gap-6" role="list">
            {STEPS.map((s, i) => (
              <li key={s.n} className="flex flex-col items-center text-center lg:items-start lg:text-left">

                {/* Icon circle */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shadow-black/30">
                    <s.icon size={24} className="text-blue-400" aria-hidden="true" />
                  </div>
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center"
                    aria-label={`Шаг ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                </div>

                <div className="text-xs font-mono text-slate-600 mb-1">{s.n}</div>
                <h3 className="text-lg font-semibold text-white mb-3">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-xs lg:max-w-none">
                  {s.desc}
                </p>
                <span className="inline-block text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-3 py-1">
                  {s.note}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
