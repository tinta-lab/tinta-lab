'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServersSocket } from '@/hooks/useServersSocket';
import api from '@/lib/api';
import { Server } from '@/types';
import { LogOut, RefreshCw, Shield, ExternalLink, Copy, Check, X, KeyRound, Clock } from 'lucide-react';

interface AccessCredentials {
  serverId: string;
  url: string;
  password: string;
}

function CredentialsModal({ creds, onClose }: { creds: AccessCredentials; onClose: () => void }) {
  const [copied, setCopied] = useState<'url' | 'pass' | null>(null);

  const copy = (text: string, field: 'url' | 'pass') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const openHA = () => {
    window.open(creds.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-amber-400" />
            <span className="font-semibold">Данные для входа</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          Используйте логин <span className="font-mono text-white">tinta-support</span> и временный пароль ниже. Пароль меняется при каждом открытии доступа.
        </p>
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Адрес</div>
              <div className="font-mono text-sm text-white">{creds.url}</div>
            </div>
            <button onClick={() => copy(creds.url, 'url')} className="text-slate-400 hover:text-white ml-3 flex-shrink-0">
              {copied === 'url' ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </div>
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Пароль</div>
              <div className="font-mono text-sm text-white tracking-wider">{creds.password}</div>
            </div>
            <button onClick={() => copy(creds.password, 'pass')} className="text-slate-400 hover:text-white ml-3 flex-shrink-0">
              {copied === 'pass' ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
        <button
          onClick={openHA}
          className="w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 font-medium flex items-center justify-center gap-2 transition-all"
        >
          <ExternalLink size={15} /> Открыть Home Assistant
        </button>
      </div>
    </div>
  );
}

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
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

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
      const { data } = await api.post(`/access/connect/${server.id}`);
      // Always use the public tunnel URL — support works remotely, never on client's LAN
      const url = `https://${server.subdomain}`;
      setCredentials({
        serverId: server.id,
        url,
        password: data?.supportPassword ?? '',
      });
    } catch { /* log silently */ }
    setConnecting(null);
  };

  if (!user) return null;

  const online = servers.filter(s => s.status === 'online').length;
  const accessible = servers.filter(s => s.accessEnabled);

  const ServerCard = ({ server }: { server: Server }) => (
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
          <Shield size={10} /> доступ открыт
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
            {new Date(server.lastSeenAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <AccessTimer expiresAt={server.accessExpiresAt} />
      </div>

      <button
        onClick={() => handleConnect(server)}
        disabled={connecting === server.id}
        className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 disabled:opacity-50"
      >
        {connecting === server.id
          ? <RefreshCw size={14} className="animate-spin" />
          : <><KeyRound size={14} /> Получить доступ</>
        }
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {credentials && <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />}
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Tinta Lab" className="w-8 h-8" />
            <span className="font-semibold">Tinta Lab</span>
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
                {accessible.length} открыт доступ
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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        ) : accessible.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium text-slate-400">Нет активных сессий доступа</p>
            <p className="text-sm mt-1">Клиент должен включить переключатель в Home Assistant</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessible.map(server => <ServerCard key={server.id} server={server} />)}
          </div>
        )}
      </main>
    </div>
  );
}
