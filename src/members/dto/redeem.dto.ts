import { IsEnum, IsString } from 'class-validator';

export enum RedeemType {
  REWARD = 'reward',
  DISCOUNT = 'discount',
}

export class RedeemDto {
  @IsEnum(RedeemType)
  type: RedeemType;

  @IsString()
  itemId: string;
}
