'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import { staffTicketsApi } from '@/services/staffTicketsApi';
import { AdminTicket, StaffTicket, StaffTicketMessage, TicketStatus } from '@/types';
import TicketStatusBadge from '@/components/support/TicketStatus';
import StaffMessageList from '@/components/staff/StaffMessageList';
import StaffMessageComposer from '@/components/staff/StaffMessageComposer';
import AccessStatusPanel from '@/components/staff/AccessStatusPanel';
import { canManageTickets } from '@/lib/permissions';
import { isAllowedTicketStatusTransition } from '@/lib/ticketStatusTransitions';

const TYPE_LABEL_KEY = {
  installation: 'type_installation',
  support: 'type_support',
  sales: 'type_sales',
  other: 'type_other',
} as const;

const STATUS_OPTIONS: TicketStatus[] = ['new', 'in_progress', 'waiting_client', 'resolved', 'closed'];
const STATUS_LABEL_KEY: Record<TicketStatus, TranslationKey> = {
  new: 'status_new_single',
  in_progress: 'status_in_progress_single',
  waiting_client: 'status_waiting_client_single',
  resolved: 'status_resolved_single',
  closed: 'status_closed_single',
};

export default function StaffTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLocale();

  const [ticket, setTicket] = useState<StaffTicket | AdminTicket | null>(null);
  const [messages, setMessages] = useState<StaffTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const canEditStatus = canManageTickets(user?.role);

  const load = async () => {
    setLoading(true);
    setError(false);
    setNotFound(false);
    try {
      const [ticketData, messagesData] = await Promise.all([
        staffTicketsApi.getById(id),
        staffTicketsApi.getMessages(id),
      ]);
      setTicket(ticketData);
      setMessages(messagesData);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 404) setNotFound(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const sendMessage = async (message: string, internal: boolean) => {
    try {
      await staffTicketsApi.addMessage(id, message, internal);
      const messagesData = await staffTicketsApi.getMessages(id);
      setMessages(messagesData);
    } catch {
      toast.error(t('client_support_reply_error'));
    }
  };

  const changeStatus = async (status: TicketStatus) => {
    if (!ticket) return;
    setStatusSaving(true);
    try {
      const updated = await staffTicketsApi.updateStatus(id, status, ticket.internalNotes);
      setTicket(updated);
      toast.success(t('sales_ticket_updated'));
    } catch {
      toast.error(t('error'));
    } finally {
      setStatusSaving(false);
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
        <Link href="/dashboard/support/tickets" className="text-sm text-teal-400 hover:text-teal-300 font-medium">
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
        href="/dashboard/support/tickets"
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> {t('client_support_back_tickets')}
      </Link>

      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
          <span>{ticket.name} · {ticket.email}</span>
          <span>{t(TYPE_LABEL_KEY[ticket.type])}</span>
          {ticket.server?.name && (
            <span>{t('staff_ticket_home_label')}: {ticket.server.name}</span>
          )}
          <span>
            {t('client_support_created_label')}:{' '}
            {new Date(ticket.createdAt).toLocaleString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {canEditStatus && (
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={
                statusSaving ||
                s === ticket.status ||
                !isAllowedTicketStatusTransition(ticket.status, s)
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                s === ticket.status
                  ? 'bg-teal-600 border-teal-500 text-white'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {statusSaving && s !== ticket.status ? <RefreshCw size={12} className="animate-spin inline" /> : t(STATUS_LABEL_KEY[s])}
            </button>
          ))}
        </div>
      )}

      <AccessStatusPanel server={ticket.server} />

      <section>
        <h2 className="text-base font-semibold text-slate-300 mb-2">{t('client_support_conversation')}</h2>
        <StaffMessageList messages={messages} />
        <div className="mt-3">
          <StaffMessageComposer onSend={sendMessage} />
        </div>
      </section>
    </div>
  );
}
