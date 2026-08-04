import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  IsObject,
  Matches,
} from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @Matches(/^[a-z0-9-]{2,64}$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsObject()
  automation: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredEntities?: string[];
}
