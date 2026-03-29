import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateManualBillDto {
  @IsString({ message: 'Mã hóa đơn phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mã hóa đơn (pos_bill_code) không được để trống.' })
  pos_bill_code: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Số tiền phải là số.' })
  @Min(1000, { message: 'Số tiền tối thiểu là 1.000 VNĐ.' })
  amount: number;

  @IsUUID('4', { message: 'member_id phải là UUID hợp lệ.' })
  @IsNotEmpty({ message: 'member_id không được để trống.' })
  member_id: string;

  @IsOptional()
  @IsString({ message: 'bill_image_url phải là chuỗi ký tự.' })
  bill_image_url?: string;
}
