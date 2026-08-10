'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, LogOut, Cpu,
  Wifi, WifiOff, BookTemplate, X, ChevronRight, Loader2,
} from 'lucide-react';
import { AgentSession, GoldenTemplate } from '@/types';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

function StatusDot({ status }: { status: AgentSession['status'] }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400' : 'bg-slate-600'}`} />
  );
}

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-800 border border-slate-700 rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AgentsPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [templates, setTemplates] = useState<GoldenTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentSession | null>(null);
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) load();
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const [sessRes, tplRes] = await Promise.all([
        api.get<AgentSession[]>('/tinta-core/sessions'),
        api.get<GoldenTemplate[]>('/tinta-core/templates'),
      ]);
      setSessions(sessRes.data);
      setTemplates(tplRes.data);
    } catch { toast.error(t('error')); }
    finally { setLoading(false); }
  };

  const triggerUpdate = async (clientId: string) => {
    setUpdatingClientId(clientId);
    try {
      const { data } = await api.post(`/tinta-core/update/${clientId}?version=2026.8.1`);
      if (data.sent) toast.success('Update command sent — agent will restart shortly');
      else if (!data.online) toast.warning('Agent is offline — update queued until reconnect');
      else toast.error('Failed to send update command');
    } catch { toast.error('Update request failed'); }
    finally { setUpdatingClientId(null); }
  };

  const applyTemplate = async (clientId: string, slug: string) => {
    setApplyingSlug(slug);
    try {
      const { data } = await api.post(`/tinta-core/template/${clientId}/${slug}`);
      if (data.sent) toast.success(`${slug}`);
      else toast.info(t('provision_offline_warn'));
      await load();
    } catch { toast.error(t('error')); }
    finally { setApplyingSlug(null); }
  };

  if (!user) return null;

  const connected = sessions.filter(s => s.status === 'connected').length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">{t('agents_breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Tinta Agents</h1>
          <p className="text-slate-400 text-sm mt-1">
            {sessions.length} · <span className="text-green-400">{connected} online</span>
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Loader2 size={24} className="animate-spin mr-2" /> {t('loading')}
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Wifi size={40} className="mx-auto mb-3 opacity-30" />
            <p>{t('no_agents')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => setSelected(s)}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 hover:border-slate-600 hover:bg-slate-800 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={s.status} />
                    <span className="font-medium text-sm">
                      {s.client?.user ? `${s.client.user.firstName} ${s.client.user.lastName}` : s.clientId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {s.status === 'connected'
                      ? <Wifi size={14} className="text-green-400" />
                      : <WifiOff size={14} className="text-slate-600" />
                    }
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>

                {/* Agent/HA versions */}
                <div className="flex gap-2 mb-4">
                  {s.agentVersion && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Agent {s.agentVersion}
                    </span>
                  )}
                  {s.haVersion && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      HA {s.haVersion}
                    </span>
                  )}
                </div>

                {/* Token mismatch alert */}
                {s.lastTokenMismatchAt && s.status === 'disconnected' && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                    <span>⚠</span>
                    <span>Token mismatch – {new Date(s.lastTokenMismatchAt).toLocaleString()}</span>
                  </div>
                )}

                {/* Metrics */}
                {s.metrics ? (
                  <div className="space-y-2">
                    <MetricBar value={s.metrics.cpuPercent} label="CPU" color="bg-teal-500" />
                    <MetricBar value={s.metrics.memPercent} label="RAM" color="bg-blue-500" />
                    <MetricBar value={s.metrics.diskPercent} label="Disk" color="bg-purple-500" />
                    <div className="flex justify-between text-xs text-slate-500 pt-1">
                      <span>{s.metrics.deviceCount} {t('devices_unit')}</span>
                      <span>{s.metrics.automationCount} {t('automations_unit')}</span>
                      <span>↑{formatUptime(s.metrics.uptimeSeconds)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Cpu size={12} /> {t('metrics_unavail')}
                  </div>
                )}

                {s.appliedTemplates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <div className="text-xs text-slate-500">{s.appliedTemplates.length} {t('templates_applied_n')}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Agent detail modal */}
      {selected && (
        <Modal
          title={selected.client?.user ? `${selected.client.user.firstName} ${selected.client.user.lastName}` : selected.clientId}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-5">
            {/* Status */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('col_status')}</span>
                <span className={selected.status === 'connected' ? 'text-green-400' : 'text-slate-500'}>
                  {selected.status === 'connected' ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client ID</span>
                <span className="text-slate-300 font-mono text-xs">{selected.clientId}</span>
              </div>
              {selected.agentVersion && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Agent version</span>
                  <div className="flex items-center gap-2">
                    <span className={selected.agentVersion === '2026.8.1' ? 'text-green-400' : 'text-amber-400'}>
                      {selected.agentVersion}
                      {selected.agentVersion !== '2026.8.1' && ' ⚠'}
                    </span>
                    {selected.agentVersion !== '2026.8.1' && selected.status === 'connected' && (
                      <button
                        onClick={() => triggerUpdate(selected.clientId)}
                        disabled={updatingClientId === selected.clientId}
                        className="text-xs px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 transition-colors"
                      >
                        {updatingClientId === selected.clientId ? '...' : '→ 2026.8.1'}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {selected.haVersion && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Home Assistant</span>
                  <span className="text-slate-300">{selected.haVersion}</span>
                </div>
              )}
              {selected.lastHeartbeatAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Last heartbeat</span>
                  <span className="text-slate-300 text-xs">
                    {new Date(selected.lastHeartbeatAt).toLocaleString('de-DE')}
                  </span>
                </div>
              )}
              {selected.lastTokenMismatchAt && (
                <div className="flex justify-between items-center">
                  <span className="text-amber-500">Token mismatch</span>
                  <span className="text-amber-400 text-xs">
                    {new Date(selected.lastTokenMismatchAt).toLocaleString('de-DE')}
                  </span>
                </div>
              )}
            </div>

            {/* Token mismatch explanation */}
            {selected.lastTokenMismatchAt && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300 space-y-1">
                <p className="font-medium">⚠ Token mismatch detected</p>
                <p className="text-amber-400/80">The agent&apos;s JWT does not match the stored token. The agent was rejected. To fix: check <code>clients/{'{clientId}'}.env</code> or re-provision via <code>POST /tinta-core/provision/{'{clientId}'}</code>.</p>
              </div>
            )}

            {/* Metrics */}
            {selected.metrics && (
              <div>
                <div className="text-xs text-slate-400 mb-2">Metrics</div>
                <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
                  <MetricBar value={selected.metrics.cpuPercent} label="CPU" color="bg-teal-500" />
                  <MetricBar value={selected.metrics.memPercent} label="RAM" color="bg-blue-500" />
                  <MetricBar value={selected.metrics.diskPercent} label="Disk" color="bg-purple-500" />
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-700/50">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{selected.metrics.deviceCount}</div>
                      <div className="text-xs text-slate-500">{t('devices_unit')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{selected.metrics.automationCount}</div>
                      <div className="text-xs text-slate-500">{t('automations_unit')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{formatUptime(selected.metrics.uptimeSeconds)}</div>
                      <div className="text-xs text-slate-500">uptime</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Golden Templates */}
            <div>
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <BookTemplate size={12} /> Golden Templates
              </div>
              <div className="space-y-2">
                {templates.map(tpl => {
                  const applied = selected.appliedTemplates.includes(tpl.slug);
                  return (
                    <div
                      key={tpl.slug}
                      className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{tpl.name}</div>
                        {tpl.description && <div className="text-xs text-slate-500 mt-0.5">{tpl.description}</div>}
                      </div>
                      {applied ? (
                        <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          {t('template_applied_badge')}
                        </span>
                      ) : (
                        <button
                          onClick={() => applyTemplate(selected.clientId, tpl.slug)}
                          disabled={applyingSlug === tpl.slug}
                          className="text-xs px-2 py-0.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50"
                        >
                          {applyingSlug === tpl.slug ? <Loader2 size={10} className="animate-spin" /> : t('template_apply_btn')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setSelected(null)} className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">
              {t('close')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
