import { IsOptional, IsString, Matches } from 'class-validator';

export class CompleteProfileDto {
  @IsOptional()
  @IsString()
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại phải đúng 10 số, bắt đầu bằng 0',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  refCode?: string;
}
