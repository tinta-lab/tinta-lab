import { Wifi, Shield, Cpu, MemoryStick, HardDrive, Zap, Smartphone, Clock } from 'lucide-react';

function MetricBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} bar-animate`}
          style={{ width: `${pct}%` }}
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${pct}%`}
        />
      </div>
    </div>
  );
}

export default function DashboardMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-sm mx-auto select-none"
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl blur-2xl scale-105" />

      {/* Card */}
      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs text-slate-400 ml-1">Tinta Lab — Admin</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <Wifi size={11} />
            <span>Онлайн</span>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* Client card */}
          <div className="bg-slate-800/70 rounded-xl p-3 border border-slate-700/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white">Viktor G.</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                ● Online
              </span>
            </div>
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="bg-slate-700/50 rounded px-1.5 py-0.5">HA 2025.1.3</span>
              <span className="bg-slate-700/50 rounded px-1.5 py-0.5">Agent v2026.4</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="space-y-2.5">
            <MetricBar label="CPU"   pct={42} color="bg-blue-500"   />
            <MetricBar label="RAM"   pct={61} color="bg-indigo-500" />
            <MetricBar label="Диск"  pct={38} color="bg-slate-500"  />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Smartphone, value: '192', label: 'устройств' },
              { icon: Zap,        value: '7',   label: 'автоматиз.' },
              { icon: Clock,      value: '3д',  label: 'аптайм' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
                <s.icon size={12} className="text-slate-500 mx-auto mb-1" />
                <div className="text-sm font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Access toggle — key differentiator */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-slate-400 shrink-0" />
              <div>
                <div className="text-xs font-medium text-slate-300">Доступ поддержки</div>
                <div className="text-xs text-slate-500">Временно заблокирован</div>
              </div>
            </div>
            {/* Toggle (off) */}
            <div className="shrink-0 w-10 h-5 bg-slate-700 rounded-full relative">
              <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-slate-500 transition-all" />
            </div>
          </div>

          {/* Metrics mini icons */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Cpu size={10} />
              <span>Метрики live</span>
            </div>
            <div className="flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-sm bg-blue-500/60"
                  style={{ height: `${[8, 14, 10, 18, 12][i]}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification */}
      <div className="absolute -top-3 -right-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-2 whitespace-nowrap">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-slate-300">Агент подключён</span>
      </div>

      {/* Floating lock badge */}
      <div className="absolute -bottom-3 -left-3 bg-blue-600 rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-1.5 whitespace-nowrap">
        <Shield size={11} className="text-white" />
        <span className="text-white font-medium">Zero Trust</span>
      </div>
    </div>
  );
}
