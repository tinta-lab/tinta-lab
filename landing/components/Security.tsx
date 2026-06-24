import { ShieldCheck, Lock, Server } from 'lucide-react';

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Cloudflare Zero Trust',
    desc: 'Весь трафик между агентом и платформой идёт через Cloudflare Tunnel — зашифрованное соединение без единого открытого порта на вашем роутере. Снаружи нет ничего, что можно атаковать.',
    tag: 'TLS 1.3 / Zero open ports',
  },
  {
    icon: Lock,
    title: 'Доступ поддержки — только по запросу',
    desc: 'Специалист не может подключиться к вашему Home Assistant самостоятельно. Только после того, как вы явно нажали «Разрешить». Одним кликом отзываете в любой момент. Лог каждого сеанса хранится.',
    tag: 'Explicit consent model',
  },
  {
    icon: Server,
    title: 'Ваши данные остаются у вас',
    desc: 'Home Assistant работает на вашем оборудовании. Устройства, автоматизации и история — нигде не покидают ваш дом. Tinta Lab видит только метрики состояния агента и получает команды от вас.',
    tag: 'Local-first architecture',
  },
];

export default function Security() {
  return (
    <section
      id="security"
      aria-labelledby="security-heading"
      className="py-24 bg-slate-900/70"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
            Безопасность
          </div>
          <h2
            id="security-heading"
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
          >
            Ваш дом — ваши правила
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Три уровня защиты, которые обеспечивают корпоративную безопасность
            для вашего умного дома.
          </p>
        </div>

        {/* Full-width dark card */}
        <div className="bg-slate-950 border border-slate-800/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">

          {/* Top accent */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" aria-hidden="true" />

          <div className="grid lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/60">
            {PILLARS.map(p => (
              <article key={p.title} className="p-8">
                <div className="inline-flex p-3 rounded-xl bg-blue-600/10 border border-blue-500/20 mb-5">
                  <p.icon size={22} className="text-blue-400" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">{p.desc}</p>
                <code className="text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 rounded-md px-2 py-1">
                  {p.tag}
                </code>
              </article>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="px-8 py-4 bg-slate-900/50 border-t border-slate-800/60 flex flex-wrap gap-4 items-center justify-between">
            <p className="text-xs text-slate-500">
              Powered by{' '}
              <strong className="text-slate-400">Home Assistant</strong>
              {' & '}
              <strong className="text-slate-400">Cloudflare</strong>
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" aria-hidden="true" />
              Все данные остаются в вашей сети
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
