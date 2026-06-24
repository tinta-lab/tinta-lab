import {
  ShieldCheck, MousePointerClick, Zap,
  Activity, Smartphone, HeadphonesIcon,
} from 'lucide-react';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Безопасный доступ',
    desc: 'Cloudflare Zero Trust Tunnel. На вашем роутере не открыт ни один порт. Трафик идёт через зашифрованный канал.',
    accent: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: MousePointerClick,
    title: 'Вы контролируете доступ',
    desc: 'Специалист поддержки подключается к вашему Home Assistant только после того, как вы нажали «Разрешить». Одним кликом отзываете.',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: Zap,
    title: 'Автоматизации из коробки',
    desc: 'Готовые шаблоны: умное освещение, климат-контроль, безопасность. Применяются одним кликом без программирования.',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: Activity,
    title: 'Мониторинг 24/7',
    desc: 'Мгновенные уведомления при сбоях. Метрики CPU, RAM, диска и аптайм — в реальном времени. Автоматические тикеты поддержки.',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  {
    icon: Smartphone,
    title: 'Везде и всегда',
    desc: 'Личный кабинет адаптирован для смартфонов, планшетов и ПК. Следите за домом из любой точки мира.',
    accent: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
  },
  {
    icon: HeadphonesIcon,
    title: 'Профессиональная поддержка',
    desc: 'Сертифицированные специалисты Home Assistant. Настройка, обновление, устранение неполадок — без вашего участия.',
    accent: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
  },
];

export default function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="py-24 bg-slate-900/50"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            Возможности
          </div>
          <h2
            id="features-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
          >
            Всё что нужно для умного дома
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Tinta Lab объединяет лучшее из мира Home Assistant с профессиональным
            сервисом и корпоративной безопасностью.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
          {FEATURES.map(f => (
            <article
              key={f.title}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/60 hover:bg-slate-800/70 transition-all duration-200 group"
            >
              <div className={`inline-flex p-2.5 rounded-xl border ${f.bg} mb-4`}>
                <f.icon size={20} className={f.accent} aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {f.desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
