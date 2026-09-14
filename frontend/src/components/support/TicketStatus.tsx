import { useLocale } from '@/i18n/context';
import { TicketStatus as TicketStatusValue } from '@/types';

const COLOR_MAP: Record<TicketStatusValue, string> = {
  new: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  in_progress: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  waiting_client: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  resolved: 'bg-green-500/10 border-green-500/30 text-green-400',
  closed: 'bg-slate-700/30 border-slate-700 text-slate-400',
};

const LABEL_KEY: Record<TicketStatusValue, Parameters<ReturnType<typeof useLocale>['t']>[0]> = {
  new: 'status_new_single',
  in_progress: 'status_in_progress_single',
  waiting_client: 'status_waiting_client_single',
  resolved: 'status_resolved_single',
  closed: 'status_closed_single',
};

export default function TicketStatus({ status }: { status: TicketStatusValue }) {
  const { t } = useLocale();
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${COLOR_MAP[status]}`}
    >
      {t(LABEL_KEY[status])}
    </span>
  );
}
