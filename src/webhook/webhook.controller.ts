import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { ZaloOaChatbotService } from './zalo-oa-chatbot.service';
import { CukcukWebhookDto } from './dto/cukcuk-webhook.dto';
import { ZaloOaWebhookDto } from './dto/zalo-oa-webhook.dto';
import { CukcukSignatureGuard } from './guards/cukcuk-signature.guard';

@Controller('api/v1/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly zaloOaChatbotService: ZaloOaChatbotService,
  ) {}

  /**
   * POST /api/v1/webhook/cukcuk
   *
   * Endpoint hứng webhook realtime từ máy tính tiền CUKCUK.
   * Header: X-CUKCUK-Signature (guard verify)
   *
   * Luồng:
   * 1. Guard check signature
   * 2. DTO validate payload
   * 3. Service xử lý (tìm member, tạo transaction, cộng doanh số,
   *    thăng hạng, referral engine) — all in 1 prisma.$transaction
   * 4. Return 200 OK (webhook phải luôn trả 200 để POS không retry sai)
   */
  @Post('cukcuk')
  @UseGuards(CukcukSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async handleCukcukWebhook(@Body() dto: CukcukWebhookDto) {
    this.logger.log(
      `[CUKCUK] Nhận webhook: branch=${dto.branch_id} | phone=${dto.customer_phone || 'N/A'} | bill=${dto.invoice.id}`,
    );

    const result = await this.webhookService.handleCukcukWebhook(dto);

    return {
      success: result.success,
      message: result.message,
      data: {
        transactionId: result.transactionId,
        tierPromotion: result.tierPromotion || null,
        referral: result.referral || null,
      },
    };
  }

  /**
   * POST /api/v1/webhook/zalo-oa
   *
   * Endpoint hứng webhook từ Zalo Official Account.
   * KHÔNG dùng DTO validation — webhook phải luôn trả 200 OK
   * (kể cả khi Zalo gửi verification request hoặc event lạ).
   */
  @Post('zalo-oa')
  @HttpCode(HttpStatus.OK)
  handleZaloOaWebhook(@Body() body: any) {
    const eventName = body?.event_name;
    const senderId = body?.sender?.id;
    const messageText = body?.message?.text;

    this.logger.log(
      `[ZaloOA] Webhook: event=${eventName || 'unknown'} | sender=${senderId || 'N/A'}`,
    );

    // Chỉ xử lý sự kiện user gửi tin nhắn text
    if (eventName === 'user_send_text' && senderId && messageText) {
      // Fire-and-forget: KHÔNG await → trả 200 ngay cho Zalo
      this.zaloOaChatbotService
        .handleUserSendText(senderId, messageText)
        .catch((err) => {
          this.logger.error(`[ZaloOA] Async handler error: ${err.message}`, err.stack);
        });
    }

    return { error: 0, message: 'OK' };
  }
}

