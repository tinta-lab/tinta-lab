'use client';
import { useEffect, useState } from 'react';
import { RefreshCw, Inbox } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import { staffTicketsApi } from '@/services/staffTicketsApi';
import { AdminTicket, StaffTicket, TicketStatus } from '@/types';
import StaffTicketCard from '@/components/staff/StaffTicketCard';

const STATUS_FILTERS: (TicketStatus | 'all')[] = ['all', 'new', 'in_progress', 'waiting_client', 'resolved', 'closed'];
const STATUS_LABEL_KEY: Record<TicketStatus, TranslationKey> = {
  new: 'status_new_single',
  in_progress: 'status_in_progress_single',
  waiting_client: 'status_waiting_client_single',
  resolved: 'status_resolved_single',
  closed: 'status_closed_single',
};

export default function StaffTicketListPage() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<(StaffTicket | AdminTicket)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setTickets(await staffTicketsApi.getAll());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter((tk) => tk.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('tickets_h1')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('staff_ticket_nav_desc')}</p>
        </div>
        <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === s
                ? 'bg-teal-600 border-teal-500 text-white'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {s === 'all' ? t('filter_all_tickets') : t(STATUS_LABEL_KEY[s])}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
      ) : error ? (
        <div className="text-center py-12 border border-slate-700/50 rounded-xl text-slate-500">
          <p className="mb-3">{t('client_support_load_error')}</p>
          <button onClick={load} className="text-sm text-teal-400 hover:text-teal-300 font-medium">
            {t('client_support_try_again')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
          <Inbox size={32} className="mx-auto mb-3 opacity-30" />
          <p>{t('no_tickets')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
          {filtered.map((tk) => (
            <StaffTicketCard key={tk.id} ticket={tk} />
          ))}
        </div>
      )}
    </div>
  );
}
