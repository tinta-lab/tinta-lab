import { IsString, MinLength, MaxLength, IsOptional, IsUrl, Matches } from 'class-validator';

export class CreateServerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9-]{2,63}$/, { message: 'subdomain must be lowercase alphanumeric with hyphens' })
  subdomain: string;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(256)
  localUrl?: string;
}
