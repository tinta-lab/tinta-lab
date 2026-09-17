import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsBoolean,
  MinLength,
  IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  @ApiProperty({ enum: UserRole, enumName: 'UserRole', required: false })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
