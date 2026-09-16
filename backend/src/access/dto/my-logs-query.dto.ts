import { IsOptional, IsUUID } from 'class-validator';

export class MyLogsQueryDto {
  @IsOptional()
  @IsUUID()
  ticketId?: string;
}
