import {
  IsIn,
  IsString,
  MinLength,
  MaxLength,
  IsObject,
  IsOptional,
} from 'class-validator';
import type { TintaEntityType } from '../tinta-command.types';

const ENTITY_TYPES: TintaEntityType[] = [
  'light',
  'climate',
  'security',
  'switch',
  'cover',
];

export class ExecuteCommandDto {
  @IsIn(ENTITY_TYPES)
  entityType: TintaEntityType;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  action: string;

  @IsString()
  @MinLength(1)
  haEntityId: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
