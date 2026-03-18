import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsDateString,
} from 'class-validator';

/**
 * Item trong hóa đơn CUKCUK
 */
export class CukcukInvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  item_name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unit_price: number;

  @IsNumber()
  amount: number;
}

/**
 * Thông tin hóa đơn từ CUKCUK webhook
 */
export class CukcukInvoiceDto {
  @IsString()
  @IsNotEmpty()
  id: string; // pos_bill_id — ID duy nhất từ CUKCUK

  @IsString()
  @IsOptional()
  code?: string; // Mã hóa đơn hiển thị (VD: "HD-20260317-001")

  @IsNumber()
  total_amount: number; // Tổng tiền

  @IsNumber()
  @IsOptional()
  discount_amount?: number; // Giảm giá

  @IsNumber()
  @IsOptional()
  final_amount?: number; // Thực thu (total_amount - discount_amount)

  @IsDateString()
  @IsOptional()
  created_at?: string; // Thời gian tạo bill trên POS

  @ValidateNested({ each: true })
  @Type(() => CukcukInvoiceItemDto)
  @IsOptional()
  items?: CukcukInvoiceItemDto[];
}

/**
 * Payload chính của CUKCUK webhook
 */
export class CukcukWebhookDto {
  @IsString()
  @IsNotEmpty()
  branch_id: string; // cukcuk_branch_id (mapping sang branch trong hệ thống)

  @IsString()
  @IsOptional()
  customer_phone?: string; // SĐT khách hàng (có thể null nếu khách vãng lai)

  @IsString()
  @IsOptional()
  customer_id?: string; // Customer ID trên CUKCUK (pos mapping)

  @ValidateNested()
  @Type(() => CukcukInvoiceDto)
  @IsNotEmpty()
  invoice: CukcukInvoiceDto;
}
