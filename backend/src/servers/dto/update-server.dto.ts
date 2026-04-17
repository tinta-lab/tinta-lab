import { IsString, MaxLength, IsOptional, IsUrl, Matches } from 'class-validator';

export class UpdateServerDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(256)
  localUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,63}$/, { message: 'subdomain must be lowercase alphanumeric with hyphens' })
  subdomain?: string;
}
