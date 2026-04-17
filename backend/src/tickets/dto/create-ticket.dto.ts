import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum, Matches } from 'class-validator';
import { TicketType } from '../entities/ticket.entity';

export class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-().]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  subject: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;
}
