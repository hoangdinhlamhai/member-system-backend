import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class PhoneLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{9}$/, { message: 'SĐT không hợp lệ (VD: 0987654321)' })
  phone: string;

  @IsOptional()
  @IsString()
  @Matches(/^ZDC-[a-zA-Z0-9]+$/, { message: 'Mã giới thiệu không đúng format' })
  refCode?: string;
}
