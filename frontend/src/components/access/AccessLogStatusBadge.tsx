import { Circle, Clock, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';

interface SessionLifecycle {
  connectedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  isRevoked: boolean;
}

// Session-level derived status (active/pending/expired/revoked/completed) —
// distinct from AccessLogEventBadge, which labels one audit_events row.
// Same derivation as dashboard/admin/staff/page.tsx's sessionEndReason(),
// reused here rather than re-invented so the two views never disagree.
function deriveStatus(s: SessionLifecycle): {
  labelKey: TranslationKey;
  className: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
} {
  if (!s.connectedAt && !s.revokedAt) {
    const expired = new Date(s.expiresAt) < new Date();
    if (expired) {
      return { labelKey: 'staff_status_not_connected', className: 'text-slate-500', icon: AlertCircle };
    }
    return { labelKey: 'staff_status_pending', className: 'text-amber-400', icon: Clock };
  }
  if (!s.revokedAt) {
    const expired = new Date(s.expiresAt) < new Date();
    if (!expired) {
      return { labelKey: 'staff_status_active', className: 'text-green-400', icon: Circle };
    }
    return { labelKey: 'staff_status_expired', className: 'text-slate-500', icon: Clock };
  }
  if (s.isRevoked) {
    return { labelKey: 'staff_status_revoked_by_client', className: 'text-red-400', icon: XCircle };
  }
  return { labelKey: 'staff_status_completed', className: 'text-slate-400', icon: CheckCircle2 };
}

export default function AccessLogStatusBadge({ session }: { session: SessionLifecycle }) {
  const { t } = useLocale();
  const status = deriveStatus(session);
  const Icon = status.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.className}`}>
      <Icon size={12} className={status.icon === Circle ? 'fill-green-400' : ''} />
      {t(status.labelKey)}
    </span>
  );
}
