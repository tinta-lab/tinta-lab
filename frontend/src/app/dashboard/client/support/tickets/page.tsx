'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Inbox } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import { supportApi } from '@/services/supportApi';
import { ClientTicket } from '@/types';
import TicketCard from '@/components/support/TicketCard';

export default function TicketListPage() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setTickets(await supportApi.getMyTickets());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('client_support_tickets_title')}</h1>
        <Link
          href="/dashboard/client/support/tickets/new"
          className="inline-flex items-center gap-1.5 text-sm bg-teal-600 hover:bg-teal-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> {t('client_support_new_request')}
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{t('client_support_loading')}</p>
          <div className="h-48 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-center py-12 border border-slate-700/50 rounded-xl text-slate-500">
          <p className="mb-3">{t('client_support_load_error')}</p>
          <button onClick={load} className="text-sm text-teal-400 hover:text-teal-300 font-medium">
            {t('client_support_try_again')}
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
          <Inbox size={32} className="mx-auto mb-3 opacity-30" />
          <p className="mb-3">{t('client_support_empty')}</p>
          <Link
            href="/dashboard/client/support/tickets/new"
            className="text-sm text-teal-400 hover:text-teal-300 font-medium"
          >
            {t('client_support_create')}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
          {tickets.map((tk) => (
            <TicketCard key={tk.id} ticket={tk} />
          ))}
        </div>
      )}
    </div>
  );
}
