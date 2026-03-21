import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ZaloLoginDto {
  /** Zalo user ID from ZMP SDK getUserInfo() — primary identifier */
  @IsString()
  @IsNotEmpty()
  zaloId: string;

  /** Display name from ZMP SDK getUserInfo() */
  @IsOptional()
  @IsString()
  zaloName?: string;

  /** Avatar URL from ZMP SDK getUserInfo() */
  @IsOptional()
  @IsString()
  zaloAvatar?: string;

  /** Auth code from ZMP SDK getAuthCode() — for verification */
  @IsString()
  @IsNotEmpty()
  authCode: string;

  /** PKCE code verifier from ZMP SDK getAuthCode() */
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
