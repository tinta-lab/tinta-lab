import {
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  IsIn,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import {
  AccessReason,
  CLIENT_SELECTABLE_ACCESS_REASONS,
  ACCESS_REASONS_REQUIRING_DETAILS,
  ACCESS_REASON_DETAILS_MAX_LENGTH,
} from '../enums/access-reason.enum';

export const ALLOWED_ACCESS_DURATIONS_MINUTES = [15, 30, 60] as const;
export type AccessDurationMinutes =
  (typeof ALLOWED_ACCESS_DURATIONS_MINUTES)[number];

// Rough, best-effort filter for the one field that still accepts free text
// (reasonDetails, only reachable via reasonCode='other'). Not a substitute
// for review — just a barrier against the most common accidental PII: an
// email address or a phone number typed into "please describe the issue".
function IsFreeOfObviousPii(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFreeOfObviousPii',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
          const phonePattern = /(?:\+?\d[\s\-().]?){7,}/;
          return !emailPattern.test(value) && !phonePattern.test(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'reasonDetails must not contain an email address or phone number';
        },
      },
    });
  };
}

export class GrantAccessDto {
  // Why access is being opened — closed set shown to client + support in the
  // audit log. Free text is only possible via reasonDetails when this is OTHER.
  @IsOptional()
  @IsIn(CLIENT_SELECTABLE_ACCESS_REASONS)
  reasonCode?: AccessReason;

  // Required (and only accepted) when reasonCode === OTHER.
  @ValidateIf((dto: GrantAccessDto) =>
    !!dto.reasonCode && ACCESS_REASONS_REQUIRING_DETAILS.has(dto.reasonCode),
  )
  @IsString()
  @MaxLength(ACCESS_REASON_DETAILS_MAX_LENGTH)
  @IsFreeOfObviousPii()
  reasonDetails?: string;

  // Link to an existing support ticket, if this session is for one
  @IsOptional()
  @IsUUID()
  ticketId?: string;

  // 15 / 30 / 60 minutes — defaults to SUPPORT_ACCESS_TIMEOUT (60) if omitted
  @IsOptional()
  @IsIn(ALLOWED_ACCESS_DURATIONS_MINUTES)
  durationMinutes?: AccessDurationMinutes;
}
