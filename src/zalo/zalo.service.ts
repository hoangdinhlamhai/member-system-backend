import { Injectable, Logger, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);
  private readonly appSecret: string;

  constructor(private configService: ConfigService) {
    this.appSecret = this.configService.get<string>('ZALO_APP_SECRET') || '';
  }

  /**
   * Tính appsecret_proof = HMAC-SHA256(access_token, app_secret)
   * Bắt buộc từ 01/01/2024 cho tất cả Zalo Open API calls
   */
  private computeAppSecretProof(accessToken: string): string {
    return crypto
      .createHmac('sha256', this.appSecret)
      .update(accessToken)
      .digest('hex');
  }

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
      const appsecretProof = this.computeAppSecretProof(accessToken);

      const response = await axios.get('https://graph.zalo.me/v2.0/me', {
        headers: {
          access_token: accessToken,
          appsecret_proof: appsecretProof,
        },
        params: { fields: 'id,name,picture' },
      });

      this.logger.log(`Zalo API response: ${JSON.stringify(response.data)}`);

      if (response.data.error) {
        this.logger.error(`Zalo API Error: ${JSON.stringify(response.data)}`);
        throw new BadRequestException('INVALID_ZALO_ACCESS_TOKEN');
      }

      return {
        zaloId: response.data.id,
        zaloName: response.data.name || '',
        zaloAvatar: response.data.picture?.data?.url || '',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Failed to verify Zalo token: ${error.message}`);
      this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);
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
      if (!this.appSecret) {
        this.logger.error('ZALO_APP_SECRET is not configured');
        throw new HttpException(
          'ZALO_CONFIG_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const appsecretProof = this.computeAppSecretProof(accessToken);

      const response = await axios.get('https://graph.zalo.me/v2.0/me/info', {
        headers: {
          access_token: accessToken,
          code: phoneToken,
          secret_key: this.appSecret,
          appsecret_proof: appsecretProof,
        },
      });

      this.logger.log(`Zalo phone API response: ${JSON.stringify(response.data)}`);

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
        this.logger.error(`Phone number not found in Zalo response: ${JSON.stringify(response.data)}`);
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
      this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);
      throw new HttpException(
        'ZALO_PHONE_API_ERROR',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
