import { DiagnosticStatus } from './dto/diagnostic-status.enum';
import { DiagnosticCheckDto } from './dto/diagnostic-check.dto';

// PHASE1_3_DIAGNOSTICS_SPEC.md §1: severity max, with UNKNOWN deliberately
// ranked below WARNING so it never escalates to ERROR on its own.
const STATUS_SEVERITY: Record<DiagnosticStatus, number> = {
  [DiagnosticStatus.OK]: 0,
  [DiagnosticStatus.UNKNOWN]: 1,
  [DiagnosticStatus.WARNING]: 2,
  [DiagnosticStatus.ERROR]: 3,
};

// `checks` is contractually always exactly 11 entries (ClientDiagnosticsDto's
// invariant, §1) — an empty array is a caller bug, not a valid diagnostic
// state, so it throws rather than silently resolving to OK.
export function aggregateStatus(
  checks: readonly DiagnosticCheckDto[],
): DiagnosticStatus {
  if (checks.length === 0) {
    throw new Error(
      'aggregateStatus() called with an empty checks array — this violates ' +
        'the ClientDiagnosticsDto.checks.length === 11 contract; it is a ' +
        'programmer error, not a valid diagnostic state to silently resolve as OK.',
    );
  }
  return checks.reduce<DiagnosticStatus>(
    (worst, c) =>
      STATUS_SEVERITY[c.status] > STATUS_SEVERITY[worst] ? c.status : worst,
    DiagnosticStatus.OK,
  );
}
