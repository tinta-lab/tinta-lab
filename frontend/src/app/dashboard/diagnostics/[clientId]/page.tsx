'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { ArrowLeft, ChevronDown, ChevronUp, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';
import { canViewDiagnostics } from '@/lib/permissions';
import { diagnosticsApi } from '@/services/diagnosticsApi';
import {
  ClientDiagnostics,
  DiagnosticCheck,
  DiagnosticCheckKey,
  DiagnosticStatus,
} from '@/types';

// PHASE1_3_DIAGNOSTICS_SPEC.md §5's exact 11 keys, in the same fixed order
// the backend already constructs them in — asserted here defensively rather
// than trusted purely from array order, so a row is never silently missing.
const CHECK_ORDER: DiagnosticCheckKey[] = [
  'client',
  'hub',
  'server',
  'agent',
  'homeAssistant',
  'cloudflare',
  'supportAccess',
  'resources',
  'templates',
  'audit',
  'provisioning',
];

const STATUS_STYLES: Record<
  DiagnosticStatus,
  { badge: string; dot: string }
> = {
  // UNKNOWN is neutral/gray, matching PublicStatusBadge's existing
  // "unknown is not alarming" treatment (dashboard/client/page.tsx) — never
  // amber, which would misread as an active problem.
  ok: { badge: 'bg-green-500/10 border-green-500/30 text-green-400', dot: 'bg-green-400' },
  warning: { badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400', dot: 'bg-amber-400' },
  error: { badge: 'bg-red-500/10 border-red-500/30 text-red-400', dot: 'bg-red-400' },
  unknown: { badge: 'bg-slate-700/50 border-slate-600 text-slate-400', dot: 'bg-slate-500' },
};

// Local UI clock tick, in ms — how often relative-time labels recompute.
// This is purely a re-render trigger; it never issues a network request
// (see the diagnostics-timestamp-sync fix note below).
const TIME_TICK_MS = 30_000;

// Terse, locale-independent relative-time formatting — matches the existing
// TimeAgo component's convention (dashboard/admin/hubs/page.tsx), which is
// itself never localized. Second-level granularity, since a check can be
// only moments old. Takes `now` explicitly rather than reading Date.now()
// internally: every card must recompute from the same wall-clock moment
// (driven by DiagnosticsPage's ticking `now` state), not whatever instant
// each card individually last happened to re-render at — otherwise checks
// that share one identical backend checkedAt drift apart on screen purely
// because one card was expanded/collapsed (and thus re-rendered) more
// recently than a sibling that was never touched.
function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
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
  // Local UI clock only — ticking this re-renders every timeAgo() call from
  // the same instant, it never triggers a re-fetch (see TIME_TICK_MS).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TIME_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && !canViewDiagnostics(user.role)) router.push('/auth/login');
  }, [user, router]);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setState('loading');
      try {
        const result = await diagnosticsApi.getClientDiagnostics(clientId);
        setData(result);
        setNow(Date.now());
        setState('ok');
      } catch (e) {
        // A failed request — whatever the cause — is not itself a
        // diagnostic state (§6.9): it must not be rendered as "11 checks,
        // all UNKNOWN". The previous response (if any) is discarded rather
        // than kept and silently presented as still current.
        setData(null);
        if (isAxiosError(e) && e.response?.status === 403) setState('forbidden');
        else if (isAxiosError(e) && e.response?.status === 404) setState('notFound');
        else setState('error');
      } finally {
        setRefreshing(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    if (user && canViewDiagnostics(user.role)) load(false);
  }, [user, load]);

  if (!user) return null;

  const checksByKey = new Map<DiagnosticCheckKey, DiagnosticCheck>(
    (data?.checks ?? []).map((c) => [c.key, c]),
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {state === 'loading' && (
          <div className="space-y-4">
            <div className="h-8 w-48 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-20 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-slate-700/50 bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        )}

        {state === 'forbidden' && (
          <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
            <h1 className="text-xl font-bold text-white mb-3">{t('diagnostics_title')}</h1>
            <p>{t('diagnostics_forbidden')}</p>
          </div>
        )}

        {state === 'notFound' && (
          <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
            <h1 className="text-xl font-bold text-white mb-3">{t('diagnostics_title')}</h1>
            <p>{t('diagnostics_not_found_client')}</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center py-16 border border-slate-700/50 rounded-xl text-slate-500">
            <h1 className="text-xl font-bold text-white mb-3">{t('diagnostics_title')}</h1>
            <p className="mb-3">{t('diagnostics_unavailable')}</p>
            <button onClick={() => load(false)} className="text-sm text-teal-400 hover:text-teal-300 font-medium">
              {t('client_support_try_again')}
            </button>
          </div>
        )}

        {state === 'ok' && data && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">
                  {data.client.firstName} {data.client.lastName}
                </h1>
                <p className="text-slate-400 text-sm mt-0.5">{t('diagnostics_title')}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_STYLES[data.overallStatus].badge}`}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_STYLES[data.overallStatus].dot}`} />
                {data.overallStatus.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {t('diagnostics_checked_prefix')} {timeAgo(data.checkedAt, now)}
              </span>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {t('refresh')}
              </button>
            </div>

            <div className="space-y-3">
              {CHECK_ORDER.map((key) => {
                const check = checksByKey.get(key);
                if (!check) return null; // contractually always present — defensive only
                return <CheckCard key={key} check={check} now={now} />;
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CheckCard({ check, now }: { check: DiagnosticCheck; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLocale();
  const style = STATUS_STYLES[check.status];
  const evidenceEntries = check.evidence ? Object.entries(check.evidence) : [];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
          <span className="font-medium text-sm truncate">{check.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
            {check.status.toUpperCase()}
          </span>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      <p className="text-sm text-slate-400 mt-2">{check.message}</p>
      <p className="text-xs text-slate-600 mt-2">
        {t('diagnostics_checked_prefix')} {timeAgo(check.checkedAt, now)}
      </p>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="text-xs font-medium text-slate-500 mb-2">{t('diagnostics_evidence')}</div>
          {evidenceEntries.length > 0 ? (
            <dl className="space-y-1">
              {evidenceEntries.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 text-xs">
                  <dt className="text-slate-500 font-mono flex-shrink-0">{k}</dt>
                  <dd className="text-slate-300 font-mono text-right break-all">{formatEvidenceValue(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-600">{t('diagnostics_no_evidence')}</p>
          )}
        </div>
      )}
    </div>
  );
}
