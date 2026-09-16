import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { AuditEventType } from '../entities/audit-event.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

// Query params for GET /access/logs. `staffId` is only ever honored for
// ADMIN callers — the controller drops it entirely for STAFF requests and
// substitutes the caller's own id server-side, so this field can never be
// used by a STAFF caller to browse another staff member's activity.
export class AccessLogsQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  serverId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  ticketId?: string;

  @IsOptional()
  @IsEnum(AuditEventType)
  eventType?: AuditEventType;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
