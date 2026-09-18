// Top-level `hub` summary on ClientDiagnosticsDto — PHASE1_3_DIAGNOSTICS_SPEC.md
// §1's exact field list, no more. `agentOnline` is the live
// TintaAgentGateway.isConnected() boolean (§5's `agent` check source), not
// an AgentSession.status column — deliberately not typed as the AgentStatus
// enum here, matching §1's literal `{ id, agentOnline, agentVersion,
// haVersion }` shape.
export class DiagnosticHubRefDto {
  id: string;
  agentOnline: boolean;
  agentVersion: string | null;
  haVersion: string | null;
}
