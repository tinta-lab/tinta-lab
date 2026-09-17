import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TicketStatus } from '../entities/ticket.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

// GET /tickets query params, as a single DTO. Previously `status` was read
// via its own `@Query('status')` alongside a separate `@Query() pagination:
// PaginationDto` — but NestJS's global ValidationPipe (whitelist: true,
// forbidNonWhitelisted: true) validates the *entire* raw query object
// against PaginationDto's own `@Query()` call, so any sibling key not
// declared on PaginationDto (status, and now clientId) was rejected with a
// 400 the moment both were present together. Folding every field into one
// DTO — the same pattern already used by AccessLogsQueryDto — fixes this.
export class FindTicketsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
