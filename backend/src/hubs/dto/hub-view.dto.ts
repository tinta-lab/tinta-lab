import { ApiProperty } from '@nestjs/swagger';

// Response shape for GET /hubs and GET /hubs/:id (both ADMIN-only). The
// previous `Hub`/`HubAgent` were plain TS interfaces — invisible to the
// Swagger CLI plugin (no decorator metadata, no static resolution), so both
// endpoints generated `Record<string, never>` in OpenAPI despite returning
// real, reachable data. Same root cause already fixed for AccessEventView
// (P1.3-B7), then Server/Ticket (P1.4-B/D1) — Hub was the one remaining
// documented gap from that pattern.
//
// Fields checked against the one real consumer, admin/hubs/page.tsx: every
// field below is actually rendered or used in an API call. Excluded
// (present on the old interfaces, zero reads found): `status` (the
// ServerStatus mirror — only `agent.isOnline` drives the online/offline UI),
// `subdomain`, `cfAccessAppId`, `agent.status` (raw AgentSession.status),
// `agent.lastHeartbeatAt`, `client.user.id`, `agent.metrics.uptimeSeconds`.
// `tunnelId` and `agent.installToken` ARE kept — unlike the Server/Ticket
// cases, these are genuinely rendered (a "Tunnel ID" diagnostic row and the
// install-link copy button), not unused secrets.
export class HubAgentMetricsDto {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  deviceCount: number;
  automationCount: number;
}

export class HubAgentViewDto {
  agentVersion: string | null;
  @ApiProperty({ type: () => HubAgentMetricsDto, nullable: true })
  metrics: HubAgentMetricsDto | null;
  lastConnectedAt: Date | null;
  lastTokenMismatchAt: Date | null;
  installToken: string | null;
  installTokenExpiresAt: Date | null;
  isOnline: boolean;
  appliedTemplates: string[];
}

export class HubClientUserRefDto {
  firstName: string;
  lastName: string;
  email: string;
}

export class HubClientRefDto {
  id: string;
  phone: string | null;
  city: string | null;
  @ApiProperty({ type: () => HubClientUserRefDto })
  user: HubClientUserRefDto;
}

export class HubViewDto {
  id: string;
  name: string;
  hubId: string | null;
  publicUrl: string | null;
  localUrl: string | null;
  haVersion: string | null;
  accessEnabled: boolean;
  accessExpiresAt: Date | null;
  lastSeenAt: Date | null;
  tunnelId: string | null;
  @ApiProperty({ type: () => HubClientRefDto })
  client: HubClientRefDto;
  @ApiProperty({ type: () => HubAgentViewDto, nullable: true })
  agent: HubAgentViewDto | null;
}
