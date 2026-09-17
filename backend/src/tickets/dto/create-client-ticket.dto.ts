import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketType } from '../entities/ticket.entity';

// Used by the authenticated client-portal flow (POST /tickets) only.
// name/email/phone are NOT accepted here — they're derived server-side from
// the authenticated user, unlike the public contact form's CreateTicketDto.
export class CreateClientTicketDto {
  @IsEnum(TicketType)
  @ApiProperty({ enum: TicketType, enumName: 'TicketType' })
  type: TicketType;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  description: string;

  // Which home/server this concerns — ownership is verified server-side
  // against the caller's own client record, never trusted as-is.
  @IsUUID()
  serverId: string;
}
