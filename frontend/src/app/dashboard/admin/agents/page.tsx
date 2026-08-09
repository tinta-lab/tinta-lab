'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, LogOut, Cpu,
  Wifi, WifiOff, Play, BookTemplate, X, ChevronRight, Loader2, Copy, Check,
} from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { AgentSession, GoldenTemplate, Client } from '@/types';
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="shrink-0 p-1 rounded text-slate-500 hover:text-slate-300 transition-colors">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2">
      <span className="text-slate-500 text-xs w-32 shrink-0">{label}</span>
      <span className={`flex-1 text-xs text-slate-300 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
      <CopyButton value={value} />
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
  const [showProvision, setShowProvision] = useState(false);
  const [provisionMode, setProvisionMode] = useState<'new' | 'existing'>('new');
  const [provision, setProvision] = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '+49',
    city: '', serverName: '', subdomain: '',
  });
  const [provisionErrors, setProvisionErrors] = useState<Partial<Record<keyof typeof provision | 'existingClient', string>>>({});
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<any>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

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

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const { data } = await api.get<Client[]>('/clients');
      setClients(data);
    } catch { toast.error(t('error')); }
    finally { setLoadingClients(false); }
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

  const validateProvision = () => {
    const errs: Partial<Record<keyof typeof provision | 'existingClient', string>> = {};
    if (provisionMode === 'existing') {
      if (!selectedClientId) errs.existingClient = t('err_required');
    } else {
      if (!provision.firstName.trim()) errs.firstName = t('err_required');
      if (!provision.lastName.trim())  errs.lastName  = t('err_required');
      if (!provision.email.trim())     errs.email     = t('err_required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provision.email)) errs.email = t('err_email_invalid');
      if (!provision.password)         errs.password  = t('err_required');
      else if (provision.password.length < 8) errs.password = t('err_min8');
      const digits = (provision.phone || '').replace(/\D/g, '');
      if (digits.length < 7)           errs.phone     = t('reg_val_phone');
    }
    if (!provision.serverName.trim()) errs.serverName = t('err_required');
    if (!provision.subdomain.trim()) errs.subdomain = t('err_required');
    else if (!/^[a-z0-9-]+$/.test(provision.subdomain)) errs.subdomain = 'a-z, 0-9, -';
    setProvisionErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const provisionClient = async () => {
    if (!validateProvision()) return;
    setProvisioning(true);
    try {
      const payload = provisionMode === 'existing'
        ? { existingClientId: selectedClientId, serverName: provision.serverName, subdomain: provision.subdomain }
        : provision;
      const { data } = await api.post('/provisioning/client', payload);
      setProvisionResult(data);
      toast.success(t('provision_success_toast'));
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(msg === 'Email already exists' ? t('err_email_taken') : t('provision_err'));
    } finally { setProvisioning(false); }
  };

  const resetProvision = () => {
    setShowProvision(false);
    setProvisionResult(null);
    setProvision({ email: '', password: '', firstName: '', lastName: '', phone: '+49', city: '', serverName: '', subdomain: '' });
    setProvisionErrors({});
    setProvisionMode('new');
    setSelectedClientId('');
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
            <button
              onClick={() => setShowProvision(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
            >
              <Play size={13} /> {t('new_client_btn')}
            </button>
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
                <div className="flex justify-between">
                  <span className="text-slate-500">Agent version</span>
                  <span className="text-slate-300">{selected.agentVersion}</span>
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

      {/* One-Click Provision Modal */}
      {showProvision && (
        <Modal title="One-Click Provision" wide={!!provisionResult} onClose={resetProvision}>
          {provisionResult ? (
            <div className="space-y-5">
              {/* Success banner */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm font-medium flex items-center gap-2">
                <Check size={15} /> {t('provision_success_banner')}
              </div>

              {/* Magic Install Link */}
              {provisionResult.installUrl && (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-semibold text-teal-300 uppercase tracking-wider mb-1">Magic Install Link</div>
                  <p className="text-xs text-slate-400">{t('provision_magic_desc')}</p>
                  <CopyRow label={t('provision_magic_label')} value={provisionResult.installUrl} mono={false} />
                </div>
              )}

              {/* Manual steps */}
              <details>
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">{t('provision_manual')}</summary>
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      <span className="text-sm font-medium">{t('provision_step_repo')}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 ml-7">Settings → Addons → Store → ⋮ → Repositories</p>
                    <div className="ml-7">
                      <CopyRow label="Repository" value="https://github.com/tinta-lab/tinta-agent" mono={false} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                      <span className="text-sm font-medium">{t('provision_step_addon')}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                      <span className="text-sm font-medium">{t('provision_step_config')}</span>
                    </div>
                    <div className="ml-7 space-y-1.5">
                      <CopyRow label="tinta_client_id" value={provisionResult.clientId} />
                      <CopyRow label="tinta_agent_token" value={provisionResult.agentToken} />
                      <CopyRow label="tinta_core_ws" value="wss://api.tinta-lab.de/tinta/ws" />
                      <CopyRow label="tinta_external_url" value={provisionResult.dashboardUrl ?? ''} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                      <span className="text-sm font-medium">{t('provision_step_start')}</span>
                    </div>
                  </div>
                </div>
              </details>

              {/* Dashboard link */}
              {provisionResult.dashboardUrl && (
                <div className="bg-slate-900/50 rounded-xl p-3 flex items-center justify-between text-sm">
                  <span className="text-slate-400 text-xs">Dashboard</span>
                  <a href={provisionResult.dashboardUrl} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline text-xs">{provisionResult.dashboardUrl}</a>
                </div>
              )}

              {/* Docker alternative */}
              {provisionResult.agentInstallCommand && (
                <details>
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">{t('provision_docker_alt')}</summary>
                  <pre className="mt-2 bg-slate-900 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                    {provisionResult.agentInstallCommand}
                  </pre>
                </details>
              )}

              <button onClick={resetProvision} className="w-full py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors">
                {t('provision_done_btn')}
              </button>
            </div>
          ) : (
            <form autoComplete="off" onSubmit={e => { e.preventDefault(); provisionClient(); }} className="space-y-3.5">
              {/* Mode toggle */}
              <div className="flex rounded-lg bg-slate-900 border border-slate-700 p-0.5">
                <button
                  type="button"
                  onClick={() => { setProvisionMode('new'); setSelectedClientId(''); setProvisionErrors({}); }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${provisionMode === 'new' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {t('provision_new_client')}
                </button>
                <button
                  type="button"
                  onClick={() => { setProvisionMode('existing'); setProvisionErrors({}); if (clients.length === 0) loadClients(); }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${provisionMode === 'existing' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {t('provision_existing_client')}
                </button>
              </div>

              {provisionMode === 'existing' ? (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t('col_client_label')} <span className="text-red-400">*</span></label>
                    {loadingClients ? (
                      <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                        <Loader2 size={12} className="animate-spin" /> {t('loading_clients_label')}
                      </div>
                    ) : (
                      <select
                        value={selectedClientId}
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedClientId(id);
                          setProvisionErrors(err => ({ ...err, existingClient: '' }));
                          const c = clients.find(c => c.id === id);
                          if (c) {
                            setProvision(p => ({
                              ...p,
                              firstName: c.user.firstName,
                              lastName: c.user.lastName,
                              email: c.user.email,
                              phone: (c as any).phone || p.phone,
                            }));
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.existingClient ? 'border-red-500' : 'border-slate-600'}`}
                      >
                        <option value="">{t('select_client_opt')}</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.user.firstName} {c.user.lastName} — {c.user.email}
                          </option>
                        ))}
                      </select>
                    )}
                    {provisionErrors.existingClient && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.existingClient}</p>}
                  </div>

                  {selectedClientId && (() => {
                    const c = clients.find(c => c.id === selectedClientId);
                    if (!c) return null;
                    return (
                      <div className="bg-slate-900/50 rounded-lg px-3 py-2.5 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500 text-xs">{t('col_user')}</span>
                          <span className="text-slate-300 text-xs">{c.user.firstName} {c.user.lastName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 text-xs">Email</span>
                          <span className="text-slate-300 text-xs">{c.user.email}</span>
                        </div>
                        {(c as any).phone && (
                          <div className="flex justify-between">
                            <span className="text-slate-500 text-xs">{t('reg_phone')}</span>
                            <span className="text-slate-300 text-xs">{(c as any).phone}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('reg_firstname')} <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={provision.firstName}
                        onChange={e => { setProvision(p => ({ ...p, firstName: e.target.value })); setProvisionErrors(err => ({ ...err, firstName: '' })); }}
                        className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.firstName ? 'border-red-500' : 'border-slate-600'}`}
                      />
                      {provisionErrors.firstName && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('reg_lastname')} <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={provision.lastName}
                        onChange={e => { setProvision(p => ({ ...p, lastName: e.target.value })); setProvisionErrors(err => ({ ...err, lastName: '' })); }}
                        className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.lastName ? 'border-red-500' : 'border-slate-600'}`}
                      />
                      {provisionErrors.lastName && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      value={provision.email}
                      onChange={e => { setProvision(p => ({ ...p, email: e.target.value })); setProvisionErrors(err => ({ ...err, email: '' })); }}
                      className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.email ? 'border-red-500' : 'border-slate-600'}`}
                    />
                    {provisionErrors.email && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.email}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('reg_password')} <span className="text-red-400">*</span></label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={provision.password}
                        onChange={e => { setProvision(p => ({ ...p, password: e.target.value })); setProvisionErrors(err => ({ ...err, password: '' })); }}
                        className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.password ? 'border-red-500' : 'border-slate-600'}`}
                        placeholder="Min. 8"
                      />
                      {provisionErrors.password && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.password}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('field_city_label')}</label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={provision.city}
                        onChange={e => setProvision(p => ({ ...p, city: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                        placeholder="Berlin"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">{t('reg_phone')} <span className="text-red-400">*</span></label>
                    <PhoneInput
                      size="sm"
                      value={provision.phone}
                      onChange={v => { setProvision(p => ({ ...p, phone: v })); setProvisionErrors(err => ({ ...err, phone: '' })); }}
                      hasError={!!provisionErrors.phone}
                    />
                    {provisionErrors.phone && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.phone}</p>}
                  </div>
                </>
              )}

              {/* Server section */}
              <div className="border-t border-slate-700/50 pt-3">
                <div className="text-xs text-slate-400 mb-2 font-medium">{t('server_section_title')}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('field_server_name_label')} <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      autoComplete="off"
                      value={provision.serverName}
                      onChange={e => { setProvision(p => ({ ...p, serverName: e.target.value })); setProvisionErrors(err => ({ ...err, serverName: '' })); }}
                      className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.serverName ? 'border-red-500' : 'border-slate-600'}`}
                      placeholder="Haus Müller"
                    />
                    {provisionErrors.serverName && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.serverName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('field_subdomain_label')} <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        autoComplete="off"
                        value={provision.subdomain}
                        onChange={e => { setProvision(p => ({ ...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); setProvisionErrors(err => ({ ...err, subdomain: '' })); }}
                        className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-white text-sm focus:outline-none focus:border-teal-500 transition-colors ${provisionErrors.subdomain ? 'border-red-500' : 'border-slate-600'}`}
                        placeholder="mueller"
                      />
                    </div>
                    {provision.subdomain && !provisionErrors.subdomain && (
                      <p className="text-slate-500 text-xs mt-0.5">{provision.subdomain}.tinta-lab.de</p>
                    )}
                    {provisionErrors.subdomain && <p className="text-red-400 text-xs mt-0.5">{provisionErrors.subdomain}</p>}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={provisioning}
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {provisioning ? <><Loader2 size={14} className="animate-spin" /> {t('provisioning_btn')}</> : t('provision_btn')}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
