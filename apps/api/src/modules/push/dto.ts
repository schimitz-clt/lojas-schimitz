import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpsertPushTokenDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  token!: string;

  @IsOptional()
  @IsString()
  @IsIn(['android'])
  platform?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return true;
  })
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

export class CreatePushCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  linkPath?: string;

  @IsOptional()
  @IsString()
  @IsIn(['all_enabled', 'with_orders'])
  audience?: string;

  @IsOptional()
  @IsString()
  @IsIn(['immediate', 'scheduled', 'agendar'])
  sendMode?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class AdminPushTestDto {
  @IsUUID()
  tokenId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  linkPath?: string;
}
