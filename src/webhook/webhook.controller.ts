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
import { CukcukWebhookDto } from './dto/cukcuk-webhook.dto';
import { CukcukSignatureGuard } from './guards/cukcuk-signature.guard';

@Controller('api/v1/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

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
}
