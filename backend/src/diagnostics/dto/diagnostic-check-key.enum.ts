// PHASE1_3_DIAGNOSTICS_SPEC.md §5. Exactly 11 domains — ClientDiagnosticsDto
// §1's `checks.length === 11` invariant is defined against this list's
// length, not a separate hardcoded number. Adding/removing a key here
// changes what "11" means everywhere else that cites it.
export enum DiagnosticCheckKey {
  CLIENT = 'client',
  HUB = 'hub',
  SERVER = 'server',
  AGENT = 'agent',
  HOME_ASSISTANT = 'homeAssistant',
  CLOUDFLARE = 'cloudflare',
  SUPPORT_ACCESS = 'supportAccess',
  RESOURCES = 'resources',
  TEMPLATES = 'templates',
  AUDIT = 'audit',
  PROVISIONING = 'provisioning',
}

export const ALL_DIAGNOSTIC_CHECK_KEYS: readonly DiagnosticCheckKey[] =
  Object.values(DiagnosticCheckKey);
