import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Deliberately opt-in: `findAll()` callers that don't pass skip/take keep
// getting the full unpaginated array exactly as before — this exists so the
// unbounded list endpoints (servers/users/clients/tickets/hubs) have a way
// to bound their result set once client/ticket counts actually grow, without
// changing the response shape for every existing caller today.
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
