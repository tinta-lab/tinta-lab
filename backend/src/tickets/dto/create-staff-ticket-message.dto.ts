import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

// Staff-facing reply DTO — unlike CreateTicketMessageDto (client), `internal`
// is required here: staff must explicitly choose public reply vs.
// staff-only note for every message, rather than getting a silent default.
export class CreateStaffTicketMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsBoolean()
  internal: boolean;
}
