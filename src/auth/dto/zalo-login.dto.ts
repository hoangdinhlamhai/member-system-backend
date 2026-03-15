import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ZaloLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsString()
  @IsNotEmpty()
  phoneToken: string;

  @IsOptional()
  @IsString()
  @Matches(/^ZDC-[a-zA-Z0-9]+$/, {
    message: 'Referral code must follow format ZDC-xxxxxx',
  })
  refCode?: string;
}
