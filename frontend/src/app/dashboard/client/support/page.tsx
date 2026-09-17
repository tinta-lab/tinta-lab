'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LifeBuoy, Inbox, Shield } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { supportApi } from '@/services/supportApi';
import { ClientServer, ClientTicket } from '@/types';
import TicketCard from '@/components/support/TicketCard';

export default function SupportCenterPage() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [servers, setServers] = useState<ClientServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [ticketsData, serversRes] = await Promise.all([
        supportApi.getMyTickets(),
        api.get<ClientServer[]>('/servers/my'),
      ]);
      setTickets(ticketsData);
      setServers(serversRes.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const recent = tickets.slice(0, 3);
  const hasActiveAccess = servers.some((s) => s.accessEnabled);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">{t('client_support_home_title')}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{t('client_support_home_subtitle')}</p>
      </div>

      {error ? (
        <div className="text-center py-12 border border-slate-700/50 rounded-xl text-slate-500">
          <p className="mb-3">{t('client_support_load_error')}</p>
          <button
            onClick={load}
            className="text-sm text-teal-400 hover:text-teal-300 font-medium"
          >
            {t('client_support_try_again')}
          </button>
        </div>
      ) : (
        <>
          {/* Primary CTA */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-6 text-center">
            <p className="text-sm text-slate-300 mb-4">{t('client_support_get_help_prompt')}</p>
            <Link
              href="/dashboard/client/support/tickets/new"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <LifeBuoy size={16} /> {t('client_support_get_help')}
            </Link>
          </div>

          {/* Active Support — status only, no per-server grant/revoke controls
              here; access management stays contextual within ticket detail. */}
          <section className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Shield size={16} />
              <span className="text-sm font-medium">{t('client_support_active_access')}</span>
            </div>
            {loading ? (
              <div className="h-5 w-40 bg-slate-700/50 rounded animate-pulse" />
            ) : hasActiveAccess ? (
              <p className="text-sm text-green-400">{t('client_access_open')}</p>
            ) : (
              <p className="text-sm text-slate-500">{t('client_support_no_active_session')}</p>
            )}
          </section>

          {/* Recent requests */}
          <section>
            <h2 className="text-base font-semibold text-slate-300 mb-3">{t('client_support_recent')}</h2>

            {loading ? (
              <div className="h-32 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
            ) : recent.length === 0 ? (
              <div className="text-center py-10 border border-slate-700/50 rounded-xl text-slate-500">
                <Inbox size={28} className="mx-auto mb-3 opacity-30" />
                <p>{t('client_support_empty')}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
                {recent.map((tk) => (
                  <TicketCard key={tk.id} ticket={tk} />
                ))}
              </div>
            )}
          </section>

          {/* Bottom action row */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/client/support/tickets/new"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <LifeBuoy size={14} /> {t('client_support_get_help')}
            </Link>
            <Link
              href="/dashboard/client/support/tickets"
              className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {t('client_support_view_all_tickets')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
