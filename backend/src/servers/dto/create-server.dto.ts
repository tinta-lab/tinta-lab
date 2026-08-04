import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUrl,
  Matches,
} from 'class-validator';

export class CreateServerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(253)
  @Matches(/^[a-z0-9][a-z0-9.\-]{0,251}[a-z0-9]$/, {
    message: 'subdomain must be a valid hostname or full domain',
  })
  subdomain: string;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(256)
  localUrl?: string;
}
