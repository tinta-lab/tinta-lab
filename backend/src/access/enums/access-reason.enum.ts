// Closed set of reasons a client can give when opening support access.
// GDPR motivation: the old `reason` field was free text embedded verbatim
// into the append-only `audit_events.metadata` — anything a client typed
// (including accidental PII) was permanent and unredactable. An enum makes
// PII physically impossible to enter for the common cases; OTHER is the one
// escape hatch, and it's the only value that accepts free text at all.
//
// Values are persisted (DB column + audit ledger metadata) — do not rename
// or remove existing values after deploying. Adding new values is safe.
export enum AccessReason {
  GENERAL_QUESTION = 'general_question',
  DEVICE_NOT_WORKING = 'device_not_working',
  AUTOMATION_HELP = 'automation_help',
  CONNECTIVITY_ISSUE = 'connectivity_issue',
  OTHER = 'other',
  // System-generated only (client toggled input_boolean.tinta_support_access
  // in Home Assistant directly, bypassing the dashboard form entirely) — not
  // offered as a selectable option in GrantAccessDto.
  HA_DASHBOARD_TOGGLE = 'ha_dashboard_toggle',
}

// Reasons a client/admin can actually pick in the grant-access form.
export const CLIENT_SELECTABLE_ACCESS_REASONS: readonly AccessReason[] = [
  AccessReason.GENERAL_QUESTION,
  AccessReason.DEVICE_NOT_WORKING,
  AccessReason.AUTOMATION_HELP,
  AccessReason.CONNECTIVITY_ISSUE,
  AccessReason.OTHER,
];

// Only these reason codes require (and accept) the free-text reasonDetails.
export const ACCESS_REASONS_REQUIRING_DETAILS: ReadonlySet<AccessReason> = new Set([
  AccessReason.OTHER,
]);

export const ACCESS_REASON_DETAILS_MAX_LENGTH = 280;
