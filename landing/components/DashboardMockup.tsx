'use client';
import { Shield, Lightbulb, Thermometer, Lock, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

function DeviceRow({
  icon: Icon,
  label,
  sublabel,
  status,
  statusColor,
}: {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  status: string;
  statusColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
          <Icon size={13} className="text-slate-400" />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-200">{label}</div>
          <div className="text-[10px] text-slate-500">{sublabel}</div>
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
        {status}
      </span>
    </div>
  );
}

export default function DashboardMockup() {
  const t = useTranslations('mockup');

  return (
    <div aria-hidden="true" className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute inset-0 bg-teal-500/8 rounded-2xl blur-2xl scale-105" />

      <div className="relative bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs text-slate-400 ml-1">{t('title')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span>{t('status')}</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-slate-800/40 rounded-xl px-3 py-1 border border-slate-700/30">
            <DeviceRow
              icon={Lightbulb}
              label={t('living')}
              sublabel={t('livingSub')}
              status={t('on')}
              statusColor="bg-yellow-500/15 text-yellow-400"
            />
            <DeviceRow
              icon={Thermometer}
              label={t('climate')}
              sublabel={t('climateSub')}
              status="22 °C"
              statusColor="bg-blue-500/15 text-blue-400"
            />
            <DeviceRow
              icon={Lock}
              label={t('door')}
              sublabel={t('doorSub')}
              status={t('closed')}
              statusColor="bg-green-500/15 text-green-400"
            />
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0">
                  <Shield size={14} className="text-teal-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{t('accessTitle')}</div>
                  <div className="text-[10px] text-slate-500">{t('accessSub')}</div>
                </div>
              </div>
              <div className="w-10 h-5 bg-slate-700 rounded-full relative shrink-0">
                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 px-1">
            <CheckCircle size={11} className="text-green-400 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed">{t('lastVisit')}</div>
          </div>
        </div>
      </div>

      <div className="absolute -top-3 -right-4 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-2 whitespace-nowrap">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-slate-300">{t('systemOk')}</span>
      </div>

      <div className="absolute -bottom-3 -left-3 bg-teal-600 rounded-xl px-3 py-2 shadow-lg text-xs flex items-center gap-1.5 whitespace-nowrap">
        <Shield size={11} className="text-white" />
        <span className="text-white font-medium">{t('dataTag')}</span>
      </div>
    </div>
  );
}
