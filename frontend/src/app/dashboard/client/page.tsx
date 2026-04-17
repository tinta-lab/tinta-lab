'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServersSocket } from '@/hooks/useServersSocket';
import api from '@/lib/api';
import { Server } from '@/types';
import { LogOut, RefreshCw, Unlock, Lock, Clock, Shield, Wifi, WifiOff, CheckCircle, XCircle, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { toast } from 'sonner';

interface AccessLog {
  id: string;
  grantedAt: string;
  expiresAt: string;
  connectedAt: string | null;
  revokedAt: string | null;
  isRevoked: boolean;
  grantedBy: { firstName: string; lastName: string };
  accessedBy: { firstName: string; lastName: string } | null;
  server: { name: string };
  activityLog: string[] | null;
}

function StatusDot({ status }: { status: Server['status'] }) {
  const map = {
    online:  'bg-green-400 shadow-[0_0_6px_2px] shadow-green-400/50',
    offline: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[status]}`} />;
}

function AccessCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState('');
  const [pct, setPct] = useState(100);
  const total = 60 * 60 * 1000; // 60 min

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('00:00'); setPct(0); onExpire(); return; }
      const m = Math.floor(diff / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setRemaining(`${m}:${s}`);
      setPct(Math.max(0, (diff / total) * 100));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const color = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-slate-400 flex items-center gap-1"><Clock size={11} /> Доступ закроется через</span>
        <span className="font-mono font-bold text-white">{remaining}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActivityLogSection({ entries }: { entries: string[] }) {
  const [open, setOpen] = useState(false);
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-slate-600 italic pl-5 mt-1">Действий не зафиксировано</p>;
  }
  return (
    <div className="pl-5 mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <Activity size={11} className="text-teal-500" />
        Действия саппорта ({entries.length})
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <ul className="mt-2 space-y-0.5">
          {entries.map((e, i) => (
            <li key={i} className="text-xs text-slate-400 font-mono bg-slate-800/40 rounded px-2 py-1">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClientDashboard() {
  const router = useRouter();
  const { user, logout, init, token } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'client') router.push('/auth/login');
    if (user) { loadServers(); loadLogs(); }
  }, [user, router]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Server[]>('/servers/my');
      setServers(data);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const { data } = await api.get<AccessLog[]>('/access/my-logs');
      setLogs(data);
    } catch { /* no logs yet */ }
  };

  useServersSocket({
    token,
    onServerUpdate: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
    }, []),
    onAccessChange: useCallback((u) => {
      setServers(prev => prev.map(s => s.id === u.id ? { ...s, ...u } : s));
      loadLogs();
    }, []),
  });

  const grantAccess = async (serverId: string) => {
    setActionLoading(serverId);
    try {
      await api.post(`/access/grant/${serverId}`);
      toast.success('Доступ открыт на 60 минут');
      await loadServers();
      await loadLogs();
    } catch {
      toast.error('Не удалось открыть доступ');
    } finally {
      setActionLoading(null);
    }
  };

  const revokeAccess = async (serverId: string) => {
    setActionLoading(serverId);
    try {
      await api.delete(`/access/revoke/${serverId}`);
      toast.success('Доступ закрыт');
      await loadServers();
      await loadLogs();
    } catch {
      toast.error('Не удалось закрыть доступ');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Tinta Smart" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold">Tinta Lab</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user.firstName} {user.lastName}</span>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Servers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Мой умный дом</h1>
              <p className="text-slate-400 text-sm mt-0.5">Управление доступом для службы поддержки</p>
            </div>
            <button onClick={loadServers} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <div className="h-48 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
          ) : servers.length === 0 ? (
            <div className="text-center py-12 border border-slate-700/50 rounded-xl text-slate-500">
              <WifiOff size={32} className="mx-auto mb-2 opacity-30" />
              <p>Сервер ещё не зарегистрирован</p>
            </div>
          ) : servers.map(server => (
            <div key={server.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
              {/* Server info */}
              <div className="flex items-center gap-3 mb-4">
                <StatusDot status={server.status} />
                <div>
                  <div className="font-semibold">{server.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{server.subdomain}</span>
                    {server.haVersion && <span className="bg-slate-700/60 rounded px-1.5 py-0.5">HA {server.haVersion}</span>}
                    <span className={`capitalize ${
                      server.status === 'online' ? 'text-green-400' :
                      server.status === 'offline' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {server.status === 'online' ? 'в сети' : server.status === 'offline' ? 'нет связи' : 'неизвестно'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Access control */}
              {server.accessEnabled ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-green-400" />
                    <span className="font-medium text-green-400">Доступ для поддержки открыт</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Сотрудник поддержки может войти в ваш Home Assistant для выполнения работ.
                  </p>
                  {server.accessExpiresAt && (
                    <AccessCountdown
                      expiresAt={server.accessExpiresAt}
                      onExpire={loadServers}
                    />
                  )}
                  <button
                    onClick={() => revokeAccess(server.id)}
                    disabled={actionLoading === server.id}
                    className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === server.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <><Lock size={14} /> Закрыть доступ досрочно</>
                    }
                  </button>
                </div>
              ) : (
                <div className="bg-slate-700/20 border border-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-300">Доступ закрыт</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Если вам нужна помощь — нажмите кнопку ниже. Доступ автоматически
                    закроется через 60 минут.
                  </p>
                  <button
                    onClick={() => grantAccess(server.id)}
                    disabled={actionLoading === server.id}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === server.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <><Unlock size={14} /> Разрешить доступ поддержке — 60 мин</>
                    }
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Access history */}
        {logs.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Shield size={15} className="text-slate-500" /> История доступа
            </h2>
            <div className="rounded-xl border border-slate-700/50 overflow-hidden divide-y divide-slate-700/50">
              {logs.map((log) => {
                const ended = log.isRevoked ? log.revokedAt : (new Date(log.expiresAt) < new Date() ? log.expiresAt : null);
                const isActive = !log.isRevoked && new Date(log.expiresAt) >= new Date();
                const sessionDuration = (() => {
                  if (!log.connectedAt) return null;
                  const endMs = log.isRevoked && log.revokedAt
                    ? new Date(log.revokedAt).getTime()
                    : new Date(log.expiresAt).getTime();
                  const diff = Math.max(0, endMs - new Date(log.connectedAt).getTime());
                  const m = Math.floor(diff / 60000);
                  const s = Math.floor((diff % 60000) / 1000);
                  return m > 0 ? `${m} мин` : `${s} сек`;
                })();

                return (
                  <div key={log.id} className="px-4 py-4 text-sm">
                    {/* Row 1: date + status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                        ) : log.connectedAt ? (
                          <CheckCircle size={14} className="text-slate-400 flex-shrink-0" />
                        ) : (
                          <XCircle size={14} className="text-slate-600 flex-shrink-0" />
                        )}
                        <span className="text-slate-300 font-medium">
                          {new Date(log.grantedAt).toLocaleDateString('de-DE', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                          })}
                        </span>
                        <span className="text-slate-500">
                          {new Date(log.grantedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : log.isRevoked
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-slate-700/30 border-slate-700 text-slate-500'
                      }`}>
                        {isActive ? 'Активен' : log.isRevoked ? 'Закрыт досрочно' : 'Завершён'}
                      </span>
                    </div>

                    {/* Row 2: details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pl-5">
                      <div className="text-slate-500">Сервер</div>
                      <div className="text-slate-300">{log.server?.name}</div>

                      {log.accessedBy ? (
                        <>
                          <div className="text-slate-500">Сотрудник</div>
                          <div className="text-slate-300">{log.accessedBy.firstName} {log.accessedBy.lastName}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-slate-500">Сотрудник</div>
                          <div className="text-slate-600 italic">не подключался</div>
                        </>
                      )}

                      {log.connectedAt && (
                        <>
                          <div className="text-slate-500">Подключился</div>
                          <div className="text-slate-300">
                            {new Date(log.connectedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      )}

                      {ended && (
                        <>
                          <div className="text-slate-500">{log.isRevoked ? 'Закрыт' : 'Истёк'}</div>
                          <div className="text-slate-300">
                            {new Date(ended).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      )}

                      {sessionDuration && (
                        <>
                          <div className="text-slate-500">Длительность</div>
                          <div className="text-slate-300">{sessionDuration}</div>
                        </>
                      )}
                    </div>

                    {/* Activity log — only for completed sessions */}
                    {!isActive && log.activityLog !== undefined && (
                      <ActivityLogSection entries={log.activityLog ?? []} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Журнал сессий хранится в соответствии с DSGVO · Данные доступны по запросу
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
