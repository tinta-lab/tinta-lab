'use client';
import { useEffect, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import api from '@/lib/api';
import { AccessLogsFilters, AuditEventType, User } from '@/types';

// This filter dropdown only ever needs id/name — GET /servers returns a
// role-dependent representation (AdminServerReadViewDto for ADMIN,
// SupportServerViewDto for SUPPORT/SALES, see P1.4-A/B), and this shared
// ADMIN+STAFF component has no business depending on either specific view.
// A local UI type keeps it decoupled from both.
type ServerOption = { id: string; name: string };

const EVENT_TYPES: AuditEventType[] = [
  'granted',
  'connected',
  'revoked',
  'expired',
  'security_anomaly',
  'activity_log',
];

const EVENT_LABEL_KEY: Record<AuditEventType, TranslationKey> = {
  granted: 'access_event_granted',
  connected: 'access_event_connected',
  revoked: 'access_event_revoked',
  expired: 'access_event_expired',
  security_anomaly: 'access_event_security_anomaly',
  activity_log: 'access_event_activity_log',
};

interface AccessLogFiltersProps {
  value: AccessLogsFilters;
  onChange: (filters: AccessLogsFilters) => void;
  // Staff filter is ADMIN-only — SUPPORT/SALES are always ticket-scoped
  // server-side and the backend drops this field for them regardless, so
  // hiding the control for non-admin avoids offering a filter that does
  // nothing.
  showStaffFilter: boolean;
}

const selectCls =
  'w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors';

// GET /access/logs?ticketId= validates this server-side and 400s on a
// malformed UUID (AccessLogsQueryDto) — checking the shape client-side
// first means a typo/partial paste shows an inline hint instead of a raw
// "failed to load" from the request itself.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AccessLogFilters({ value, onChange, showStaffFilter }: AccessLogFiltersProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<AccessLogsFilters>(value);
  const [staff, setStaff] = useState<User[]>([]);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [ticketError, setTicketError] = useState(false);

  useEffect(() => {
    if (showStaffFilter) {
      api.get<User[]>('/users').then(({ data }) => {
        setStaff(data.filter((u) => u.role === 'support' || u.role === 'sales'));
      }).catch(() => {});
    }
    api.get<ServerOption[]>('/servers').then(({ data }) => setServers(data)).catch(() => {});
  }, [showStaffFilter]);

  const apply = () => {
    if (draft.ticketId && !UUID_RE.test(draft.ticketId)) {
      setTicketError(true);
      return;
    }
    setTicketError(false);
    onChange({ ...draft, skip: 0 });
  };
  const reset = () => {
    const empty: AccessLogsFilters = {};
    setDraft(empty);
    setTicketError(false);
    onChange(empty);
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
        <Filter size={13} />
        <span className="font-medium">{t('access_logs_filters_title')}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {showStaffFilter && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_staff')}</label>
            <select
              className={selectCls}
              value={draft.staffId ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, staffId: e.target.value || undefined }))}
            >
              <option value="">—</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_server')}</label>
          <select
            className={selectCls}
            value={draft.serverId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, serverId: e.target.value || undefined }))}
          >
            <option value="">—</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_ticket')}</label>
          <input
            className={selectCls}
            placeholder="Ticket ID"
            value={draft.ticketId ?? ''}
            onChange={(e) => {
              setTicketError(false);
              setDraft((d) => ({ ...d, ticketId: e.target.value || undefined }));
            }}
          />
          {ticketError && (
            <p className="text-[11px] text-red-400 mt-1">{t('access_logs_filter_ticket_invalid')}</p>
          )}
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_event')}</label>
          <select
            className={selectCls}
            value={draft.eventType ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, eventType: (e.target.value || undefined) as AuditEventType | undefined }))}
          >
            <option value="">—</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>{t(EVENT_LABEL_KEY[et])}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_date_from')}</label>
          <input
            type="date"
            className={selectCls}
            value={draft.dateFrom?.slice(0, 10) ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined }))}
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('access_logs_filter_date_to')}</label>
          <input
            type="date"
            className={selectCls}
            value={draft.dateTo?.slice(0, 10) ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined }))}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={apply}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white transition-colors"
        >
          {t('access_logs_apply')}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-400 hover:border-slate-600 transition-colors"
        >
          <RotateCcw size={12} /> {t('access_logs_reset')}
        </button>
      </div>
    </div>
  );
}
