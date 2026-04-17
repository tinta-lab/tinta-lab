import { IsString, MinLength, MaxLength, IsObject, IsOptional } from 'class-validator';

export class ExecuteCommandDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  entityType: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  action: string;

  @IsString()
  @MinLength(1)
  entityId: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
