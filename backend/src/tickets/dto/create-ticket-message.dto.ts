import { IsString, MaxLength, MinLength } from 'class-validator';

// Client-facing reply DTO — deliberately has no `internal` field. Combined
// with the global ValidationPipe's `whitelist: true` (main.ts), an
// `internal: true` sent in the request body is stripped before it ever
// reaches the controller, not just ignored by convention. Staff-only
// internal notes get their own DTO/endpoint in the support-side workflow.
export class CreateTicketMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
