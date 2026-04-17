import { IsString, MaxLength, IsOptional, Matches } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-().]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;
}
