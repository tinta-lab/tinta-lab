'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServersSocket } from '@/hooks/useServersSocket';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { formatTime } from '@/lib/format';
import { AdminTicket, StaffTicket, SupportServer, TicketStatus } from '@/types';
import { LogOut, RefreshCw, Shield, KeyRound, Clock, LifeBuoy, ChevronRight, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';
import CredentialsModal, { AccessCredentials } from '@/components/staff/CredentialsModal';
import StaffTicketCard from '@/components/staff/StaffTicketCard';
import { staffTicketsApi } from '@/services/staffTicketsApi';

// Statuses that mean "someone on staff still has work to do here" — same
// set used to size the Open Tickets stat and populate the default list.
const OPEN_TICKET_STATUSES: TicketStatus[] = ['new', 'in_progress', 'waiting_client'];
const MAX_OPEN_TICKETS_SHOWN = 10;

function StatusDot({ status }: { status: SupportServer['status'] }) {
  const map = {
    online:  'bg-green-400 shadow-[0_0_6px_2px] shadow-green-400/50',
    offline: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[status]}`} />;
}

function AccessTimer({ expiresAt, label }: { expiresAt: string | null; label: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(label); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
      <Clock size={11} /> {remaining}
    </span>
  );
}

export default function SupportDashboard() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t, locale } = useLocale();
  const [servers, setServers] = useState<SupportServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);
  const [tickets, setTickets] = useState<(StaffTicket | AdminTicket)[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'support' && user.role !== 'admin') router.push('/auth/login');
    if (user) {
      loadServers();
      loadTickets();
    }
  }, [user, router]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<SupportServer[]>('/servers');
      setServers(data);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      setTickets(await staffTicketsApi.getAll());
    } finally {
      setTicketsLoading(false);
    }
  };

  useServersSocket({
    enabled: !!user,
    onServerUpdate: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
    }, []),
    onAccessChange: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
    }, []),
  });

  const handleConnect = async (server: SupportServer) => {
    setConnecting(server.id);
    try {
      const { data } = await api.post(`/access/connect/${server.id}`);
      const url = server.publicUrl ? `https://${server.publicUrl}` : `https://${server.subdomain}`;
      setCredentials({
        serverId: server.id,
        url,
        password: data?.supportPassword ?? '',
      });
    } catch (e: any) {
      if (e?.response?.status === 409) {
        toast.error(t('support_session_claimed'));
      } else {
        toast.error(t('support_connect_error'));
      }
    }
    setConnecting(null);
  };

  if (!user) return null;

  const online = servers.filter(s => s.status === 'online').length;
  const accessible = servers.filter(s => s.accessEnabled);

  const openTickets = tickets
    .filter(t => OPEN_TICKET_STATUSES.includes(t.status))
    .slice(0, MAX_OPEN_TICKETS_SHOWN);
  const waitingClientCount = tickets.filter(t => t.status === 'waiting_client').length;
  const openTicketsCount = tickets.filter(t => OPEN_TICKET_STATUSES.includes(t.status)).length;

  const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-5 py-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-700/40 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );

  const ServerCard = ({ server }: { server: SupportServer }) => (
    <div className="rounded-xl border p-5 transition-all border-green-500/30 bg-green-500/5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={server.status} />
          <div>
            <div className="font-semibold text-sm leading-tight">{server.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{server.subdomain}</div>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
          <Shield size={10} /> {t('support_access_open')}
        </span>
      </div>

      {server.client?.user && (
        <div className="text-xs text-slate-400 mb-3">
          {server.client.user.firstName} {server.client.user.lastName}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-4">
        {server.haVersion && <span className="bg-slate-700/50 rounded px-1.5 py-0.5">HA {server.haVersion}</span>}
        {server.lastSeenAt && (
          <span>
            {formatTime(server.lastSeenAt, locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <AccessTimer expiresAt={server.accessExpiresAt} label={t('support_expires')} />
      </div>

      <button
        onClick={() => handleConnect(server)}
        disabled={connecting === server.id}
        className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 disabled:opacity-50"
      >
        {connecting === server.id
          ? <RefreshCw size={14} className="animate-spin" />
          : <><KeyRound size={14} /> {t('support_get_access')}</>
        }
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {credentials && <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />}
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <a href="https://tinta-lab.de" className="flex-shrink-0">
              <img src="/logo.png" alt="Tinta Lab" className="w-8 h-8" />
            </a>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="hidden sm:block h-7 w-auto" />
            <span className="text-slate-500 text-sm whitespace-nowrap">/ Support</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {online} online
              </span>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5">
                <Shield size={11} className="text-amber-400" />
                {accessible.length} {t('support_access_open')}
              </span>
            </div>
            <button onClick={loadServers} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <AppLanguageSwitcher />
            <span className="hidden sm:inline text-sm text-slate-400">{user.firstName}</span>
            <button
              onClick={() => logout()}
              aria-label={t('logout')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('support_title')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('support_subtitle')}</p>
          </div>
          <Link
            href="/dashboard/support/security"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5"
          >
            <Shield size={13} className="text-amber-400" /> {t('security_center_title')}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon={<Inbox size={16} className="text-teal-400" />} label={t('support_stat_open_tickets')} value={openTicketsCount} />
          <StatCard icon={<Clock size={16} className="text-purple-400" />} label={t('support_stat_waiting_client')} value={waitingClientCount} />
          <StatCard icon={<Shield size={16} className="text-amber-400" />} label={t('support_stat_active_sessions')} value={accessible.length} />
        </div>

        {/* Open Tickets — default working view. "With what do I need to work
            right now?" comes before "which servers exist?" (P1.1). */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-300">{t('support_stat_open_tickets')}</h2>
            <Link href="/dashboard/support/tickets" className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-medium">
              {t('admin_tickets')} <ChevronRight size={12} />
            </Link>
          </div>
          {ticketsLoading ? (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 divide-y divide-slate-700/30">
              {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse" />)}
            </div>
          ) : openTickets.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-slate-700/50 text-slate-500">
              <LifeBuoy size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t('support_no_open_tickets')}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 divide-y divide-slate-700/30 overflow-hidden">
              {openTickets.map(ticket => <StaffTicketCard key={ticket.id} ticket={ticket} />)}
            </div>
          )}
        </section>

        {/* Active Support Sessions — servers this staff member currently has
            an open, granted session on. Secondary to tickets, not the
            landing content, but still one click away (no tab needed). */}
        <section>
          <h2 className="text-base font-semibold text-slate-300 mb-3">{t('support_stat_active_sessions')}</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-44 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
              ))}
            </div>
          ) : accessible.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-slate-700/50 text-slate-500">
              <Shield size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-400">{t('support_no_active')}</p>
              <p className="text-xs mt-1">{t('support_no_active_desc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accessible.map(server => <ServerCard key={server.id} server={server} />)}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
