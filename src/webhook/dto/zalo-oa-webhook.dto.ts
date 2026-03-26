import { IsString, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ZaloSender {
  @IsString()
  @IsNotEmpty()
  id: string;
}

class ZaloRecipient {
  @IsString()
  @IsNotEmpty()
  id: string;
}

class ZaloMessage {
  @IsString()
  @IsOptional()
  msg_id?: string;

  @IsString()
  @IsOptional()
  text?: string;
}

/**
 * Zalo OA Webhook Payload DTO
 * Docs: https://developers.zalo.me/docs/official-account/webhook
 */
export class ZaloOaWebhookDto {
  @IsString()
  @IsNotEmpty()
  event_name: string;

  @IsString()
  @IsOptional()
  app_id?: string;

  @IsString()
  @IsOptional()
  timestamp?: string;

  @ValidateNested()
  @Type(() => ZaloSender)
  sender: ZaloSender;

  @ValidateNested()
  @Type(() => ZaloRecipient)
  @IsOptional()
  recipient?: ZaloRecipient;

  @ValidateNested()
  @Type(() => ZaloMessage)
  @IsOptional()
  message?: ZaloMessage;
}
