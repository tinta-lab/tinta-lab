import { ApiProperty } from '@nestjs/swagger';
import { AuditEventType } from '../entities/audit-event.entity';

// Nested ref shapes shared by AccessEventViewDto and AccessLogDetailDto
// below — extracted to named classes (rather than inline `{ ... } | null`
// object-literal types) because the Swagger CLI plugin's implicit inference
// drops `nullable` for inline nested object types (only primitives get it
// right). An explicit @ApiProperty({ nullable: true }) on the parent field
// is the only way to get an accurate schema for a field that is genuinely
// null at runtime whenever the underlying relation didn't load.
//
// Interfaces (as these two used to be) are erased at compile time and carry
// no decorator metadata, so the Swagger CLI plugin cannot introspect them at
// all — GET /access/logs ended up with no response schema in OpenAPI. Named
// classes are required, same as every other *ViewDto in this codebase.
export class AccessLogPersonRefDto {
  id: string;
  firstName: string;
  lastName: string;
}

export class AccessLogServerRefDto {
  id: string;
  name: string;
}

export class AccessLogTicketRefDto {
  id: string;
  subject: string;
}

// One row per audit_events row — the Access Logs admin/staff view is
// event-level (GRANTED/CONNECTED/REVOKED/EXPIRED/SECURITY_ANOMALY/
// ACTIVITY_LOG), not session-level, so filters like eventType map directly
// onto real columns instead of a derived status. access_logs stays the
// session-level context (grantedAt/expiresAt/revokedAt/ticket/duration) —
// joined in here for display, and available in full via the drill-down
// endpoint (GET /access/logs/:accessLogId).
export class AccessEventViewDto {
  id: string;
  seq: string;
  @ApiProperty({ enum: AuditEventType, enumName: 'AuditEventType' })
  eventType: AuditEventType;
  createdAt: Date;
  accessLogId: string;
  metadata: Record<string, unknown> | null;
  @ApiProperty({ type: () => AccessLogPersonRefDto, nullable: true })
  actor: AccessLogPersonRefDto | null;
  @ApiProperty({ type: () => AccessLogServerRefDto, nullable: true })
  server: AccessLogServerRefDto | null;
  @ApiProperty({ type: () => AccessLogPersonRefDto, nullable: true })
  client: AccessLogPersonRefDto | null;
  @ApiProperty({ type: () => AccessLogTicketRefDto, nullable: true })
  ticket: AccessLogTicketRefDto | null;
}

export class AccessEventPageDto {
  @ApiProperty({ type: () => AccessEventViewDto, isArray: true })
  data: AccessEventViewDto[];
  total: number;
}

// One entry in AccessLogDetailDto.events — extracted to a named class
// (rather than an inline array-literal type) so the Swagger plugin can
// resolve the array item shape via $ref instead of leaving it untyped.
export class AccessLogEventEntryDto {
  id: string;
  seq: string;
  @ApiProperty({ enum: AuditEventType, enumName: 'AuditEventType' })
  eventType: AuditEventType;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// Session-level drill-down for one access_logs row (GET /access/logs/:id) —
// its full lifecycle fields plus the ordered audit_events chain for it.
export class AccessLogDetailDto {
  id: string;
  grantedAt: Date;
  expiresAt: Date;
  connectedAt: Date | null;
  revokedAt: Date | null;
  isRevoked: boolean;
  reasonCode: string | null;
  reasonDetails: string | null;
  reason: string | null;
  @ApiProperty({ type: () => AccessLogPersonRefDto, nullable: true })
  grantedBy: AccessLogPersonRefDto | null;
  @ApiProperty({ type: () => AccessLogPersonRefDto, nullable: true })
  accessedBy: AccessLogPersonRefDto | null;
  @ApiProperty({ type: () => AccessLogServerRefDto, nullable: true })
  server: AccessLogServerRefDto | null;
  @ApiProperty({ type: () => AccessLogPersonRefDto, nullable: true })
  client: AccessLogPersonRefDto | null;
  @ApiProperty({ type: () => AccessLogTicketRefDto, nullable: true })
  ticket: AccessLogTicketRefDto | null;
  events: AccessLogEventEntryDto[];
}
