'use client';
import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, ChevronDown, ChevronUp, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/context';
import { formatTime } from '@/lib/format';
import { accessApi } from '@/services/access.api';
import { AccessLogDetail, AuditTrailEventView } from '@/types';
import { ACCESS_REASON_LABEL_KEY, AccessReason } from '@/components/support/SupportAccessCard';
import AccessLogEventBadge from './AccessLogEventBadge';
import AccessLogStatusBadge from './AccessLogStatusBadge';

interface AccessLogDetailsDrawerProps {
  accessLogId: string | null;
  onClose: () => void;
  // Raw jsonb metadata is deliberately gated — human-readable fields
  // (reason/duration/granted by) cover what a viewer normally needs; raw
  // JSON stays available only for ADMIN debugging, per explicit product
  // decision (never shown to a general viewer by default).
  showRawMetadata: boolean;
}

function durationMinutes(grantedAt: string, expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - new Date(grantedAt).getTime()) / 60000);
}

export default function AccessLogDetailsDrawer({ accessLogId, onClose, showRawMetadata }: AccessLogDetailsDrawerProps) {
  const { t, locale } = useLocale();
  const [detail, setDetail] = useState<AccessLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [rawOpenId, setRawOpenId] = useState<string | null>(null);
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [cryptoTrail, setCryptoTrail] = useState<AuditTrailEventView[] | null>(null);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const requestId = useRef(0);

  const load = async (accessLogId: string) => {
    const id = ++requestId.current;
    setDetail(null);
    setError(false);
    setLoading(true);
    try {
      const result = await accessApi.getAccessSession(accessLogId);
      if (id !== requestId.current) return;
      setDetail(result);
    } catch {
      if (id !== requestId.current) return;
      setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLogId) load(accessLogId);
    setCryptoOpen(false);
    setCryptoTrail(null);
  }, [accessLogId]);

  const toggleCryptoTrail = async () => {
    if (cryptoOpen) { setCryptoOpen(false); return; }
    setCryptoOpen(true);
    if (cryptoTrail || !accessLogId) return;
    setCryptoLoading(true);
    try {
      setCryptoTrail(await accessApi.getAuditTrail(accessLogId));
    } catch {
      setCryptoOpen(false);
    } finally {
      setCryptoLoading(false);
    }
  };

  // A session is revocable from here only while it's still open — not yet
  // revoked and not past its expiry. Matches AccessLogStatusBadge's
  // "active"/"pending" derivation so the button only appears when the
  // action would actually do something.
  const isOpenSession = !!detail && !detail.isRevoked && !detail.revokedAt
    && new Date(detail.expiresAt) > new Date();

  const handleRevoke = async () => {
    if (!detail?.server || !accessLogId) return;
    setRevoking(true);
    try {
      await accessApi.revokeAccess(detail.server.id);
      toast.success(t('access_logs_revoke_success'));
      await load(accessLogId);
    } catch {
      toast.error(t('access_logs_revoke_error'));
    } finally {
      setRevoking(false);
    }
  };

  if (!accessLogId) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-slate-800 border-l border-slate-700 overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="font-semibold">{t('access_logs_drawer_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin text-slate-600" /></div>
        ) : error || !detail ? (
          <div className="text-center py-16 text-slate-500 px-6">
            <p>{t('access_logs_load_error')}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            <div className="flex items-center justify-between">
              <AccessLogStatusBadge session={detail} />
              {showRawMetadata && isOpenSession && (
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {revoking ? <RefreshCw size={13} className="animate-spin" /> : <ShieldOff size={13} />}
                  {t('access_logs_revoke')}
                </button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {detail.client && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('access_logs_col_client')}</span>
                  <span className="text-slate-200">{detail.client.firstName} {detail.client.lastName}</span>
                </div>
              )}
              {detail.server && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('access_logs_drawer_server')}</span>
                  <span className="text-slate-200">{detail.server.name}</span>
                </div>
              )}
              {detail.ticket && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('access_logs_drawer_ticket')}</span>
                  <span className="text-slate-200 truncate max-w-[220px]">#{detail.ticket.id.slice(0, 8)} — {detail.ticket.subject}</span>
                </div>
              )}
              {detail.reasonCode && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('access_logs_reason')}</span>
                  <span className="text-slate-200 text-right max-w-[220px]">
                    {t(ACCESS_REASON_LABEL_KEY[detail.reasonCode as AccessReason])}
                    {detail.reasonDetails ? ` — ${detail.reasonDetails}` : ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{t('access_logs_duration')}</span>
                <span className="text-slate-200">{durationMinutes(detail.grantedAt, detail.expiresAt)} {t('client_access_minutes_short')}</span>
              </div>
              {detail.grantedBy && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('access_logs_granted_by')}</span>
                  <span className="text-slate-200">{detail.grantedBy.firstName} {detail.grantedBy.lastName}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">{t('access_logs_drawer_timeline')}</h3>
              <div className="space-y-3">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="border border-slate-700/50 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">
                          {formatTime(ev.createdAt, locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <AccessLogEventBadge eventType={ev.eventType} />
                      </div>
                      {showRawMetadata && ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <button
                          onClick={() => setRawOpenId((id) => (id === ev.id ? null : ev.id))}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {rawOpenId === ev.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </div>
                    {showRawMetadata && rawOpenId === ev.id && (
                      <pre className="text-[11px] text-slate-400 bg-slate-900/50 px-3 py-2 overflow-x-auto border-t border-slate-700/50">
                        {JSON.stringify(ev.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {showRawMetadata && (
              <p className="text-[11px] text-slate-600">{t('access_logs_raw_metadata')}</p>
            )}

            {showRawMetadata && (
              <div>
                <button
                  onClick={toggleCryptoTrail}
                  className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 hover:text-slate-300"
                >
                  {cryptoOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {t('access_logs_crypto_trail')}
                </button>
                {cryptoOpen && (
                  cryptoLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw size={16} className="animate-spin text-slate-600" /></div>
                  ) : cryptoTrail ? (
                    <div className="mt-3 space-y-2">
                      {cryptoTrail.map((ev) => (
                        <div key={ev.id} className="text-[11px] font-mono bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 space-y-1 overflow-x-auto">
                          <div className="text-slate-500">seq <span className="text-slate-300">{ev.seq}</span></div>
                          <div className="text-slate-500">hash <span className="text-slate-300 break-all">{ev.hash}</span></div>
                          <div className="text-slate-500">prev <span className="text-slate-300 break-all">{ev.prevHash ?? '—'}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 mt-2">{t('access_logs_load_error')}</p>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
