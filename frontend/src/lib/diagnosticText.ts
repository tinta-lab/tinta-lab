import type { TranslationKey } from '@/i18n/translations';
import type { DiagnosticCheck, DiagnosticStatus } from '@/types';

// Backend (diagnostic-checks.ts) sends a stable `code` plus English
// `title`/`message` kept only for backward compatibility — the frontend is
// the presentation layer and must render the selected locale, never the
// backend's English text, for every code it knows about. This is an
// explicit Record (not a template-literal `diagnostic_${code}_title` cast)
// so a typo or a missing translation key is a compile error, not a
// silently-broken lookup at runtime.
const DIAGNOSTIC_CODE_KEYS: Record<string, { titleKey: TranslationKey; messageKey: TranslationKey }> = {
  CLIENT_ACTIVE: { titleKey: 'diagnostic_CLIENT_ACTIVE_title', messageKey: 'diagnostic_CLIENT_ACTIVE_message' },
  CLIENT_INACTIVE: { titleKey: 'diagnostic_CLIENT_INACTIVE_title', messageKey: 'diagnostic_CLIENT_INACTIVE_message' },
  NO_SERVER: { titleKey: 'diagnostic_NO_SERVER_title', messageKey: 'diagnostic_NO_SERVER_message' },
  HUB_NOT_LINKED: { titleKey: 'diagnostic_HUB_NOT_LINKED_title', messageKey: 'diagnostic_HUB_NOT_LINKED_message' },
  HUB_LINKED: { titleKey: 'diagnostic_HUB_LINKED_title', messageKey: 'diagnostic_HUB_LINKED_message' },
  SERVER_ONLINE: { titleKey: 'diagnostic_SERVER_ONLINE_title', messageKey: 'diagnostic_SERVER_ONLINE_message' },
  SERVER_STATUS_UNKNOWN: { titleKey: 'diagnostic_SERVER_STATUS_UNKNOWN_title', messageKey: 'diagnostic_SERVER_STATUS_UNKNOWN_message' },
  SERVER_RECENTLY_OFFLINE: { titleKey: 'diagnostic_SERVER_RECENTLY_OFFLINE_title', messageKey: 'diagnostic_SERVER_RECENTLY_OFFLINE_message' },
  SERVER_OFFLINE: { titleKey: 'diagnostic_SERVER_OFFLINE_title', messageKey: 'diagnostic_SERVER_OFFLINE_message' },
  AGENT_NOT_PROVISIONED: { titleKey: 'diagnostic_AGENT_NOT_PROVISIONED_title', messageKey: 'diagnostic_AGENT_NOT_PROVISIONED_message' },
  AGENT_OFFLINE: { titleKey: 'diagnostic_AGENT_OFFLINE_title', messageKey: 'diagnostic_AGENT_OFFLINE_message' },
  AGENT_UNRESPONSIVE: { titleKey: 'diagnostic_AGENT_UNRESPONSIVE_title', messageKey: 'diagnostic_AGENT_UNRESPONSIVE_message' },
  AGENT_ONLINE: { titleKey: 'diagnostic_AGENT_ONLINE_title', messageKey: 'diagnostic_AGENT_ONLINE_message' },
  HA_NOT_CHECKED: { titleKey: 'diagnostic_HA_NOT_CHECKED_title', messageKey: 'diagnostic_HA_NOT_CHECKED_message' },
  HA_CONNECTED: { titleKey: 'diagnostic_HA_CONNECTED_title', messageKey: 'diagnostic_HA_CONNECTED_message' },
  HA_API_UNAVAILABLE: { titleKey: 'diagnostic_HA_API_UNAVAILABLE_title', messageKey: 'diagnostic_HA_API_UNAVAILABLE_message' },
  PUBLIC_URL_REACHABLE: { titleKey: 'diagnostic_PUBLIC_URL_REACHABLE_title', messageKey: 'diagnostic_PUBLIC_URL_REACHABLE_message' },
  PUBLIC_URL_UNREACHABLE: { titleKey: 'diagnostic_PUBLIC_URL_UNREACHABLE_title', messageKey: 'diagnostic_PUBLIC_URL_UNREACHABLE_message' },
  PUBLIC_URL_NOT_CHECKED: { titleKey: 'diagnostic_PUBLIC_URL_NOT_CHECKED_title', messageKey: 'diagnostic_PUBLIC_URL_NOT_CHECKED_message' },
  ACCESS_CLOSED: { titleKey: 'diagnostic_ACCESS_CLOSED_title', messageKey: 'diagnostic_ACCESS_CLOSED_message' },
  ACCESS_STATE_INCONSISTENT: { titleKey: 'diagnostic_ACCESS_STATE_INCONSISTENT_title', messageKey: 'diagnostic_ACCESS_STATE_INCONSISTENT_message' },
  ACCESS_EXPIRING_SOON: { titleKey: 'diagnostic_ACCESS_EXPIRING_SOON_title', messageKey: 'diagnostic_ACCESS_EXPIRING_SOON_message' },
  ACCESS_OPEN: { titleKey: 'diagnostic_ACCESS_OPEN_title', messageKey: 'diagnostic_ACCESS_OPEN_message' },
  RESOURCES_NOT_CHECKED: { titleKey: 'diagnostic_RESOURCES_NOT_CHECKED_title', messageKey: 'diagnostic_RESOURCES_NOT_CHECKED_message' },
  // RESOURCE_CRITICAL / RESOURCE_HIGH_USAGE: messageKey holds a {names}
  // placeholder — see buildDiagnosticText()'s special-cased substitution
  // below, driven by evidence.affectedResources (never re-derived here).
  RESOURCE_CRITICAL: { titleKey: 'diagnostic_RESOURCE_CRITICAL_title', messageKey: 'diagnostic_RESOURCE_CRITICAL_message' },
  RESOURCE_HIGH_USAGE: { titleKey: 'diagnostic_RESOURCE_HIGH_USAGE_title', messageKey: 'diagnostic_RESOURCE_HIGH_USAGE_message' },
  RESOURCES_NORMAL: { titleKey: 'diagnostic_RESOURCES_NORMAL_title', messageKey: 'diagnostic_RESOURCES_NORMAL_message' },
  TEMPLATES_NOT_PROVISIONED: { titleKey: 'diagnostic_TEMPLATES_NOT_PROVISIONED_title', messageKey: 'diagnostic_TEMPLATES_NOT_PROVISIONED_message' },
  TEMPLATES_COMPLETE: { titleKey: 'diagnostic_TEMPLATES_COMPLETE_title', messageKey: 'diagnostic_TEMPLATES_COMPLETE_message' },
  // messageKey holds a {count} placeholder — see below.
  TEMPLATES_PENDING: { titleKey: 'diagnostic_TEMPLATES_PENDING_title', messageKey: 'diagnostic_TEMPLATES_PENDING_message' },
  AUDIT_HAS_EVENTS: { titleKey: 'diagnostic_AUDIT_HAS_EVENTS_title', messageKey: 'diagnostic_AUDIT_HAS_EVENTS_message' },
  AUDIT_NO_EVENTS: { titleKey: 'diagnostic_AUDIT_NO_EVENTS_title', messageKey: 'diagnostic_AUDIT_NO_EVENTS_message' },
  NOT_PROVISIONED: { titleKey: 'diagnostic_NOT_PROVISIONED_title', messageKey: 'diagnostic_NOT_PROVISIONED_message' },
  PROVISIONING_CONNECTED: { titleKey: 'diagnostic_PROVISIONING_CONNECTED_title', messageKey: 'diagnostic_PROVISIONING_CONNECTED_message' },
  PROVISIONING_STATE_UNKNOWN: { titleKey: 'diagnostic_PROVISIONING_STATE_UNKNOWN_title', messageKey: 'diagnostic_PROVISIONING_STATE_UNKNOWN_message' },
  INSTALL_PENDING: { titleKey: 'diagnostic_INSTALL_PENDING_title', messageKey: 'diagnostic_INSTALL_PENDING_message' },
  INSTALL_EXPIRED: { titleKey: 'diagnostic_INSTALL_EXPIRED_title', messageKey: 'diagnostic_INSTALL_EXPIRED_message' },
};

const STATUS_KEYS: Record<DiagnosticStatus, TranslationKey> = {
  ok: 'diagnostic_status_ok',
  warning: 'diagnostic_status_warning',
  error: 'diagnostic_status_error',
  unknown: 'diagnostic_status_unknown',
};

// cpu is deliberately not in here — it's the one resource name that stays
// international in every locale (product-wide i18n rule), so callers use
// the literal 'CPU' directly rather than a translation lookup for it.
const RESOURCE_NAME_KEYS: Record<'memory' | 'disk', TranslationKey> = {
  memory: 'diagnostic_resource_memory',
  disk: 'diagnostic_resource_disk',
};

interface AffectedResource {
  resource: 'cpu' | 'memory' | 'disk';
  percent: number;
}

function resourceLabel(resource: AffectedResource['resource'], t: (k: TranslationKey) => string): string {
  return resource === 'cpu' ? 'CPU' : t(RESOURCE_NAME_KEYS[resource]);
}

export function translateDiagnosticStatus(status: DiagnosticStatus, t: (k: TranslationKey) => string): string {
  return t(STATUS_KEYS[status]);
}

// Returns the localized title/message for a check. For a code this
// frontend has no mapping for yet, the USER still gets a localized generic
// message — never the backend's raw English title/message, which would
// violate "the selected language is used everywhere" the moment the
// backend ships a new check the frontend hasn't been taught to translate
// yet. The backend's original English text still reaches the console, so
// this stays diagnosable for developers without ever reaching the UI.
export function buildDiagnosticText(
  check: Pick<DiagnosticCheck, 'code' | 'title' | 'message' | 'evidence'>,
  t: (k: TranslationKey) => string,
): { title: string; message: string } {
  const entry = DIAGNOSTIC_CODE_KEYS[check.code];
  if (!entry) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[diagnostics] No i18n mapping for code "${check.code}" — showing generic fallback text to the user. Backend text was:`,
        { title: check.title, message: check.message },
      );
    }
    return { title: t('diagnostic_unknown_title'), message: t('diagnostic_unknown_message') };
  }

  const title = t(entry.titleKey);
  let message = t(entry.messageKey);

  if (check.code === 'RESOURCE_CRITICAL' || check.code === 'RESOURCE_HIGH_USAGE') {
    const affected = (check.evidence?.affectedResources as AffectedResource[] | undefined) ?? [];
    const names = affected.map((r) => `${resourceLabel(r.resource, t)} ${r.percent}%`).join(', ');
    message = message.replace('{names}', names);
  } else if (check.code === 'TEMPLATES_PENDING') {
    const pending = (check.evidence?.pendingTemplates as string[] | undefined) ?? [];
    message = message.replace('{count}', String(pending.length));
  }

  return { title, message };
}

// Terse relative-time formatting, localized — replaces the previous
// locale-independent "5s ago" (see PHASE1_3_DIAGNOSTICS_SPEC.md's page
// structure note; this was never meant to stay hardcoded English).
export function timeAgo(iso: string, now: number, t: (k: TranslationKey) => string): string {
  const diffMs = now - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return t('diagnostic_time_seconds_ago').replace('{n}', String(sec));
  const min = Math.floor(sec / 60);
  if (min < 60) return t('diagnostic_time_minutes_ago').replace('{n}', String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('diagnostic_time_hours_ago').replace('{n}', String(hr));
  const day = Math.floor(hr / 24);
  return t('diagnostic_time_days_ago').replace('{n}', String(day));
}
