'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, RefreshCw, LogOut, Plus, X, ChevronRight, Copy, Check,
  Wifi, WifiOff, Globe, Shield, ShieldOff, AlertTriangle, ArrowUpCircle,
  Clock, ExternalLink, Loader2, Server, Activity, Trash2, Pencil, Zap,
  BookTemplate,
} from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { AgentMetrics, Client, GoldenTemplate } from '@/types';
import type { TranslationKey } from '@/i18n/translations';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HubAgent {
  status: string;
  agentVersion: string | null;
  metrics: AgentMetrics | null;
  lastConnectedAt: string | null;
  lastHeartbeatAt: string | null;
  lastTokenMismatchAt: string | null;
  installToken: string | null;
  installTokenExpiresAt: string | null;
  isOnline: boolean;
  appliedTemplates: string[];
}

interface Hub {
  id: string;
  name: string;
  subdomain: string;
  hubId: string | null;
  publicUrl: string | null;
  localUrl: string | null;
  status: 'online' | 'offline' | 'unknown';
  haVersion: string | null;
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  lastSeenAt: string | null;
  tunnelId: string | null;
  cfAccessAppId: string | null;
  client: {
    id: string;
    phone: string | null;
    city: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  agent: HubAgent | null;
}

type AccessReason = 'general_question' | 'device_not_working' | 'automation_help' | 'connectivity_issue' | 'other' | 'ha_dashboard_toggle';

// Closed reason set (see backend/src/access/enums/access-reason.enum.ts) —
// GDPR hardening so free text can't end up permanently in the audit ledger.
const ACCESS_REASON_CODES: Exclude<AccessReason, 'ha_dashboard_toggle'>[] = [
  'general_question', 'device_not_working', 'automation_help', 'connectivity_issue', 'other',
];
const ACCESS_REASON_LABEL_KEY: Record<AccessReason, TranslationKey> = {
  general_question: 'access_reason_general_question',
  device_not_working: 'access_reason_device_not_working',
  automation_help: 'access_reason_automation_help',
  connectivity_issue: 'access_reason_connectivity_issue',
  other: 'access_reason_other',
  ha_dashboard_toggle: 'access_reason_ha_toggle',
};

interface AccessLog {
  id: string;
  grantedAt: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  reason: string | null;
  reasonCode: AccessReason | null;
  reasonDetails: string | null;
  grantedBy: { firstName: string; lastName: string };
}

interface ProvisionResult {
  clientId: string;
  serverId: string;
  installToken: string;
  installUrl: string;
  subdomain: string;
  dashboardUrl: string;
}

const LATEST_VERSION = '2026.8.1';

// ─── Utility components ───────────────────────────────────────────────────────

function MetricBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span><span>{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

function AgentBadge({ version, latest }: { version: string | null; latest: string }) {
  if (!version) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">Agent —</span>;
  const isLatest = version === latest;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${isLatest ? 'bg-teal-500/20 text-teal-300' : 'bg-amber-500/20 text-amber-300'}`}>
      Agent {version}
    </span>
  );
}

function HABadge({ version }: { version: string | null }) {
  if (!version) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">HA —</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">HA {version}</span>;
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${online ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-slate-600'}`} />
  );
}

function TimeAgo({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-500">—</span>;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let label = '';
  if (days > 0) label = `${days}d ${hrs % 24}h`;
  else if (hrs > 0) label = `${hrs}h ${mins % 60}m`;
  else label = `${mins}m`;
  return <span className="text-slate-400">↑{label}</span>;
}

// ─── Hub Card ────────────────────────────────────────────────────────────────

function HubCard({ hub, onSelect, onUpdate }: { hub: Hub; onSelect: () => void; onUpdate: (clientId: string) => void }) {
  const { t } = useLocale();
  const isOnline = hub.agent?.isOnline ?? false;
  const needsUpdate = hub.agent?.agentVersion && hub.agent.agentVersion !== LATEST_VERSION;
  const hasTokenMismatch = !!hub.agent?.lastTokenMismatchAt;

  return (
    <div
      onClick={onSelect}
      className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5 hover:border-teal-500/40 hover:bg-slate-750 transition-all cursor-pointer group relative"
    >
      {/* Status + Actions row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusDot online={isOnline} />
          <div>
            <div className="font-semibold text-white group-hover:text-teal-400 transition-colors leading-tight">
              {hub.client.user.firstName} {hub.client.user.lastName}
            </div>
            <div className="text-xs text-slate-500">{hub.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {needsUpdate && (
            <button
              onClick={() => onUpdate(hub.client.id)}
              title={`${t('hub_update_to')} ${LATEST_VERSION}`}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              <ArrowUpCircle size={12} />→ {LATEST_VERSION}
            </button>
          )}
          {hasTokenMismatch && (
            <span title={t('hub_token_mismatch_title')} className="text-amber-400">
              <AlertTriangle size={14} />
            </span>
          )}
          <ChevronRight size={16} className="text-slate-600 group-hover:text-teal-400 transition-colors" />
        </div>
      </div>

      {/* Version badges */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <AgentBadge version={hub.agent?.agentVersion ?? null} latest={LATEST_VERSION} />
        <HABadge version={hub.haVersion ?? hub.agent?.metrics ? hub.haVersion : null} />
        {hub.accessEnabled && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 flex items-center gap-1">
            <Shield size={10} /> {t('support_access_open')}
          </span>
        )}
      </div>

      {/* Metrics */}
      {isOnline && hub.agent?.metrics && (
        <div className="space-y-2 mb-4">
          <MetricBar value={hub.agent.metrics.cpuPercent ?? 0} label="CPU" color="bg-teal-500" />
          <MetricBar value={hub.agent.metrics.memPercent ?? 0} label="RAM" color="bg-blue-500" />
          <MetricBar value={hub.agent.metrics.diskPercent ?? 0} label="Disk" color="bg-purple-500" />
        </div>
      )}

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          {hub.agent?.metrics?.deviceCount != null && (
            <span>{hub.agent.metrics.deviceCount} {t('devices_unit')}</span>
          )}
          {hub.agent?.metrics?.automationCount != null && (
            <span>{hub.agent.metrics.automationCount} {t('automations_unit')}</span>
          )}
        </div>
        <TimeAgo iso={hub.lastSeenAt} />
      </div>

      {/* Hub URL */}
      {hub.publicUrl && (
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-600 truncate">
          <Globe size={10} />
          <span className="truncate">{hub.publicUrl.replace('https://', '')}</span>
        </div>
      )}

      {(hub.agent?.appliedTemplates?.length ?? 0) > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          {hub.agent!.appliedTemplates.length} {t('templates_applied_n')}
        </div>
      )}
    </div>
  );
}

// ─── Hub Detail Drawer ────────────────────────────────────────────────────────

function HubDrawer({ hub, onClose, onRefresh }: { hub: Hub; onClose: () => void; onRefresh: () => void }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<'overview' | 'access' | 'activity' | 'templates'>('overview');
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [duration, setDuration] = useState<15 | 30 | 60>(30);
  const [reasonCode, setReasonCode] = useState<Exclude<AccessReason, 'ha_dashboard_toggle'> | ''>('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(hub.name);
  const [editLocalUrl, setEditLocalUrl] = useState(hub.localUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<GoldenTemplate[]>([]);
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);

  const isOnline = hub.agent?.isOnline ?? false;
  const needsUpdate = hub.agent?.agentVersion && hub.agent.agentVersion !== LATEST_VERSION;

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await api.get(`/access/logs/${hub.id}`);
      setLogs(data);
    } catch { /* no logs yet */ }
    finally { setLogsLoading(false); }
  }, [hub.id]);

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get<GoldenTemplate[]>('/tinta-core/templates');
      setTemplates(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === 'activity') loadLogs();
    if (tab === 'templates' && templates.length === 0) loadTemplates();
  }, [tab, loadLogs, loadTemplates, templates.length]);

  const applyTemplate = async (slug: string) => {
    setApplyingSlug(slug);
    try {
      const { data } = await api.post(`/tinta-core/template/${hub.client.id}/${slug}`);
      if (data.sent) toast.success(slug);
      else toast.info(t('provision_offline_warn'));
      onRefresh();
    } catch { toast.error(t('error')); }
    finally { setApplyingSlug(null); }
  };

  const grantAccess = async () => {
    setGranting(true);
    try {
      await api.post(`/access/grant/${hub.id}`, {
        reasonCode: reasonCode || undefined,
        reasonDetails: reasonCode === 'other' ? (reasonDetails.trim() || undefined) : undefined,
        durationMinutes: duration,
      });
      toast.success(t('hub_access_granted_toast'));
      onRefresh();
    } catch { toast.error(t('error')); }
    finally { setGranting(false); }
  };

  const revokeAccess = async () => {
    setRevoking(true);
    try {
      await api.delete(`/access/revoke/${hub.id}`);
      toast.success(t('hub_access_revoked_toast'));
      onRefresh();
    } catch { toast.error(t('error')); }
    finally { setRevoking(false); }
  };

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      await api.post(`/tinta-core/update/${hub.client.id}?version=${LATEST_VERSION}`);
      toast.success(`${t('hub_update_sent_toast')} → ${LATEST_VERSION}`);
    } catch { toast.error(t('hub_agent_offline')); }
    finally { setUpdating(false); }
  };

  const deleteHub = async () => {
    setDeleting(true);
    try {
      await api.delete(`/servers/${hub.id}`);
      toast.success(t('hub_deleted_toast'));
      onClose();
      onRefresh();
    } catch { toast.error(t('hub_error_delete')); }
    finally { setDeleting(false); setConfirmDelete(false); }
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/servers/${hub.id}`, { name: editName, localUrl: editLocalUrl || undefined });
      toast.success(t('hub_saved_toast'));
      setEditMode(false);
      onRefresh();
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  const tabs = [
    { id: 'overview', label: t('hub_tab_overview'), icon: Activity },
    { id: 'access', label: t('hub_tab_access'), icon: Shield },
    { id: 'templates', label: t('hub_tab_templates'), icon: BookTemplate },
    { id: 'activity', label: t('hub_tab_activity'), icon: Clock },
  ] as const;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border-l border-slate-700 w-full max-w-lg flex flex-col h-full overflow-hidden shadow-2xl">
        {/* Drawer header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <StatusDot online={isOnline} />
            <div>
              <div className="font-bold text-white">{hub.client.user.firstName} {hub.client.user.lastName}</div>
              <div className="text-xs text-slate-400">{hub.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hub.publicUrl && (
              <a href={hub.publicUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 transition-colors">
                <ExternalLink size={12} /> HA
              </a>
            )}
            {needsUpdate && (
              <button onClick={triggerUpdate} disabled={updating || !isOnline}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors">
                {updating ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
                → {LATEST_VERSION}
              </button>
            )}
            <button onClick={() => { setTab('overview'); setEditMode(!editMode); }} title={t('edit')}
              className={`p-2 rounded-lg transition-colors ${editMode ? 'bg-teal-500/20 text-teal-400' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}>
              <Pencil size={15} />
            </button>
            <button onClick={() => setConfirmDelete(true)} title={t('delete')}
              className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
              <Trash2 size={15} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Delete confirm banner */}
          {confirmDelete && (
            <div className="absolute top-full left-0 right-0 z-10 bg-red-900/90 border-b border-red-700 px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-red-200">{t('hub_delete_confirm')}</span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 rounded-lg border border-red-600 text-red-300 hover:border-red-400">{t('cancel')}</button>
                <button onClick={deleteHub} disabled={deleting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 flex items-center gap-1">
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t('delete')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-slate-700 flex-shrink-0 px-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex items-center gap-1.5 py-3 px-1 mr-6 text-sm border-b-2 transition-colors ${tab === id ? 'border-teal-400 text-teal-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Overview tab */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Edit mode */}
              {editMode && (
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider">{t('edit')}</p>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('hub_field_local_url')}</label>
                    <input value={editLocalUrl} onChange={e => setEditLocalUrl(e.target.value)} placeholder="http://192.168.1.x:8123"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 placeholder:text-slate-600" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditMode(false)} className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:border-slate-600 transition-colors">{t('cancel')}</button>
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-900 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={13} className="animate-spin" /> : null} {t('save')}
                    </button>
                  </div>
                </div>
              )}
              {/* User */}
              <Section title={t('hub_customer_section')}>
                <Row label={t('col_user')} value={`${hub.client.user.firstName} ${hub.client.user.lastName}`} />
                <Row label="E-Mail" value={hub.client.user.email} />
                {hub.client.phone && <Row label={t('contact_phone')} value={hub.client.phone} />}
                {hub.client.city && <Row label={t('hub_wizard_city_optional')} value={hub.client.city} />}
              </Section>

              {/* Hub */}
              <Section title={t('hub_hub_section')}>
                <Row label="Name" value={hub.name} />
                {hub.hubId && <Row label="Hub ID" value={`hub-${hub.hubId}`} mono />}
                {hub.publicUrl && (
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-400">Public URL</span>
                    <div className="flex items-center gap-1">
                      <a href={hub.publicUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-teal-400 hover:underline font-mono">{hub.publicUrl.replace('https://', '')}</a>
                      <CopyButton text={hub.publicUrl} />
                    </div>
                  </div>
                )}
                {hub.localUrl && <Row label={t('hub_field_local_url')} value={hub.localUrl} mono />}
                {hub.tunnelId && <Row label="Tunnel ID" value={hub.tunnelId.slice(0, 18) + '…'} mono />}
              </Section>

              {/* Agent */}
              <Section title={t('hub_agent_section')}>
                <Row label={t('col_status')} value={isOnline ? `🟢 ${t('client_status_online')}` : `⚫ ${t('client_status_offline')}`} />
                <Row label="Agent" value={hub.agent?.agentVersion ?? '—'} />
                <Row label="HA" value={hub.haVersion ?? '—'} />
                {hub.agent?.lastConnectedAt && (
                  <Row label={t('hub_field_last_connected')} value={new Date(hub.agent.lastConnectedAt).toLocaleString()} />
                )}
                {hub.agent?.lastTokenMismatchAt && (
                  <div className="flex items-center gap-2 py-1.5 text-amber-400 text-sm">
                    <AlertTriangle size={14} />
                    <span>{t('hub_token_mismatch_label')}: {new Date(hub.agent.lastTokenMismatchAt).toLocaleString()}</span>
                  </div>
                )}
                {hub.agent?.metrics && (
                  <div className="mt-3 space-y-2">
                    <MetricBar value={hub.agent.metrics.cpuPercent ?? 0} label="CPU" color="bg-teal-500" />
                    <MetricBar value={hub.agent.metrics.memPercent ?? 0} label="RAM" color="bg-blue-500" />
                    <MetricBar value={hub.agent.metrics.diskPercent ?? 0} label="Disk" color="bg-purple-500" />
                    <div className="flex gap-4 text-xs text-slate-400 pt-1">
                      <span>{hub.agent.metrics.deviceCount} {t('devices_unit')}</span>
                      <span>{hub.agent.metrics.automationCount} {t('automations_unit')}</span>
                    </div>
                  </div>
                )}
              </Section>

              {/* Activation code if not yet connected */}
              {hub.agent?.installToken && (
                <Section title={t('hub_activation_section')} highlight>
                  <p className="text-xs text-slate-400 mb-3">
                    {t('hub_activation_hint')}
                  </p>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
                    <code className="flex-1 text-sm text-teal-300 font-mono break-all">{hub.agent.installToken}</code>
                    <CopyButton text={hub.agent.installToken} />
                  </div>
                  {hub.agent.installTokenExpiresAt && (
                    <p className="text-xs text-slate-500 mt-2">
                      {t('hub_valid_until')}: {new Date(hub.agent.installTokenExpiresAt).toLocaleString()}
                    </p>
                  )}
                </Section>
              )}
            </div>
          )}

          {/* Access tab */}
          {tab === 'access' && (
            <div className="space-y-5">
              {hub.accessEnabled ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-400 font-semibold mb-2">
                    <Shield size={16} /> {t('hub_access_active_title')}
                  </div>
                  {hub.accessExpiresAt && (
                    <p className="text-sm text-slate-400">
                      {t('hub_access_expires')}: {new Date(hub.accessExpiresAt).toLocaleString()}
                    </p>
                  )}
                  <button onClick={revokeAccess} disabled={revoking}
                    className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors text-sm">
                    {revoking ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                    {t('client_access_revoke')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">{t('hub_access_intro')}</p>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">{t('client_access_duration_label')}</label>
                    <div className="flex gap-2">
                      {([15, 30, 60] as const).map(d => (
                        <button key={d} onClick={() => setDuration(d)}
                          className={`flex-1 py-2 rounded-lg text-sm transition-colors ${duration === d ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                          {d} {t('client_access_minutes_short')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">{t('client_access_reason_label')}</label>
                    <select value={reasonCode} onChange={e => setReasonCode(e.target.value as Exclude<AccessReason, 'ha_dashboard_toggle'> | '')}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500">
                      <option value="">—</option>
                      {ACCESS_REASON_CODES.map(code => (
                        <option key={code} value={code}>{t(ACCESS_REASON_LABEL_KEY[code])}</option>
                      ))}
                    </select>
                    {reasonCode === 'other' && (
                      <div className="mt-2">
                        <textarea value={reasonDetails} onChange={e => setReasonDetails(e.target.value)} rows={2} maxLength={280}
                          placeholder={t('client_access_reason_placeholder')}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-teal-500 placeholder:text-slate-600" />
                        <p className="text-xs text-slate-500 mt-1">{t('access_reason_other_hint')}</p>
                      </div>
                    )}
                  </div>
                  <button onClick={grantAccess} disabled={granting || !isOnline}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold transition-colors text-sm">
                    {granting ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                    {isOnline ? t('client_access_grant') : t('hub_agent_offline')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Templates tab */}
          {tab === 'templates' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{t('hub_templates_section')}</h3>
              {templates.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-500" /></div>
              ) : templates.map(tpl => {
                const applied = hub.agent?.appliedTemplates?.includes(tpl.slug) ?? false;
                return (
                  <div key={tpl.slug} className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium">{tpl.name}</div>
                      {tpl.description && <div className="text-xs text-slate-500 mt-0.5">{tpl.description}</div>}
                    </div>
                    {applied ? (
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0">
                        {t('template_applied_badge')}
                      </span>
                    ) : (
                      <button
                        onClick={() => applyTemplate(tpl.slug)}
                        disabled={applyingSlug === tpl.slug || !isOnline}
                        className="text-xs px-2.5 py-1 rounded-full bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50 shrink-0"
                      >
                        {applyingSlug === tpl.slug ? <Loader2 size={10} className="animate-spin" /> : t('template_apply_btn')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Activity tab */}
          {tab === 'activity' && (
            <div>
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-500" /></div>
              ) : logs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">{t('hub_no_activity')}</p>
              ) : (
                <div className="space-y-3">
                  {logs.map(log => (
                    <div key={log.id} className={`rounded-xl border p-4 text-sm ${log.isRevoked ? 'border-slate-700/50 bg-slate-800/50' : 'border-green-500/30 bg-green-500/10'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={log.isRevoked ? 'text-slate-400' : 'text-green-400'}>
                          {log.isRevoked ? t('hub_log_completed') : t('client_log_active')}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(log.grantedAt).toLocaleDateString()}</span>
                      </div>
                      {(log.reasonCode || log.reason) && (
                        <p className="text-slate-300 mb-1">
                          {log.reasonCode
                            ? `${t(ACCESS_REASON_LABEL_KEY[log.reasonCode])}${log.reasonDetails ? ` — ${log.reasonDetails}` : ''}`
                            : log.reason /* legacy free-text row from before this field existed */}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {t('hub_log_from')} {log.grantedBy.firstName} {log.grantedBy.lastName} · {t('hub_log_until')} {new Date(log.expiresAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Small helpers for the drawer
function Section({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-700/30 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

// ─── Create Hub Wizard ────────────────────────────────────────────────────────

function CreateHubWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useLocale();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [clients, setClients] = useState<Client[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Form: step 1
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [existingClientId, setExistingClientId] = useState('');

  // Form: step 2
  const [serverName, setServerName] = useState('');
  const [localUrl, setLocalUrl] = useState('');

  useEffect(() => {
    api.get('/clients').then(({ data }) => setClients(data)).catch(() => {});
  }, []);

  const canNext1 = mode === 'existing'
    ? !!existingClientId
    : firstName.length >= 2 && lastName.length >= 2 && email.includes('@') && phone.length >= 6 && password.length >= 8;

  const canNext2 = serverName.length >= 2;

  const submit = async () => {
    setSubmitting(true);
    try {
      const subdomain = serverName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const body = mode === 'existing'
        ? { existingClientId, serverName, subdomain, localUrl: localUrl || undefined, applyDefaultTemplates: true }
        : { firstName, lastName, email, password, phone, city: city || undefined, serverName, subdomain, localUrl: localUrl || undefined, applyDefaultTemplates: true };

      const { data } = await api.post('/provisioning/client', body);
      setResult(data);
      setStep(3);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t('hub_error_create'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    if (result?.installToken) { navigator.clipboard.writeText(result.installToken); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const steps = [t('hub_wizard_step_account'), t('hub_wizard_step_config'), t('hub_wizard_step_done')];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step < 3 ? onClose : undefined} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="flex border-b border-slate-700">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${i + 1 === step ? 'text-teal-400 border-b-2 border-teal-400' : i + 1 < step ? 'text-slate-400' : 'text-slate-600'}`}>
              {i + 1 < step ? '✓ ' : `${i + 1}. `}{s}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">{t('hub_wizard_step_account')}</h2>
              <div className="flex gap-2">
                {(['new', 'existing'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${mode === m ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                    {m === 'new' ? t('hub_wizard_new_user') : t('hub_wizard_existing_user')}
                  </button>
                ))}
              </div>

              {mode === 'existing' ? (
                <select value={existingClientId} onChange={e => setExistingClientId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500">
                  <option value="">{t('hub_wizard_select_client')}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.user.firstName} {c.user.lastName} ({c.user.email})</option>
                  ))}
                </select>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('reg_firstname')} value={firstName} onChange={setFirstName} />
                    <Field label={t('reg_lastname')} value={lastName} onChange={setLastName} />
                  </div>
                  <Field label="E-Mail" value={email} onChange={setEmail} type="email" />
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">{t('contact_phone')}</label>
                    <PhoneInput value={phone} onChange={setPhone} />
                  </div>
                  <Field label={t('hub_wizard_city_optional')} value={city} onChange={setCity} />
                  <Field label={t('reg_password')} value={password} onChange={setPassword} type="password" />
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm transition-colors">{t('cancel')}</button>
                <button onClick={() => setStep(2)} disabled={!canNext1}
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold text-sm transition-colors">
                  {t('hub_wizard_next')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">{t('hub_wizard_step_config')}</h2>
              <Field label={t('hub_wizard_hubname_label')} value={serverName} onChange={setServerName} placeholder="Mustermann Home" />
              <Field label={t('hub_wizard_localurl_label')} value={localUrl} onChange={setLocalUrl} placeholder="http://192.168.1.100:8123" />

              {serverName.length >= 2 && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-xs">
                  <p className="text-slate-400 mb-1">{t('hub_wizard_subdomain_generated')}</p>
                  <p className="text-teal-300 font-mono">{serverName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.tinta-lab.de</p>
                  <p className="text-slate-500 mt-1">{t('hub_wizard_public_url_note')}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">{t('hub_wizard_back')}</button>
                <button onClick={submit} disabled={!canNext2 || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> {t('creating')}</> : t('hub_create_btn')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Success */}
          {step === 3 && result && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap size={22} className="text-teal-400" />
                </div>
                <h2 className="font-bold text-lg">{t('hub_wizard_success_title')}</h2>
                <p className="text-sm text-slate-400 mt-1">{t('hub_wizard_success_hint')}</p>
              </div>

              <div className="bg-slate-800 border border-teal-500/40 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">{t('hub_activation_section')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-teal-300 font-mono text-sm break-all">{result.installToken}</code>
                  <button onClick={copyCode} className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white flex-shrink-0">
                    {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm space-y-2">
                <p className="font-medium">{t('hub_wizard_addon_config_title')}</p>
                <code className="block text-xs text-slate-300 bg-slate-900 rounded-lg p-3 font-mono">
                  tinta_install_token: {result.installToken}
                </code>
                <p className="text-xs text-slate-500">{t('hub_wizard_addon_config_hint')}</p>
              </div>

              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm transition-colors">
                {t('hub_wizard_step_done')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 placeholder:text-slate-600" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HubsPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) loadHubs();
  }, [user, router]);

  const loadHubs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/hubs');
      setHubs(data);
      if (selectedHub) {
        const updated = data.find((h: Hub) => h.id === selectedHub.id);
        if (updated) setSelectedHub(updated);
      }
    } catch { toast.error(t('hub_error_load')); }
    finally { setLoading(false); }
  };

  const triggerUpdate = async (clientId: string) => {
    try {
      await api.post(`/tinta-core/update/${clientId}?version=${LATEST_VERSION}`);
      toast.success(t('hub_update_sent_toast'));
    } catch { toast.error(t('hub_agent_offline')); }
  };

  if (!user) return null;

  const online = hubs.filter(h => h.agent?.isOnline).length;
  const offline = hubs.length - online;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <a href="https://tinta-lab.de"><img src="/logo.png" alt="Tinta" className="w-7 h-7" /></a>
            <img src="/wordmark.png" alt="Tinta Lab" className="h-6 w-auto" />
            <span className="text-slate-500 text-sm">{t('hub_breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="flex items-center gap-1 text-green-400"><Wifi size={13} /> {online}</span>
              <span className="text-slate-600">/</span>
              <span className="flex items-center gap-1 text-slate-500"><WifiOff size={13} /> {offline}</span>
            </div>
            <button onClick={loadHubs} className="text-slate-400 hover:text-white transition-colors" title={t('refresh')}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <AppLanguageSwitcher />
            <button onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm transition-colors">
              <Plus size={15} /> {t('hub_create_btn')}
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('hub_page_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {hubs.length} {t('hub_installations')} · {online} {t('client_status_online')} · {offline} {t('client_status_offline')}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-slate-600" />
          </div>
        ) : hubs.length === 0 ? (
          <div className="text-center py-20">
            <Server size={40} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-400 mb-4">{t('hub_no_hubs_yet')}</p>
            <button onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold text-sm transition-colors">
              <Plus size={15} /> {t('hub_create_first')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {hubs.map(hub => (
              <HubCard
                key={hub.id}
                hub={hub}
                onSelect={() => setSelectedHub(hub)}
                onUpdate={triggerUpdate}
              />
            ))}
          </div>
        )}
      </main>

      {/* Hub detail drawer */}
      {selectedHub && (
        <HubDrawer
          hub={selectedHub}
          onClose={() => setSelectedHub(null)}
          onRefresh={loadHubs}
        />
      )}

      {/* Create wizard */}
      {showWizard && (
        <CreateHubWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => { setShowWizard(false); loadHubs(); }}
        />
      )}
    </div>
  );
}
