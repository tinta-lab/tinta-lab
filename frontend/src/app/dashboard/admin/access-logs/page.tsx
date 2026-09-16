'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import { ArrowLeft, LogOut, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';
import AccessLogList from '@/components/access/AccessLogList';
import { accessApi } from '@/services/access.api';
import { AuditChainVerification } from '@/types';

// ADMIN-only — verifies the whole audit_events hash chain hasn't been
// tampered with (GET /access/audit-verify). Deliberately manual/on-demand,
// not auto-run on page load: it walks every row in the ledger.
function ChainIntegrityPanel() {
  const { t } = useLocale();
  const [result, setResult] = useState<AuditChainVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const verify = async () => {
    setLoading(true);
    setError(false);
    try {
      setResult(await accessApi.verifyAuditChain());
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {result?.valid === false ? (
          <ShieldAlert size={20} className="text-red-400 flex-shrink-0" />
        ) : (
          <ShieldCheck size={20} className={result?.valid ? 'text-green-400' : 'text-slate-500'} />
        )}
        <div>
          <div className="text-sm font-semibold">{t('access_logs_chain_integrity')}</div>
          {result && (
            <div className={`text-xs mt-0.5 ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
              {result.valid ? t('access_logs_chain_valid') : t('access_logs_chain_invalid')}
              {!result.valid && result.brokenAtEventId && ` — ${t('access_logs_chain_broken_at')} ${result.brokenAtEventId}`}
            </div>
          )}
          {error && <div className="text-xs mt-0.5 text-red-400">{t('access_logs_load_error')}</div>}
        </div>
      </div>
      <button
        onClick={verify}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
        {t('access_logs_chain_verify')}
      </button>
    </div>
  );
}

export default function AdminAccessLogsPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} /> {t('admin_title')}
          </button>
          <div className="flex items-center gap-4">
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('access_logs_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('access_logs_subtitle')}</p>
        </div>

        <ChainIntegrityPanel />

        {/* showStaffFilter/showRawMetadata: true here because this page is
            ADMIN-only (role guard above) — the SUPPORT/SALES-facing
            /dashboard/support/security passes both false, since their
            GET /access/logs call is already ticket-scoped server-side and
            raw metadata is an admin-only affordance by product decision. */}
        <AccessLogList showStaffFilter showRawMetadata />
      </main>
    </div>
  );
}
