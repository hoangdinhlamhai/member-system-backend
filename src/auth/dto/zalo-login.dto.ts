import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ZaloLoginDto {
  @IsString()
  @IsNotEmpty()
  authCode: string;

  @IsString()
  @IsNotEmpty()
  codeVerifier: string;

  @IsOptional()
  @IsString()
  @Matches(/^ZDC-[a-zA-Z0-9]+$/, {
    message: 'Referral code must follow format ZDC-xxxxxx',
  })
  refCode?: string;
}
