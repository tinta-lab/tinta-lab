import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  haVersion?: string;
}
