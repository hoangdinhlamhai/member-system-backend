import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'SĐT phải 10 số, bắt đầu bằng 0' })
  phone: string;

  @IsOptional()
  @IsString()
  zaloName?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  referrerCode?: string; // mã giới thiệu của người giới thiệu
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  zaloName?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'SĐT phải 10 số, bắt đầu bằng 0' })
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
