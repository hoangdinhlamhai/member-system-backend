import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTierDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsNumber()
  @Min(0)
  displayOrder: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSpending: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pointsMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  referralBonusPercent?: number;

  @IsOptional()
  themeConfig?: Record<string, unknown>;
}

export class UpdateTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minSpending?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pointsMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  referralBonusPercent?: number;

  @IsOptional()
  themeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
