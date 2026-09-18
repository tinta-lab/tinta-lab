// PHASE1_3_DIAGNOSTICS_SPEC.md §1. UNKNOWN is deliberately not treated as
// worse than WARNING and never escalates to ERROR in aggregateStatus() —
// see that section's severity table before changing member order/values.
export enum DiagnosticStatus {
  OK = 'ok',
  WARNING = 'warning',
  ERROR = 'error',
  UNKNOWN = 'unknown',
}
