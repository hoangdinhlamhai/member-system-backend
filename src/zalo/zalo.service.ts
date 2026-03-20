import { Injectable, Logger, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Xác thực access token và lấy thông tin cơ bản từ Zalo
   * @param accessToken Token từ api.getAccessToken() của ZMA
   */
  async verifyAccessToken(accessToken: string): Promise<{
    zaloId: string;
    zaloName: string;
    zaloAvatar: string;
  }> {
    const mockMode = this.configService.get<string>('ZALO_MOCK_MODE') === 'true';
    if (mockMode && accessToken === 'mock-token') {
      this.logger.warn('Using MOCK mode for Zalo verify');
      return {
        zaloId: '987654321',
        zaloName: 'Antigravity Tester',
        zaloAvatar: 'https://avatar.zalo.me/default',
      };
    }

    try {
      const response = await axios.get('https://graph.zalo.me/v2.0/me', {
        headers: { access_token: accessToken },
        params: { fields: 'id,name,picture' },
      });

      if (response.data.error) {
        this.logger.error(`Zalo API Error: ${JSON.stringify(response.data)}`);
        throw new BadRequestException('INVALID_ZALO_ACCESS_TOKEN');
      }

      return {
        zaloId: response.data.id,
        zaloName: response.data.name,
        zaloAvatar: response.data.picture?.data?.url || '',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to verify Zalo token: ${error.message}`);
      throw new BadRequestException('INVALID_ZALO_ACCESS_TOKEN');
    }
  }

  /**
   * Giải mã token số điện thoại từ ZMA
   * @param phoneToken Token từ api.getPhoneNumber()
   * @param accessToken Access token của user
   */
  async decryptPhoneNumber(
    phoneToken: string,
    accessToken: string,
  ): Promise<{ phone: string }> {
    const mockMode = this.configService.get<string>('ZALO_MOCK_MODE') === 'true';
    if (mockMode && phoneToken === 'mock-phone-token') {
      this.logger.warn('Using MOCK mode for Zalo phone decrypt');
      return { phone: '0987654321' };
    }

    try {
      const secretKey = this.configService.get<string>('ZALO_APP_SECRET');

      if (!secretKey) {
        this.logger.error('ZALO_APP_SECRET is not configured');
        throw new HttpException(
          'ZALO_CONFIG_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const response = await axios.get('https://graph.zalo.me/v2.0/me/info', {
        headers: {
          access_token: accessToken,
          code: phoneToken,
          secret_key: secretKey,
        },
      });

      if (response.data.error) {
        this.logger.error(
          `Zalo phone decrypt error: ${JSON.stringify(response.data.error)}`,
        );
        throw new HttpException(
          'INVALID_PHONE_TOKEN',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Zalo returns phone number in format: 84xxxxxxxxx
      let phone = response.data.data?.number;
      if (!phone) {
        this.logger.error('Phone number not found in Zalo response');
        throw new HttpException(
          'PHONE_NOT_FOUND_IN_RESPONSE',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (phone.startsWith('84')) {
        phone = '0' + phone.substring(2);
      }

      return { phone };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Zalo Phone API error: ${error.message}`);
      throw new HttpException(
        'ZALO_PHONE_API_ERROR',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
