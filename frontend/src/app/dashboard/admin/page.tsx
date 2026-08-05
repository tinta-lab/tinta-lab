'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import { Users, Server, Ticket, Activity, LogOut, RefreshCw, Wifi } from 'lucide-react';
import api from '@/lib/api';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

interface Stats {
  users: number;
  servers: number;
  tickets: number;
  activeAccess: number;
  agentsOnline: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [stats, setStats] = useState<Stats>({ users: 0, servers: 0, tickets: 0, activeAccess: 0, agentsOnline: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) loadStats();
  }, [user, router]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [usersRes, serversRes, ticketsRes, agentsRes] = await Promise.all([
        api.get('/users'),
        api.get('/servers'),
        api.get('/tickets'),
        api.get('/tinta-core/connected').catch(() => ({ data: { count: 0 } })),
      ]);
      const activeAccess = serversRes.data.filter((s: { accessEnabled: boolean }) => s.accessEnabled).length;
      setStats({
        users: usersRes.data.length,
        servers: serversRes.data.length,
        tickets: ticketsRes.data.length,
        activeAccess,
        agentsOnline: agentsRes.data.count ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const statCards = [
    { label: t('admin_users'),        value: stats.users,        icon: Users,    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: t('admin_servers'),      value: stats.servers,      icon: Server,   color: 'text-teal-400',   bg: 'bg-teal-500/10 border-teal-500/20' },
    { label: t('admin_tickets'),      value: stats.tickets,      icon: Ticket,   color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: t('admin_active_access'),value: stats.activeAccess, icon: Activity, color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
    { label: t('admin_agents_online'),value: stats.agentsOnline, icon: Wifi,     color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="https://tinta-lab.de">
              <img src="/logo.png" alt="Tinta Lab" className="w-8 h-8" />
            </a>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">/ Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadStats} className="text-slate-400 hover:text-white transition-colors" title={t('refresh')}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <AppLanguageSwitcher />
            <span className="text-sm text-slate-400">{user.firstName} {user.lastName}</span>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{t('admin_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('admin_subtitle')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className={`rounded-xl border p-5 ${s.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">{s.label}</span>
                <s.icon size={16} className={s.color} />
              </div>
              <div className={`text-3xl font-bold ${s.color}`}>
                {loading ? <span className="text-slate-600 text-lg">...</span> : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: t('admin_nav_users'),   desc: t('admin_nav_users_desc'),   icon: Users,  href: '/dashboard/admin/users',   color: 'text-blue-400' },
            { title: t('admin_nav_servers'), desc: t('admin_nav_servers_desc'), icon: Server, href: '/dashboard/admin/servers', color: 'text-teal-400' },
            { title: t('admin_nav_tickets'), desc: t('admin_nav_tickets_desc'), icon: Ticket, href: '/dashboard/admin/tickets', color: 'text-amber-400' },
            { title: t('admin_nav_agents'),  desc: t('admin_nav_agents_desc'),  icon: Wifi,   href: '/dashboard/admin/agents',  color: 'text-purple-400' },
          ].map((card) => (
            <button
              key={card.title}
              onClick={() => router.push(card.href)}
              className="text-left rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 hover:bg-slate-700/50 hover:border-slate-600 transition-all group"
            >
              <card.icon size={22} className={`${card.color} mb-3`} />
              <div className="font-semibold group-hover:text-teal-400 transition-colors">{card.title}</div>
              <div className="text-xs text-slate-400 mt-1">{card.desc}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
