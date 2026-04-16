'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServersSocket } from '@/hooks/useServersSocket';
import api from '@/lib/api';
import { Server } from '@/types';
import { LogOut, RefreshCw, Wifi, WifiOff, Clock, Shield, ExternalLink, AlertCircle } from 'lucide-react';

function StatusDot({ status }: { status: Server['status'] }) {
  const map = {
    online:  'bg-green-400 shadow-[0_0_6px_2px] shadow-green-400/50',
    offline: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[status]}`} />;
}

function AccessTimer({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('истекает...'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}м ${s}с`);
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
  const { user, logout, init, token } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'support' && user.role !== 'admin') router.push('/auth/login');
    if (user) loadServers();
  }, [user, router]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Server[]>('/servers');
      setServers(data);
    } finally {
      setLoading(false);
    }
  };

  useServersSocket({
    token,
    onServerUpdate: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
    }, []),
    onAccessChange: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
    }, []),
  });

  const handleConnect = async (server: Server) => {
    setConnecting(server.id);
    try {
      await api.post(`/access/connect/${server.id}`);
    } catch { /* log silently */ }
    const url = server.localUrl || `https://${server.subdomain}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setConnecting(null);
  };

  if (!user) return null;

  const online = servers.filter(s => s.status === 'online').length;
  const withAccess = servers.filter(s => s.accessEnabled).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L4 10V22L16 28L28 22V10L16 4Z" stroke="#2dd4bf" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="16" cy="16" r="3" fill="#2dd4bf"/>
              </svg>
            </div>
            <span className="font-semibold">Tinta Smart</span>
            <span className="text-slate-500 text-sm">/ Support</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                {online} online
              </span>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1.5">
                <Shield size={11} className="text-amber-400" />
                {withAccess} открыт доступ
              </span>
            </div>
            <button onClick={loadServers} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <span className="text-sm text-slate-400">{user.firstName}</span>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Серверы клиентов</h1>
          <p className="text-slate-400 text-sm mt-1">
            Доступ открывает клиент — вы получаете уведомление и можете подключиться
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-6 flex items-start gap-3 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-sm text-slate-400">
          <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            Подключение возможно только когда клиент разрешил доступ.
            Зелёный значок <Shield size={12} className="inline text-green-400 mx-1" /> означает — доступ открыт, можно подключаться.
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <WifiOff size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-slate-400">Серверов пока нет</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map(server => (
              <div
                key={server.id}
                className={`rounded-xl border p-5 transition-all ${
                  server.accessEnabled
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-slate-700/50 bg-slate-800/50'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StatusDot status={server.status} />
                    <div>
                      <div className="font-semibold text-sm leading-tight">{server.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{server.subdomain}</div>
                    </div>
                  </div>
                  {/* Access badge */}
                  {server.accessEnabled ? (
                    <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
                      <Shield size={10} /> доступ открыт
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-slate-700/50 text-slate-500 border border-slate-700 rounded-full px-2 py-0.5 flex-shrink-0">
                      ожидание
                    </span>
                  )}
                </div>

                {/* Client */}
                {server.client?.user && (
                  <div className="text-xs text-slate-400 mb-3">
                    {server.client.user.firstName} {server.client.user.lastName}
                    <span className="text-slate-600 ml-1">· {server.client.user.email}</span>
                  </div>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-4">
                  {server.haVersion && <span className="bg-slate-700/50 rounded px-1.5 py-0.5">HA {server.haVersion}</span>}
                  {server.lastSeenAt && (
                    <span>
                      {new Date(server.lastSeenAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <AccessTimer expiresAt={server.accessExpiresAt} />
                </div>

                {/* Connect button — only when client granted access */}
                {server.accessEnabled ? (
                  <button
                    onClick={() => handleConnect(server)}
                    disabled={connecting === server.id}
                    className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 disabled:opacity-50"
                  >
                    {connecting === server.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <><ExternalLink size={14} /> Подключиться к HA{server.localUrl && <span className="text-xs opacity-60 ml-1">(локально)</span>}</>
                    }
                  </button>
                ) : (
                  <div className="w-full py-2 rounded-lg text-sm flex items-center justify-center gap-2 bg-slate-700/20 border border-slate-700/30 text-slate-600 cursor-not-allowed select-none">
                    <Wifi size={14} /> Ожидание разрешения клиента
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
