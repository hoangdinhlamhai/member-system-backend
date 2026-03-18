import { IsString, IsOptional } from 'class-validator';

export class UpsertConfigDto {
  @IsString()
  configKey: string;

  configValue: unknown;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AdjustPointsDto {
  @IsString()
  type: string; // 'admin_add' | 'admin_deduct'

  points: number;

  @IsOptional()
  @IsString()
  note?: string;
}
