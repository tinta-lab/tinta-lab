import { ApiProperty } from '@nestjs/swagger';
import { DiagnosticStatus } from './diagnostic-status.enum';
import { DiagnosticCheckKey } from './diagnostic-check-key.enum';

// One entry per PHASE1_3_DIAGNOSTICS_SPEC.md §5 check. Field set is exactly
// what §1 specifies — key/status/code/title/message/checkedAt/evidence, no
// more. `evidence` stays `Record<string, unknown>` per §1's documented
// exception (a typed discriminated union is explicitly deferred, §9); it
// must always be built as an allowlisted, field-by-field projection — never
// `{ ...entity }` — per §5's evidence-security rule.
export class DiagnosticCheckDto {
  @ApiProperty({ enum: DiagnosticCheckKey, enumName: 'DiagnosticCheckKey' })
  key: DiagnosticCheckKey;

  @ApiProperty({ enum: DiagnosticStatus, enumName: 'DiagnosticStatus' })
  status: DiagnosticStatus;

  code: string;
  title: string;
  message: string;

  // When THIS check's underlying observation was captured — never copied
  // from ClientDiagnosticsDto.checkedAt. See §1's "checkedAt must never be
  // inherited from the aggregate" rule.
  checkedAt: Date;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  evidence: Record<string, unknown> | null;
}
