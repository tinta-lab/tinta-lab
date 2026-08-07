'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useServersSocket } from '@/hooks/useServersSocket';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { Server } from '@/types';
import { LogOut, RefreshCw, Unlock, Lock, Clock, Shield, WifiOff, CheckCircle, XCircle, ChevronDown, ChevronUp, Activity, UserCog, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

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
  reason: string | null;
}

function StatusDot({ status }: { status: Server['status'] }) {
  const map = {
    online:  'bg-green-400 shadow-[0_0_6px_2px] shadow-green-400/50',
    offline: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[status]}`} />;
}

function AccessCountdown({ expiresAt, onExpire, label }: { expiresAt: string; onExpire: () => void; label: string }) {
  const [remaining, setRemaining] = useState('');
  const [pct, setPct] = useState(100);
  // Sessions can now last 15/30/60 min — track the window from first render
  // instead of assuming a fixed 60 min total.
  const totalRef = useRef<number | null>(null);

  useEffect(() => {
    totalRef.current = null;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (totalRef.current === null) totalRef.current = Math.max(diff, 1);
      if (diff <= 0) { setRemaining('00:00'); setPct(0); onExpire(); return; }
      const m = Math.floor(diff / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setRemaining(`${m}:${s}`);
      setPct(Math.max(0, (diff / totalRef.current) * 100));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const color = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-slate-400 flex items-center gap-1"><Clock size={11} /> {label}</span>
        <span className="font-mono font-bold text-white">{remaining}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ActivityLogSection({ entries, t }: { entries: string[]; t: (k: any) => string }) {
  const [open, setOpen] = useState(false);
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-slate-600 italic pl-5 mt-1">{t('client_log_no_actions')}</p>;
  }
  return (
    <div className="pl-5 mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <Activity size={11} className="text-teal-500" />
        {t('client_log_support_actions')} ({entries.length})
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

type ProfileTab = 'info' | 'password';

function ProfileModal({ user, onClose, t }: { user: any; onClose: () => void; t: (k: any) => string }) {
  const { init } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('info');
  const [saving, setSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [infoForm, setInfoForm] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: '',
    city: '',
  });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/clients/me').then(({ data }) => {
      setInfoForm(f => ({ ...f, phone: data.phone ?? '', city: data.city ?? '' }));
    }).catch(() => {});
  }, []);

  const saveInfo = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/me', { firstName: infoForm.firstName, lastName: infoForm.lastName });
      await api.patch('/auth/me/client-profile', { phone: infoForm.phone, city: infoForm.city });
      await init();
      toast.success(t('profile_saved'));
      onClose();
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    const errs: Record<string, string> = {};
    if (!pwForm.oldPassword) errs.old = t('err_required');
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) errs.new = t('err_min8');
    if (pwForm.newPassword !== pwForm.confirm) errs.confirm = t('reg_val_match');
    setPwErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api.post('/auth/change-password', { oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      toast.success(t('pw_changed'));
      onClose();
    } catch (e: any) {
      if (e.response?.status === 403) toast.error(t('pw_wrong_old'));
      else toast.error(t('error'));
    } finally { setSaving(false); }
  };

  const inputCls = (err?: string) =>
    `w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${err ? 'border-red-500' : 'border-slate-600 focus:border-teal-500'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold">{t('profile_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-700">
          {(['info', 'password'] as ProfileTab[]).map(tab_name => (
            <button
              key={tab_name}
              onClick={() => setTab(tab_name)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === tab_name ? 'text-teal-400 border-b-2 border-teal-400' : 'text-slate-400 hover:text-white'}`}
            >
              {tab_name === 'info' ? t('profile_tab_info') : t('profile_tab_password')}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-3.5">
          {tab === 'info' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('reg_firstname')}</label>
                  <input className={inputCls()} value={infoForm.firstName} onChange={e => setInfoForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('reg_lastname')}</label>
                  <input className={inputCls()} value={infoForm.lastName} onChange={e => setInfoForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('contact_phone')}</label>
                <input className={inputCls()} value={infoForm.phone} onChange={e => setInfoForm(f => ({ ...f, phone: e.target.value }))} placeholder="+49 151 …" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('reg_city')}</label>
                <input className={inputCls()} value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))} placeholder="Berlin" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
                <button onClick={saveInfo} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50">
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('pw_current')}</label>
                <div className="relative">
                  <input
                    type={showOld ? 'text' : 'password'}
                    className={`${inputCls(pwErrors.old)} pr-9`}
                    value={pwForm.oldPassword}
                    onChange={e => { setPwForm(f => ({ ...f, oldPassword: e.target.value })); setPwErrors(er => ({ ...er, old: '' })); }}
                    autoComplete="current-password"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowOld(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {pwErrors.old && <p className="text-red-400 text-xs mt-0.5">{pwErrors.old}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('pw_new')}</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    className={`${inputCls(pwErrors.new)} pr-9`}
                    value={pwForm.newPassword}
                    onChange={e => { setPwForm(f => ({ ...f, newPassword: e.target.value })); setPwErrors(er => ({ ...er, new: '' })); }}
                    autoComplete="new-password"
                    placeholder={t('reg_hint_length')}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowNew(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {pwErrors.new && <p className="text-red-400 text-xs mt-0.5">{pwErrors.new}</p>}
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('reg_confirm')}</label>
                <input
                  type="password"
                  className={inputCls(pwErrors.confirm)}
                  value={pwForm.confirm}
                  onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwErrors(er => ({ ...er, confirm: '' })); }}
                  autoComplete="new-password"
                />
                {pwErrors.confirm && <p className="text-red-400 text-xs mt-0.5">{pwErrors.confirm}</p>}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
                <button onClick={savePassword} disabled={saving} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-50">
                  {saving ? t('saving') : t('change_pw')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const router = useRouter();
  const { user, logout, init, token } = useAuth();
  const { t } = useLocale();
  const [servers, setServers] = useState<Server[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [durationDrafts, setDurationDrafts] = useState<Record<string, number>>({});

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
      const reason = reasonDrafts[serverId]?.trim();
      const durationMinutes = durationDrafts[serverId] ?? 60;
      await api.post(`/access/grant/${serverId}`, {
        ...(reason ? { reason } : {}),
        durationMinutes,
      });
      toast.success(t('client_access_granted_toast'));
      setReasonDrafts(d => ({ ...d, [serverId]: '' }));
      await loadServers();
      await loadLogs();
    } catch {
      toast.error(t('client_err_grant'));
    } finally {
      setActionLoading(null);
    }
  };

  const revokeAccess = async (serverId: string) => {
    setActionLoading(serverId);
    try {
      await api.delete(`/access/revoke/${serverId}`);
      toast.success(t('client_access_revoked_toast'));
      await loadServers();
      await loadLogs();
    } catch {
      toast.error(t('client_err_revoke'));
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  const statusLabel = (status: Server['status']) =>

    status === 'online' ? t('client_status_online') :
    status === 'offline' ? t('client_status_offline') : t('client_status_unknown');

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} t={t} />}
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="https://tinta-lab.de">
              <img src="/logo.png" alt="Tinta Lab" className="w-8 h-8" />
            </a>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <AppLanguageSwitcher />
            <button
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
              title={t('profile_title')}
            >
              <UserCog size={15} />
              <span className="hidden sm:inline">{user.firstName} {user.lastName}</span>
            </button>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Servers */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">{t('client_title')}</h1>
              <p className="text-slate-400 text-sm mt-0.5">{t('client_subtitle')}</p>
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
              <p>{t('client_no_server')}</p>
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
                      {statusLabel(server.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Access control */}
              {server.accessEnabled ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-green-400" />
                    <span className="font-medium text-green-400">{t('client_access_open')}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{t('client_access_open_desc')}</p>
                  {server.accessExpiresAt && (
                    <AccessCountdown
                      expiresAt={server.accessExpiresAt}
                      onExpire={loadServers}
                      label={t('client_access_closes')}
                    />
                  )}
                  <button
                    onClick={() => revokeAccess(server.id)}
                    disabled={actionLoading === server.id}
                    className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === server.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <><Lock size={14} /> {t('client_access_revoke')}</>
                    }
                  </button>
                </div>
              ) : (
                <div className="bg-slate-700/20 border border-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-300">{t('client_access_closed')}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{t('client_access_closed_desc')}</p>

                  <div className="mb-3">
                    <label className="block text-xs text-slate-500 mb-1">{t('client_access_reason_label')}</label>
                    <input
                      type="text"
                      value={reasonDrafts[server.id] ?? ''}
                      onChange={e => setReasonDrafts(d => ({ ...d, [server.id]: e.target.value }))}
                      placeholder={t('client_access_reason_placeholder')}
                      maxLength={500}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs text-slate-500 mb-1.5">{t('client_access_duration_label')}</label>
                    <div className="flex gap-2">
                      {[15, 30, 60].map(minutes => {
                        const selected = (durationDrafts[server.id] ?? 60) === minutes;
                        return (
                          <button
                            key={minutes}
                            type="button"
                            onClick={() => setDurationDrafts(d => ({ ...d, [server.id]: minutes }))}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              selected
                                ? 'bg-teal-600/20 border-teal-500 text-teal-300'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {minutes} {t('client_access_minutes_short')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => grantAccess(server.id)}
                    disabled={actionLoading === server.id}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === server.id
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <><Unlock size={14} /> {t('client_access_grant')}</>
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
              <Shield size={15} className="text-slate-500" /> {t('client_history')}
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
                  return m > 0 ? `${m} min` : `${s} s`;
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
                        {isActive ? t('client_log_active') : log.isRevoked ? t('client_log_revoked') : t('client_log_ended')}
                      </span>
                    </div>

                    {/* Row 2: details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pl-5">
                      <div className="text-slate-500">{t('client_log_server')}</div>
                      <div className="text-slate-300">{log.server?.name}</div>

                      {log.reason && (
                        <>
                          <div className="text-slate-500">{t('client_log_reason')}</div>
                          <div className="text-slate-300">{log.reason}</div>
                        </>
                      )}

                      {log.accessedBy ? (
                        <>
                          <div className="text-slate-500">{t('client_log_staff')}</div>
                          <div className="text-slate-300">{log.accessedBy.firstName} {log.accessedBy.lastName}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-slate-500">{t('client_log_staff')}</div>
                          <div className="text-slate-600 italic">{t('client_log_not_connected')}</div>
                        </>
                      )}

                      {log.connectedAt && (
                        <>
                          <div className="text-slate-500">{t('client_log_connected')}</div>
                          <div className="text-slate-300">
                            {new Date(log.connectedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      )}

                      {ended && (
                        <>
                          <div className="text-slate-500">{log.isRevoked ? t('client_log_closed') : t('client_log_expired')}</div>
                          <div className="text-slate-300">
                            {new Date(ended).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </>
                      )}

                      {sessionDuration && (
                        <>
                          <div className="text-slate-500">{t('client_log_duration')}</div>
                          <div className="text-slate-300">{sessionDuration}</div>
                        </>
                      )}
                    </div>

                    {/* Activity log — only for completed sessions */}
                    {!isActive && log.activityLog !== undefined && (
                      <ActivityLogSection entries={log.activityLog ?? []} t={t} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 mt-2">{t('client_gdpr')}</p>
          </section>
        )}
      </main>
    </div>
  );
}
