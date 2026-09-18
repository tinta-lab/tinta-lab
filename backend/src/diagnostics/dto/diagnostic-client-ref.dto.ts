// Top-level `client` summary on ClientDiagnosticsDto — PHASE1_3_DIAGNOSTICS_SPEC.md
// §1's exact field list, no more (name/email/isInstalled are what a
// Diagnostics header needs to render; anything else belongs to Customer 360
// (§7), not duplicated here).
export class DiagnosticClientRefDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isInstalled: boolean;
}
