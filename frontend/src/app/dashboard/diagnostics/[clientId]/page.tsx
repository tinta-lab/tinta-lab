'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import {
  ArrowLeft, Check, CheckCircle2, ChevronDown, CircleHelp, Copy, KeyRound, Lightbulb,
  Loader2, LogOut, Plug, RefreshCw, Server, ShieldCheck, Wrench, XCircle, AlertTriangle, Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';
import api from '@/lib/api';
import { canViewDiagnostics } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { translateApiError } from '@/lib/apiError';
import { diagnosticsApi } from '@/services/diagnosticsApi';
import { buildDiagnosticText, translateDiagnosticStatus, timeAgo } from '@/lib/diagnosticText';
import { ClientDiagnostics, DiagnosticCheck, DiagnosticCheckKey, DiagnosticStatus } from '@/types';

type T = (k: TranslationKey) => string;

// The 11 checks (PHASE1_3_DIAGNOSTICS_SPEC.md §5) grouped the way a person
// reasons about a hub: can we reach it, is it set up, who has access, is it
// healthy. Each key appears exactly once.
const GROUPS: { titleKey: TranslationKey; icon: typeof Plug; keys: DiagnosticCheckKey[] }[] = [
  { titleKey: 'diag_group_connection', icon: Plug, keys: ['server', 'agent', 'homeAssistant', 'cloudflare'] },
  { titleKey: 'diag_group_setup', icon: Wrench, keys: ['provisioning', 'client', 'hub', 'templates'] },
  { titleKey: 'diag_group_access', icon: ShieldCheck, keys: ['supportAccess', 'audit'] },
  { titleKey: 'diag_group_health', icon: Gauge, keys: ['resources'] },
];

// Root cause search order: a failed install explains everything after it;
// an offline agent explains HA/resources/public URL; and so on.
const ROOT_CAUSE_ORDER: DiagnosticCheckKey[] = [
  'client', 'hub', 'provisioning', 'agent', 'server', 'homeAssistant', 'cloudflare',
  'resources', 'supportAccess', 'templates', 'audit',
];
// Checks that can't be healthy while the given root cause is failing —
// shown dimmed as consequences instead of as separate problems.
const DEPENDENTS: Partial<Record<DiagnosticCheckKey, DiagnosticCheckKey[]>> = {
  provisioning: ['server', 'agent', 'homeAssistant', 'cloudflare', 'resources', 'templates'],
  agent: ['server', 'homeAssistant', 'cloudflare', 'resources', 'templates'],
  server: ['cloudflare'],
  client: ['provisioning', 'server', 'agent', 'homeAssistant', 'cloudflare'],
  hub: ['cloudflare'],
};

const FIX_KEYS: Record<string, TranslationKey> = {
  CLIENT_INACTIVE: 'diag_fix_CLIENT_INACTIVE',
  NO_SERVER: 'diag_fix_NO_SERVER',
  HUB_NOT_LINKED: 'diag_fix_HUB_NOT_LINKED',
  SERVER_OFFLINE: 'diag_fix_SERVER_OFFLINE',
  SERVER_RECENTLY_OFFLINE: 'diag_fix_SERVER_RECENTLY_OFFLINE',
  AGENT_NOT_PROVISIONED: 'diag_fix_AGENT_NOT_PROVISIONED',
  AGENT_OFFLINE: 'diag_fix_AGENT_OFFLINE',
  AGENT_UNRESPONSIVE: 'diag_fix_AGENT_UNRESPONSIVE',
  HA_API_UNAVAILABLE: 'diag_fix_HA_API_UNAVAILABLE',
  PUBLIC_URL_UNREACHABLE: 'diag_fix_PUBLIC_URL_UNREACHABLE',
  ACCESS_STATE_INCONSISTENT: 'diag_fix_ACCESS_STATE_INCONSISTENT',
  ACCESS_EXPIRING_SOON: 'diag_fix_ACCESS_EXPIRING_SOON',
  RESOURCE_CRITICAL: 'diag_fix_RESOURCE_CRITICAL',
  RESOURCE_HIGH_USAGE: 'diag_fix_RESOURCE_HIGH_USAGE',
  TEMPLATES_PENDING: 'diag_fix_TEMPLATES_PENDING',
  INSTALL_PENDING: 'diag_fix_INSTALL_PENDING',
  INSTALL_EXPIRED: 'diag_fix_INSTALL_EXPIRED',
  NOT_PROVISIONED: 'diag_fix_NOT_PROVISIONED',
  PROVISIONING_STATE_UNKNOWN: 'diag_fix_PROVISIONING_STATE_UNKNOWN',
};
// Codes the admin can fix right here by issuing a fresh install link.
const REISSUE_CODES = new Set(['INSTALL_EXPIRED', 'INSTALL_PENDING', 'NOT_PROVISIONED', 'PROVISIONING_STATE_UNKNOWN', 'AGENT_NOT_PROVISIONED']);

const STATUS_UI: Record<DiagnosticStatus, { icon: typeof Check; text: string; ring: string; chip: string; glow: string }> = {
  ok:      { icon: CheckCircle2,  text: 'text-emerald-300', ring: 'border-emerald-400/25', chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/25', glow: 'from-emerald-400/15' },
  warning: { icon: AlertTriangle, text: 'text-amber-300',   ring: 'border-amber-400/30',   chip: 'bg-amber-400/10 text-amber-300 border-amber-400/30',       glow: 'from-amber-400/15' },
  error:   { icon: XCircle,       text: 'text-rose-300',    ring: 'border-rose-400/30',    chip: 'bg-rose-400/10 text-rose-300 border-rose-400/30',          glow: 'from-rose-500/20' },
  unknown: { icon: CircleHelp,    text: 'text-slate-400',   ring: 'border-slate-600/60',   chip: 'bg-slate-700/40 text-slate-300 border-slate-600/60',      glow: 'from-slate-500/10' },
};
const SUMMARY_KEYS: Record<DiagnosticStatus, TranslationKey> = {
  ok: 'diag_summary_ok', warning: 'diag_summary_warning', error: 'diag_summary_error', unknown: 'diag_summary_unknown',
};

const EVIDENCE_LABEL_KEYS: Record<string, TranslationKey> = {
  accessEnabled: 'diag_ev_accessEnabled', accessExpiresAt: 'diag_ev_accessExpiresAt', activeSince: 'diag_ev_activeSince',
  agentVersion: 'diag_ev_agentVersion', appliedTemplates: 'diag_ev_appliedTemplates', connectionState: 'diag_ev_connectionState',
  eventCount: 'diag_ev_eventCount', haConnected: 'diag_ev_haConnected', haVersion: 'diag_ev_haVersion', hasServer: 'diag_ev_hasServer',
  hubId: 'diag_ev_hubId', installTokenExpiresAt: 'diag_ev_installTokenExpiresAt', isActive: 'diag_ev_isActive',
  lastConnectedAt: 'diag_ev_lastConnectedAt', lastEventAt: 'diag_ev_lastEventAt', lastHeartbeatAt: 'diag_ev_lastHeartbeatAt',
  lastSeenAt: 'diag_ev_lastSeenAt', multiServerDetected: 'diag_ev_multiServerDetected', pendingTemplates: 'diag_ev_pendingTemplates',
  publicCheckedAt: 'diag_ev_publicCheckedAt', publicStatus: 'diag_ev_publicStatus', publicUrl: 'diag_ev_publicUrl',
  serviceStartConsentAt: 'diag_ev_serviceStartConsentAt', status: 'diag_ev_status',
  cpuPercent: 'diag_ev_cpuPercent', memPercent: 'diag_ev_memPercent', diskPercent: 'diag_ev_diskPercent',
};
const VALUE_KEYS: Record<string, TranslationKey> = {
  online: 'diag_val_online', offline: 'diag_val_offline', unknown: 'diag_val_unknown', reachable: 'diag_val_reachable',
  unreachable: 'diag_val_unreachable', connected: 'diag_val_connected', disconnected: 'diag_val_disconnected', pending: 'diag_val_pending',
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Human-readable evidence: localized labels, local dates, yes/no, known
// enum values translated. Unknown keys fall back to a de-camelCased label.
function evidenceRows(evidence: Record<string, unknown> | null, t: T, locale: Parameters<typeof formatDateTime>[1]) {
  if (!evidence) return [];
  return Object.entries(evidence)
    .filter(([k, v]) => k !== 'affectedResources' && k !== 'now' && !(Array.isArray(v) && v.length === 0 && k === 'pendingTemplates'))
    .map(([k, v]) => {
      const label = EVIDENCE_LABEL_KEYS[k] ? t(EVIDENCE_LABEL_KEYS[k]) : k.replace(/([A-Z])/g, ' $1').toLowerCase();
      let value: string;
      if (v === null || v === undefined || v === '') value = '—';
      else if (typeof v === 'boolean') value = v ? t('diag_yes') : t('diag_no');
      else if (Array.isArray(v)) value = v.length ? v.join(', ') : '—';
      else if (typeof v === 'number' && k.endsWith('Percent')) value = `${Math.round(v)}%`;
      else if (typeof v === 'string' && ISO_DATE.test(v)) value = formatDateTime(v, locale, { dateStyle: 'medium', timeStyle: 'short' });
      else if (typeof v === 'string' && VALUE_KEYS[v]) value = t(VALUE_KEYS[v]);
      else value = String(v);
      return { key: k, label, value };
    });
}

type PageState = 'loading' | 'ok' | 'forbidden' | 'notFound' | 'error';

export default function DiagnosticsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();

  const [state, setState] = useState<PageState>('loading');
  const [data, setData] = useState<ClientDiagnostics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && !canViewDiagnostics(user.role)) router.push('/auth/login');
  }, [user, router]);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setState('loading');
    try {
      const result = await diagnosticsApi.getClientDiagnostics(clientId);
      setData(result);
      setNow(Date.now());
      setState('ok');
    } catch (e) {
      // A failed request is not itself a diagnostic state (§6.9) — never
      // render stale results as if they were current.
      setData(null);
      if (isAxiosError(e) && e.response?.status === 403) setState('forbidden');
      else if (isAxiosError(e) && e.response?.status === 404) setState('notFound');
      else setState('error');
    } finally {
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (user && canViewDiagnostics(user.role)) load(false);
  }, [user, load]);

  const byKey = useMemo(
    () => new Map<DiagnosticCheckKey, DiagnosticCheck>((data?.checks ?? []).map(c => [c.key, c])),
    [data],
  );
  const rootCause = useMemo(() => {
    for (const sev of ['error', 'warning'] as DiagnosticStatus[]) {
      const key = ROOT_CAUSE_ORDER.find(k => byKey.get(k)?.status === sev);
      if (key) return byKey.get(key)!;
    }
    return null;
  }, [byKey]);
  const consequences = new Set(rootCause ? DEPENDENTS[rootCause.key] ?? [] : []);
  const counts = (data?.checks ?? []).reduce<Record<DiagnosticStatus, number>>(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }), { ok: 0, warning: 0, error: 0, unknown: 0 },
  );

  if (!user) return null;

  const checkedLabel = data
    ? (now - new Date(data.checkedAt).getTime() < 10_000 ? t('diag_just_now') : timeAgo(data.checkedAt, now, t))
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl px-4 sm:px-6 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> {t('diagnostics_back')}
          </button>
          <div className="flex items-center gap-4">
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {state === 'loading' && (
          <div className="space-y-4">
            <div className="h-40 rounded-3xl border border-white/[0.06] bg-slate-900/60 animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-3xl border border-white/[0.06] bg-slate-900/40 animate-pulse" />
            ))}
          </div>
        )}

        {(state === 'forbidden' || state === 'notFound' || state === 'error') && (
          <div className="text-center py-16 rounded-3xl border border-white/[0.06] bg-slate-900/40 text-slate-400">
            <h1 className="text-xl font-semibold text-white mb-3">{t('diagnostics_title')}</h1>
            <p className="mb-3">
              {state === 'forbidden' ? t('diagnostics_forbidden') : state === 'notFound' ? t('diagnostics_not_found_client') : t('diagnostics_unavailable')}
            </p>
            {state === 'error' && (
              <button onClick={() => load(false)} className="text-sm text-teal-300 hover:text-teal-200 font-medium">
                {t('client_support_try_again')}
              </button>
            )}
          </div>
        )}

        {state === 'ok' && data && (
          <div className="space-y-5">
            {/* Summary */}
            <section className={`relative overflow-hidden rounded-3xl border ${STATUS_UI[data.overallStatus].ring} bg-slate-900/60 p-6 sm:p-7`}>
              <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${STATUS_UI[data.overallStatus].glow} via-transparent to-transparent`} />
              <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <OverallIcon status={data.overallStatus} />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 mb-1">{t('diagnostics_title')}</p>
                    <h1 className="text-2xl font-semibold tracking-tight">{t(SUMMARY_KEYS[data.overallStatus])}</h1>
                    <p className="text-sm text-slate-400 mt-1">
                      {data.client.firstName} {data.client.lastName}
                      {data.server && <> · <Server size={12} className="inline -mt-0.5" /> {data.server.name}</>}
                      {data.hub?.agentVersion && <> · Agent {data.hub.agentVersion}</>}
                    </p>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3">
                  <button
                    onClick={() => load(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/25 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> {t('refresh')}
                  </button>
                  <span className="text-xs text-slate-500">{t('diagnostics_checked_prefix')} {checkedLabel}</span>
                </div>
              </div>
              <div className="relative mt-5 flex flex-wrap gap-2">
                {(['error', 'warning', 'ok', 'unknown'] as DiagnosticStatus[]).filter(s => counts[s] > 0).map(s => {
                  const Icon = STATUS_UI[s].icon;
                  return (
                    <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${STATUS_UI[s].chip}`}>
                      <Icon size={13} /> {counts[s]} · {translateDiagnosticStatus(s, t)}
                    </span>
                  );
                })}
              </div>
            </section>

            {/* Root cause → what to do */}
            {rootCause && (
              <RootCauseCard
                check={rootCause}
                clientId={clientId}
                canReissue={user.role === 'admin'}
                onFixed={() => load(true)}
              />
            )}

            {/* Grouped checks */}
            <div className="grid gap-4 md:grid-cols-2">
              {GROUPS.map(g => {
                const checks = g.keys.map(k => byKey.get(k)).filter((c): c is DiagnosticCheck => !!c);
                const GroupIcon = g.icon;
                return (
                  <section key={g.titleKey} className={`rounded-3xl border border-white/[0.07] bg-slate-900/40 p-2`}>
                    <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <GroupIcon size={14} className="text-teal-300/80" /> {t(g.titleKey)}
                    </h2>
                    <ul className="divide-y divide-white/[0.05]">
                      {checks.map(c => (
                        <CheckRow
                          key={c.key}
                          check={c}
                          isRoot={rootCause?.key === c.key}
                          isConsequence={consequences.has(c.key) && c.status !== 'ok'}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function OverallIcon({ status }: { status: DiagnosticStatus }) {
  const ui = STATUS_UI[status];
  const Icon = ui.icon;
  return (
    <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${ui.chip}`}>
      {status === 'ok' && <span className="absolute inset-0 rounded-2xl bg-emerald-400/20 motion-safe:animate-ping [animation-duration:2.5s]" />}
      <Icon size={22} className="relative" />
    </span>
  );
}

function RootCauseCard({ check, clientId, canReissue, onFixed }: {
  check: DiagnosticCheck; clientId: string; canReissue: boolean; onFixed: () => void;
}) {
  const { t, locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { title, message } = buildDiagnosticText(check, t);
  const fixKey = FIX_KEYS[check.code];
  const ui = STATUS_UI[check.status];
  const Icon = ui.icon;

  const reissue = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ installToken: string; installTokenExpiresAt: string }>(`/tinta-core/install-link/${clientId}`);
      setNewLink(`${window.location.origin}/install/${data.installToken}`);
      onFixed();
    } catch (e) {
      toast.error(translateApiError(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-3xl border ${ui.ring} bg-slate-900/60 p-6`}>
      <p className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] ${ui.text}`}>
        <Icon size={14} /> {t('diag_root_cause')}
      </p>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{message}</p>
      {fixKey && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-teal-400/15 bg-teal-400/[0.05] p-4">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-teal-300" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300/90 mb-1">{t('diag_what_to_do')}</p>
            <p className="text-sm text-slate-200 leading-relaxed">{t(fixKey)}</p>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {canReissue && REISSUE_CODES.has(check.code) && !newLink && (
          <button onClick={reissue} disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-300 disabled:opacity-60 transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} {t('hub_install_reissue')}
          </button>
        )}
        {check.key === 'templates' && (
          <Link href="/dashboard/admin/hubs" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-200 hover:border-white/25 transition-colors">
            {t('diag_open_hubs')}
          </Link>
        )}
      </div>
      {newLink && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs text-slate-400">{t('diag_install_link_ready')} · {formatDateTime(Date.now() + 7 * 864e5, locale, { dateStyle: 'medium' })}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-xs text-teal-200">{newLink}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(newLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/25"
            >
              {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />} {copied ? t('diag_copied') : t('diag_copy')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CheckRow({ check, isRoot, isConsequence }: { check: DiagnosticCheck; isRoot: boolean; isConsequence: boolean }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const { title, message } = buildDiagnosticText(check, t);
  const ui = STATUS_UI[check.status];
  const Icon = ui.icon;
  const rows = evidenceRows(check.evidence, t, locale);

  return (
    <li className={`rounded-2xl ${isRoot ? 'bg-white/[0.03]' : ''}`}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`w-full flex items-start gap-3 px-3 py-3 text-left rounded-2xl hover:bg-white/[0.03] transition-colors ${isConsequence ? 'opacity-55' : ''}`}
      >
        <Icon size={18} className={`mt-0.5 shrink-0 ${isConsequence ? 'text-slate-500' : ui.text}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100">{title}</span>
          <span className="block text-xs text-slate-400 mt-0.5 leading-relaxed">
            {isConsequence ? t('diag_consequence') : message}
          </span>
        </span>
        <ChevronDown size={15} className={`mt-1 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 pl-10">
          {isConsequence && <p className="text-xs text-slate-400 mb-2">{message}</p>}
          {rows.length > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-slate-950/50 border border-white/[0.05] p-3 text-xs">
              {rows.map(r => (
                <div key={r.key} className="contents">
                  <dt className="text-slate-500">{r.label}</dt>
                  <dd className="text-slate-200 text-right break-all">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-500">{t('diagnostics_no_evidence')}</p>
          )}
        </div>
      )}
    </li>
  );
}
