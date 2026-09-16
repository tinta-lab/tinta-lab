import { ShieldCheck, Wifi, ShieldX, Clock, AlertTriangle, ScrollText } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import { AuditEventType } from '@/types';

// One row per audit_events row is an EVENT, not a session — this badge is
// the event-type indicator (GRANTED/CONNECTED/REVOKED/...), distinct from
// AccessLogStatusBadge, which shows a session's derived lifecycle status.
const EVENT_META: Record<
  AuditEventType,
  { labelKey: TranslationKey; className: string; icon: React.ComponentType<{ size?: number }> }
> = {
  granted: {
    labelKey: 'access_event_granted',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: ShieldCheck,
  },
  connected: {
    labelKey: 'access_event_connected',
    className: 'bg-green-500/10 text-green-400 border-green-500/30',
    icon: Wifi,
  },
  revoked: {
    labelKey: 'access_event_revoked',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: ShieldX,
  },
  expired: {
    labelKey: 'access_event_expired',
    className: 'bg-slate-700/30 text-slate-400 border-slate-600',
    icon: Clock,
  },
  security_anomaly: {
    labelKey: 'access_event_security_anomaly',
    className: 'bg-red-500/10 text-red-400 border-red-500/30',
    icon: AlertTriangle,
  },
  activity_log: {
    labelKey: 'access_event_activity_log',
    className: 'bg-slate-700/30 text-slate-400 border-slate-600',
    icon: ScrollText,
  },
};

export default function AccessLogEventBadge({ eventType }: { eventType: AuditEventType }) {
  const { t } = useLocale();
  const meta = EVENT_META[eventType];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.className}`}>
      <Icon size={11} />
      {t(meta.labelKey)}
    </span>
  );
}
