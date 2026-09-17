'use client';
import { useEffect, useRef, useState } from 'react';
import { Unlock, Lock, Clock, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import { ClientServer } from '@/types';

export type AccessReason =
  | 'general_question'
  | 'device_not_working'
  | 'automation_help'
  | 'connectivity_issue'
  | 'other'
  | 'ha_dashboard_toggle';

export const ACCESS_REASON_CODES: Exclude<AccessReason, 'ha_dashboard_toggle'>[] = [
  'general_question',
  'device_not_working',
  'automation_help',
  'connectivity_issue',
  'other',
];

export const ACCESS_REASON_LABEL_KEY: Record<AccessReason, TranslationKey> = {
  general_question: 'access_reason_general_question',
  device_not_working: 'access_reason_device_not_working',
  automation_help: 'access_reason_automation_help',
  connectivity_issue: 'access_reason_connectivity_issue',
  other: 'access_reason_other',
  ha_dashboard_toggle: 'access_reason_ha_toggle',
};

function AccessCountdown({
  expiresAt,
  onExpire,
  label,
}: {
  expiresAt: string;
  onExpire: () => void;
  label: string;
}) {
  const [remaining, setRemaining] = useState('');
  const [pct, setPct] = useState(100);
  // Sessions can last 15/30/60 min — track the window from first render
  // instead of assuming a fixed 60 min total.
  const totalRef = useRef<number | null>(null);

  useEffect(() => {
    totalRef.current = null;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (totalRef.current === null) totalRef.current = Math.max(diff, 1);
      if (diff <= 0) {
        setRemaining('00:00');
        setPct(0);
        onExpire();
        return;
      }
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
        <span className="text-slate-400 flex items-center gap-1">
          <Clock size={11} /> {label}
        </span>
        <span className="font-mono font-bold text-white">{remaining}</span>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface SupportAccessCardProps {
  // Despite the component's name (kept for git-blame continuity — it
  // predates the client/staff naming split), this is CLIENT-only: it's
  // never rendered from a staff/admin screen (see P1.4-C audit).
  server: ClientServer;
  // Called after a successful grant/revoke and on countdown expiry — the
  // caller owns how to refresh (re-fetch servers/logs), same as the
  // existing client dashboard already does.
  onChanged: () => void;
  // Links the opened session to this ticket (GrantAccessDto.ticketId, which
  // the backend already supports — see access/dto/grant-access.dto.ts).
  // Omitted on the main dashboard's per-server cards, set when this card is
  // embedded on a ticket detail page.
  ticketId?: string;
}

// Reusable support-access grant/revoke control for one server — the same
// component backs both the main client dashboard (one card per server) and
// a ticket detail page (one card for that ticket's server). Extracted from
// the client dashboard rather than reimplemented, so there is exactly one
// place this flow's behavior lives.
export default function SupportAccessCard({ server, onChanged, ticketId }: SupportAccessCardProps) {
  const { t } = useLocale();
  const [actionLoading, setActionLoading] = useState(false);
  const [reasonCode, setReasonCode] = useState<Exclude<AccessReason, 'ha_dashboard_toggle'> | ''>('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [duration, setDuration] = useState(60);

  const grantAccess = async () => {
    setActionLoading(true);
    try {
      const details = reasonCode === 'other' ? reasonDetails.trim() : undefined;
      await api.post(`/access/grant/${server.id}`, {
        ...(reasonCode ? { reasonCode } : {}),
        ...(details ? { reasonDetails: details } : {}),
        durationMinutes: duration,
        ...(ticketId ? { ticketId } : {}),
      });
      toast.success(t('client_access_granted_toast'));
      setReasonCode('');
      setReasonDetails('');
      onChanged();
    } catch {
      toast.error(t('client_err_grant'));
    } finally {
      setActionLoading(false);
    }
  };

  const revokeAccess = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/access/revoke/${server.id}`);
      toast.success(t('client_access_revoked_toast'));
      onChanged();
    } catch {
      toast.error(t('client_err_revoke'));
    } finally {
      setActionLoading(false);
    }
  };

  if (server.accessEnabled) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-green-400" />
          <span className="font-medium text-green-400">{t('client_access_open')}</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">{t('client_access_open_desc')}</p>
        {server.accessExpiresAt && (
          <AccessCountdown expiresAt={server.accessExpiresAt} onExpire={onChanged} label={t('client_access_closes')} />
        )}
        <button
          onClick={revokeAccess}
          disabled={actionLoading}
          className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <>
              <Lock size={14} /> {t('client_access_revoke')}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-700/20 border border-slate-700/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={16} className="text-slate-400" />
        <span className="font-medium text-slate-300">{t('client_access_closed')}</span>
      </div>
      <p className="text-xs text-slate-400 mb-4">{t('client_access_closed_desc')}</p>

      <div className="mb-3">
        <label className="block text-xs text-slate-500 mb-1">{t('client_access_reason_label')}</label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as Exclude<AccessReason, 'ha_dashboard_toggle'>)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
        >
          <option value="">—</option>
          {ACCESS_REASON_CODES.map((code) => (
            <option key={code} value={code}>
              {t(ACCESS_REASON_LABEL_KEY[code])}
            </option>
          ))}
        </select>
        {reasonCode === 'other' && (
          <div className="mt-2">
            <input
              type="text"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder={t('client_access_reason_placeholder')}
              maxLength={280}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">{t('access_reason_other_hint')}</p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-xs text-slate-500 mb-1.5">{t('client_access_duration_label')}</label>
        <div className="flex gap-2">
          {[15, 30, 60].map((minutes) => {
            const selected = duration === minutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => setDuration(minutes)}
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
        onClick={grantAccess}
        disabled={actionLoading}
        className="w-full py-2.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {actionLoading ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <>
            <Unlock size={14} /> {t('client_access_grant')}
          </>
        )}
      </button>
    </div>
  );
}
