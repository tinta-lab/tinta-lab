'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, RefreshCw } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/context';
import { formatDateTime } from '@/lib/format';
import { supportApi } from '@/services/supportApi';
import { ClientTicketDetail } from '@/types';
import TicketStatus from '@/components/support/TicketStatus';
import TicketMessageList from '@/components/support/TicketMessageList';
import SupportAccessCard from '@/components/support/SupportAccessCard';

const TYPE_LABEL_KEY = {
  installation: 'client_support_type_installation',
  support: 'client_support_type_support',
  sales: 'client_support_type_sales',
  other: 'client_support_type_other',
} as const;

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLocale();

  const [ticket, setTicket] = useState<ClientTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      setTicket(await supportApi.getMyTicket(id));
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) setNotFound(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const submitReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supportApi.addMessage(id, reply.trim());
      setReply('');
      await load();
    } catch {
      toast.error(t('client_support_reply_error'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 bg-slate-800/60 rounded animate-pulse" />
        <div className="h-40 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
        <p className="mb-3">{t('client_support_not_found')}</p>
        <Link href="/dashboard/client/support/tickets" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
          {t('client_support_back_tickets')}
        </Link>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
        <p className="mb-3">{t('client_support_ticket_load_error')}</p>
        <button onClick={load} className="text-sm text-teal-400 hover:text-teal-300 font-medium">
          {t('client_support_try_again')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/client/support/tickets"
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> {t('client_support_back_tickets')}
      </Link>

      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <TicketStatus status={ticket.status} />
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
          <span>{t(TYPE_LABEL_KEY[ticket.type])}</span>
          {ticket.server?.name && (
            <span>
              {t('client_support_ticket_home_label')}: {ticket.server.name}
            </span>
          )}
          <span>
            {t('client_support_created_label')}:{' '}
            {formatDateTime(ticket.createdAt, locale, {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {ticket.server && (
        <section>
          <SupportAccessCard server={ticket.server} onChanged={load} ticketId={ticket.id} />
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-2">{t('client_support_conversation')}</h2>
        <TicketMessageList messages={ticket.messages} />

        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t('client_support_reply_ph')}
            maxLength={4000}
            rows={2}
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors resize-y"
          />
          <button
            onClick={submitReply}
            disabled={sending || !reply.trim()}
            className="h-9 px-4 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
          >
            {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {t('client_support_reply_submit')}
          </button>
        </div>
      </section>
    </div>
  );
}
