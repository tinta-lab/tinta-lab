import { ApiProperty } from '@nestjs/swagger';
import { DiagnosticStatus } from './diagnostic-status.enum';
import { DiagnosticCheckDto } from './diagnostic-check.dto';
import { DiagnosticClientRefDto } from './diagnostic-client-ref.dto';
import { DiagnosticServerRefDto } from './diagnostic-server-ref.dto';
import { DiagnosticHubRefDto } from './diagnostic-hub-ref.dto';

// Response shape for GET /clients/:clientId/diagnostics —
// PHASE1_3_DIAGNOSTICS_SPEC.md §1. `checks` is a fixed-length-11 array in
// practice, one entry per DiagnosticCheckKey (diagnostic-check-key.enum.ts's
// ALL_DIAGNOSTIC_CHECK_KEYS) — TypeScript/OpenAPI have no native "array of
// exactly N" type, so this invariant is enforced by the check-producing
// pipeline at runtime (§11 step 3+) and by the unit/e2e tests §10
// specifies, not by this DTO's shape alone. Nothing in this file builds a
// ClientDiagnosticsDto yet — that's DiagnosticsService (§11 step 4).
export class ClientDiagnosticsDto {
  clientId: string;

  @ApiProperty({ enum: DiagnosticStatus, enumName: 'DiagnosticStatus' })
  overallStatus: DiagnosticStatus;

  checkedAt: Date;

  @ApiProperty({ type: () => DiagnosticCheckDto, isArray: true })
  checks: DiagnosticCheckDto[];

  @ApiProperty({ type: () => DiagnosticClientRefDto })
  client: DiagnosticClientRefDto;

  @ApiProperty({ type: () => DiagnosticServerRefDto, nullable: true })
  server: DiagnosticServerRefDto | null;

  @ApiProperty({ type: () => DiagnosticHubRefDto, nullable: true })
  hub: DiagnosticHubRefDto | null;
}
