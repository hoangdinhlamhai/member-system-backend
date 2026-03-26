import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ZaloService } from '../../zalo/zalo.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/admin/zalo-oa')
@UseGuards(JwtAuthGuard)
export class AdminZaloOaController {
  constructor(private readonly zaloService: ZaloService) {}

  /**
   * POST /api/v1/admin/zalo-oa/init-token
   *
   * Khởi tạo bằng refresh_token → gọi Zalo API để lấy access_token mới.
   */
  @Post('init-token')
  async initToken(@Body() body: { refreshToken?: string }) {
    return this.zaloService.initOaToken(body.refreshToken);
  }

  /**
   * POST /api/v1/admin/zalo-oa/save-token
   *
   * Lưu trực tiếp cặp token đã lấy từ Zalo Developers Console.
   * Dùng khi đã có sẵn access_token + refresh_token + expires_in.
   */
  @Post('save-token')
  async saveToken(@Body() body: { accessToken: string; refreshToken: string; expiresIn: number }) {
    return this.zaloService.initOaTokenDirect(body.accessToken, body.refreshToken, body.expiresIn);
  }

  /**
   * GET /api/v1/admin/zalo-oa/token-status
   *
   * Xem trạng thái token hiện tại (debug/monitoring).
   */
  @Get('token-status')
  async tokenStatus() {
    return this.zaloService.getOaTokenStatus();
  }

  /**
   * POST /api/v1/admin/zalo-oa/refresh-token
   *
   * Force refresh token ngay lập tức.
   */
  @Post('refresh-token')
  async forceRefresh() {
    const token = await this.zaloService.getOaAccessToken();
    const status = await this.zaloService.getOaTokenStatus();
    return {
      message: 'Token refreshed successfully',
      accessTokenPrefix: token.substring(0, 20) + '...',
      ...status,
    };
  }
}
