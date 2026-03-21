import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại phải đúng 10 số, bắt đầu bằng 0',
  })
  phone: string;

  @IsOptional()
  @IsString()
  @Matches(/^ZDC-[a-zA-Z0-9]+$/, {
    message: 'Mã giới thiệu phải đúng định dạng ZDC-xxxxxx',
  })
  refCode?: string;
}
