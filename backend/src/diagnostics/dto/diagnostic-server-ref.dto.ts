import { ApiProperty } from '@nestjs/swagger';
import {
  ServerStatus,
  ServerPublicStatus,
} from '../../servers/entities/server.entity';

// Top-level `server` summary on ClientDiagnosticsDto — PHASE1_3_DIAGNOSTICS_SPEC.md
// §1's exact field list, no more. Reuses the existing ServerStatus/
// ServerPublicStatus enums rather than duplicating their values — not a
// raw Server entity field-for-field, this is the deliberately trimmed
// summary shape §1 specifies. Which server this refers to for a
// multi-server client is decided by §7's deterministic tie-break, not by
// this DTO.
export class DiagnosticServerRefDto {
  id: string;
  name: string;
  subdomain: string;

  @ApiProperty({ enum: ServerStatus, enumName: 'ServerStatus' })
  status: ServerStatus;

  @ApiProperty({ enum: ServerPublicStatus, enumName: 'ServerPublicStatus' })
  publicStatus: ServerPublicStatus;
}
