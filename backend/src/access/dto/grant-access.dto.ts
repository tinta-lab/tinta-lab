import { IsOptional, IsString, MaxLength, IsUUID, IsIn } from 'class-validator';

export const ALLOWED_ACCESS_DURATIONS_MINUTES = [15, 30, 60] as const;
export type AccessDurationMinutes =
  (typeof ALLOWED_ACCESS_DURATIONS_MINUTES)[number];

export class GrantAccessDto {
  // Why access is being opened — shown to the client and support in the audit log
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  // Link to an existing support ticket, if this session is for one
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  // 15 / 30 / 60 minutes — defaults to SUPPORT_ACCESS_TIMEOUT (60) if omitted
  @IsOptional()
  @IsIn(ALLOWED_ACCESS_DURATIONS_MINUTES)
  durationMinutes?: AccessDurationMinutes;
}
