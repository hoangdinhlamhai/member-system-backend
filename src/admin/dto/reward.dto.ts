import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRewardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsString()
  type: string; // 'gift' | 'voucher'

  @IsNumber()
  @Min(1)
  pointsRequired: number;

  @IsOptional()
  @IsNumber()
  quantityLimit?: number;

  @IsOptional()
  @IsNumber()
  perMemberLimit?: number;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;
}

export class UpdateRewardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pointsRequired?: number;

  @IsOptional()
  @IsNumber()
  quantityLimit?: number;

  @IsOptional()
  @IsNumber()
  perMemberLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validUntil?: string;
}

export class CreateDiscountTierDto {
  @IsNumber()
  @Type(() => Number)
  discountPercent: number;

  @IsNumber()
  @Min(1)
  pointsRequired: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxDiscountAmount?: number;
}

export class UpdateDiscountTierDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pointsRequired?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
