'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import { ChevronLeft, RefreshCw, Circle, Headphones, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import type { TranslationKey } from '@/i18n/translations';

interface AccessSession {
  id: string;
  grantedAt: string;
  connectedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  isRevoked: boolean;
  reason: string | null;
  activityLog: string[] | null;
  server: { id: string; name: string; clientName: string };
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'support' | 'sales';
  isActive: boolean;
  isOnline: boolean;
  recentSessions: AccessSession[];
}

function sessionEndReason(s: AccessSession): { labelKey: TranslationKey; color: string; icon: React.ReactNode } {
  if (!s.connectedAt && !s.revokedAt) {
    const expired = new Date(s.expiresAt) < new Date();
    if (expired) return { labelKey: 'staff_status_not_connected', color: 'text-slate-500', icon: <AlertCircle size={13} /> };
    return { labelKey: 'staff_status_pending', color: 'text-amber-400', icon: <Clock size={13} /> };
  }
  if (!s.revokedAt) {
    const expired = new Date(s.expiresAt) < new Date();
    if (!expired) return { labelKey: 'staff_status_active', color: 'text-green-400', icon: <Circle size={13} className="fill-green-400" /> };
    return { labelKey: 'staff_status_expired', color: 'text-slate-500', icon: <Clock size={13} /> };
  }
  if (s.isRevoked) return { labelKey: 'staff_status_revoked_by_client', color: 'text-red-400', icon: <XCircle size={13} /> };
  return { labelKey: 'staff_status_completed', color: 'text-slate-400', icon: <CheckCircle2 size={13} /> };
}

function fmtDate(d: string | null, locale: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(start: string | null, end: string | null, minUnit: string, hourUnit: string) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} ${minUnit}`;
  return `${Math.floor(m / 60)}${hourUnit} ${m % 60}${minUnit[0]}`;
}

function SessionCard({ s }: { s: AccessSession }) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const end = s.revokedAt ?? (new Date(s.expiresAt) < new Date() ? s.expiresAt : null);
  const duration = fmtDuration(s.connectedAt, end, t('staff_duration_min'), t('staff_duration_hour_short'));
  const reason = sessionEndReason(s);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-white truncate">{s.server.clientName || s.server.name}</span>
              <span className="text-slate-500 text-xs">{s.server.name}</span>
            </div>
            {s.reason && <p className="text-xs text-slate-400 mt-0.5 truncate">{s.reason}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className={`flex items-center gap-1 text-xs ${reason.color} justify-end`}>
              {reason.icon}
              <span>{t(reason.labelKey)}</span>
            </div>
            {duration && <div className="text-xs text-slate-500 mt-0.5">{duration}</div>}
          </div>
        </div>
        <div className="flex gap-4 mt-1.5 text-xs text-slate-500">
          <span>{t('staff_granted_label')}: {fmtDate(s.grantedAt, locale)}</span>
          {s.connectedAt && <span>{t('staff_connected_label')}: {fmtDate(s.connectedAt, locale)}</span>}
          {s.revokedAt && <span>{t('staff_ended_label')}: {fmtDate(s.revokedAt, locale)}</span>}
        </div>
      </button>

      {expanded && Array.isArray(s.activityLog) && s.activityLog.length > 0 && (
        <div className="border-t border-slate-700/50 px-4 py-3 bg-slate-900/30">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">{t('staff_activity_log_title')}</p>
          <ul className="space-y-1">
            {s.activityLog.map((entry, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-slate-600 shrink-0">›</span>
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* activityLog === null means the agent never got to report (e.g. it was
          offline right when access was revoked) — distinct from `[]`, which
          means it DID check Home Assistant's logbook and genuinely found no
          entries attributable to the support user. These read as the same
          "nothing here" to an admin unless labeled differently, which made a
          perfectly normal "support only looked, didn't touch anything" result
          look like a broken feature. */}
      {expanded && s.activityLog === null && (
        <div className="border-t border-slate-700/50 px-4 py-2 bg-slate-900/30">
          <p className="text-xs text-amber-500/80">{t('staff_activity_log_unavailable')}</p>
        </div>
      )}
      {expanded && Array.isArray(s.activityLog) && s.activityLog.length === 0 && (
        <div className="border-t border-slate-700/50 px-4 py-2 bg-slate-900/30">
          <p className="text-xs text-slate-500">{t('staff_activity_log_empty')}</p>
        </div>
      )}
    </div>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const activeSessions = member.recentSessions.filter(s => s.connectedAt && !s.revokedAt && new Date(s.expiresAt) > new Date());
  const totalSessions = member.recentSessions.length;

  return (
    <div className="border border-slate-700/50 bg-slate-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left p-5 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-300">
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${member.isOnline ? 'bg-green-400' : 'bg-slate-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{member.firstName} {member.lastName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${member.role === 'support' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {member.role === 'support' ? t('role_support') : t('role_sales')}
              </span>
              {!member.isActive && <span className="text-xs text-red-400">{t('staff_inactive')}</span>}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{member.email}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-medium ${member.isOnline ? 'text-green-400' : 'text-slate-500'}`}>
              {member.isOnline ? t('client_status_online') : t('client_status_offline')}
            </div>
            {activeSessions.length > 0 && (
              <div className="text-xs text-green-400 mt-0.5">{activeSessions.length} {t('staff_active_sessions_n')}</div>
            )}
            {totalSessions > 0 && (
              <div className="text-xs text-slate-500 mt-0.5">{totalSessions} {t('staff_total_sessions_n')}</div>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-700/50 p-4 space-y-2">
          {member.recentSessions.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">{t('staff_no_sessions')}</p>
          ) : (
            member.recentSessions.map(s => <SessionCard key={s.id} s={s} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffActivityPage() {
  const router = useRouter();
  const { user, init } = useAuth();
  const { t } = useLocale();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) load();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: staffData }, { data: onlineData }] = await Promise.all([
        api.get('/users/staff-activity'),
        api.get('/tinta-core/online-users').catch(() => ({ data: { userIds: [] } })),
      ]);
      const onlineSet = new Set<string>(onlineData.userIds);
      setStaff(staffData.map((u: StaffMember) => ({ ...u, isOnline: onlineSet.has(u.id) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  if (!user) return null;

  const support = staff.filter(u => u.role === 'support');
  const sales = staff.filter(u => u.role === 'sales');
  const onlineCount = staff.filter(u => u.isOnline).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h1 className="font-bold text-lg">{t('staff_title')}</h1>
            {onlineCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                {onlineCount} {t('client_status_online')}
              </span>
            )}
          </div>
          <button
            onClick={load}
            className="text-slate-400 hover:text-white transition-colors"
            title={t('refresh')}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-slate-600" />
          </div>
        ) : (
          <>
            {support.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Headphones size={16} className="text-blue-400" />
                  <h2 className="font-semibold text-slate-300">{t('role_support')}</h2>
                  <span className="text-slate-600 text-sm">{support.length}</span>
                </div>
                <div className="space-y-3">
                  {support.map(m => <StaffCard key={m.id} member={m} />)}
                </div>
              </section>
            )}

            {sales.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-amber-400" />
                  <h2 className="font-semibold text-slate-300">{t('role_sales')}</h2>
                  <span className="text-slate-600 text-sm">{sales.length}</span>
                </div>
                <div className="space-y-3">
                  {sales.map(m => <StaffCard key={m.id} member={m} />)}
                </div>
              </section>
            )}

            {staff.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                <p>{t('staff_no_staff')}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
