import { ApiProperty } from '@nestjs/swagger';
import { AgentSession, AgentStatus } from '../entities/agent-session.entity';

// Response shape for GET /tinta-core/sessions (ADMIN-only). Previously the
// raw AgentSession entity with `client`/`client.user` relations loaded raw —
// agentToken/installToken were already stripped in the service, but the
// nested Client/User came through unfiltered. There's no frontend consumer
// of this endpoint today, so unlike Server/Ticket/Hub this isn't trimming
// fields proven dead against a real screen — it mirrors the same
// ADMIN-appropriate client ref shape already established for GET /hubs
// (see hubs/dto/hub-view.dto.ts's HubClientRefDto/HubClientUserRefDto)
// rather than the full Client entity (address/country/isInstalled/notes).
export class AgentSessionMetricsDto {
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  deviceCount: number;
  automationCount: number;
  uptimeSeconds: number;
}

export class AgentSessionClientUserRefDto {
  firstName: string;
  lastName: string;
  email: string;
}

export class AgentSessionClientRefDto {
  id: string;
  phone: string | null;
  city: string | null;
  @ApiProperty({ type: () => AgentSessionClientUserRefDto })
  user: AgentSessionClientUserRefDto;
}

export class AgentSessionViewDto {
  id: string;
  clientId: string;
  @ApiProperty({ enum: AgentStatus, enumName: 'AgentStatus' })
  status: AgentStatus;
  agentVersion: string | null;
  haVersion: string | null;
  appliedTemplates: string[];
  @ApiProperty({ type: () => AgentSessionMetricsDto, nullable: true })
  metrics: AgentSessionMetricsDto | null;
  lastConnectedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastTokenMismatchAt: Date | null;
  installTokenExpiresAt: Date | null;
  serviceStartConsentAt: Date | null;
  @ApiProperty({ type: () => AgentSessionClientRefDto })
  client: AgentSessionClientRefDto;
  createdAt: Date;
  updatedAt: Date;
}

export function toAgentSessionView(
  session: AgentSession,
): AgentSessionViewDto {
  return {
    id: session.id,
    clientId: session.clientId,
    status: session.status,
    agentVersion: session.agentVersion,
    haVersion: session.haVersion,
    appliedTemplates: session.appliedTemplates,
    metrics: session.metrics,
    lastConnectedAt: session.lastConnectedAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    lastTokenMismatchAt: session.lastTokenMismatchAt,
    installTokenExpiresAt: session.installTokenExpiresAt,
    serviceStartConsentAt: session.serviceStartConsentAt,
    client: {
      id: session.client.id,
      phone: session.client.phone,
      city: session.client.city,
      user: {
        firstName: session.client.user.firstName,
        lastName: session.client.user.lastName,
        email: session.client.user.email,
      },
    },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
