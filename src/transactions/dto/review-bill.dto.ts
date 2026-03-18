import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RejectBillDto {
  @IsString({ message: 'Lý do từ chối phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống.' })
  reject_reason: string;
}
