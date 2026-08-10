import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsUrl,
  IsUUID,
  Matches,
} from 'class-validator';

export class ProvisionClientDto {
  // Attach this server to an existing client instead of creating a new one.
  // When set, email/password/firstName/lastName/phone/city are ignored.
  @IsOptional()
  @IsUUID()
  existingClientId?: string;

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
  @Matches(/^\+?[\d\s\-().]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  serverName: string;

  @IsString()
  @Matches(/^[a-z0-9-]{2,63}$/, {
    message: 'subdomain must be lowercase alphanumeric with hyphens',
  })
  subdomain: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(256)
  localUrl?: string;

  @IsOptional()
  @IsBoolean()
  applyDefaultTemplates?: boolean;
}
