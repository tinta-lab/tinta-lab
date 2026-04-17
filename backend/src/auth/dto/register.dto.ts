import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lastName: string;

  @IsString()
  @Matches(/^\+?[\d\s\-().]{7,20}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;
}
