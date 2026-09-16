import { useLocale } from '@/i18n/context';
import { AccessEventView } from '@/types';
import AccessLogEventBadge from './AccessLogEventBadge';

interface AccessLogTableProps {
  events: AccessEventView[];
  onSelect: (accessLogId: string) => void;
}

export default function AccessLogTable({ events, onSelect }: AccessLogTableProps) {
  const { t } = useLocale();

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/50">
            <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('access_logs_col_time')}</th>
            <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('access_logs_col_event')}</th>
            <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('access_logs_col_client')}</th>
            <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('access_logs_col_server')}</th>
            <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('access_logs_col_actor')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => (
            <tr
              key={ev.id}
              onClick={() => onSelect(ev.accessLogId)}
              className={`${i < events.length - 1 ? 'border-b border-slate-700/30' : ''} hover:bg-slate-800/30 transition-colors cursor-pointer`}
            >
              <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                {new Date(ev.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-4 py-3"><AccessLogEventBadge eventType={ev.eventType} /></td>
              <td className="px-4 py-3 text-slate-300">
                {ev.client ? `${ev.client.firstName} ${ev.client.lastName}` : '—'}
              </td>
              <td className="px-4 py-3 text-slate-300">{ev.server?.name ?? '—'}</td>
              <td className="px-4 py-3 text-slate-300">
                {ev.actor ? `${ev.actor.firstName} ${ev.actor.lastName}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
