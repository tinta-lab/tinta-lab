import {
  DiagnosticCheckKey,
  ALL_DIAGNOSTIC_CHECK_KEYS,
} from './diagnostic-check-key.enum';

// PHASE1_3_DIAGNOSTICS_SPEC.md §1: "checks.length === 11 is a fixed
// invariant for v1". This is the source-of-truth list that invariant is
// defined against — pinning its exact membership here means any future
// accidental addition/removal is caught immediately, not discovered later
// when ClientDiagnosticsDto.checks doesn't have the expected length.
describe('DiagnosticCheckKey', () => {
  it('has exactly 11 members, matching PHASE1_3_DIAGNOSTICS_SPEC.md §5', () => {
    expect(ALL_DIAGNOSTIC_CHECK_KEYS).toHaveLength(11);
  });

  it('has no duplicate values', () => {
    expect(new Set(ALL_DIAGNOSTIC_CHECK_KEYS).size).toBe(
      ALL_DIAGNOSTIC_CHECK_KEYS.length,
    );
  });

  it('matches the exact 11 keys named in the spec', () => {
    expect(new Set(ALL_DIAGNOSTIC_CHECK_KEYS)).toEqual(
      new Set([
        DiagnosticCheckKey.CLIENT,
        DiagnosticCheckKey.HUB,
        DiagnosticCheckKey.SERVER,
        DiagnosticCheckKey.AGENT,
        DiagnosticCheckKey.HOME_ASSISTANT,
        DiagnosticCheckKey.CLOUDFLARE,
        DiagnosticCheckKey.SUPPORT_ACCESS,
        DiagnosticCheckKey.RESOURCES,
        DiagnosticCheckKey.TEMPLATES,
        DiagnosticCheckKey.AUDIT,
        DiagnosticCheckKey.PROVISIONING,
      ]),
    );
  });
});
