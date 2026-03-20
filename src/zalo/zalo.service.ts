import { Injectable, Logger, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('ZALO_APP_ID') || '';
    this.appSecret = this.configService.get<string>('ZALO_APP_SECRET') || '';
  }

  private computeAppSecretProof(accessToken: string): string {
    return crypto
      .createHmac('sha256', this.appSecret)
      .update(accessToken)
      .digest('hex');
  }

  /**
   * Social API v4 — Exchange authCode for User Access Token
   * Endpoint: POST https://oauth.zaloapp.com/v4/access_token
   * KHÔNG yêu cầu IP Việt Nam!
   */
  async exchangeAuthCode(authCode: string, codeVerifier: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const mockMode = this.configService.get<string>('ZALO_MOCK_MODE') === 'true';
    if (mockMode && authCode === 'mock-auth-code') {
      this.logger.warn('Using MOCK mode for Zalo auth code exchange');
      return {
        accessToken: 'mock-user-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      };
    }

    try {
      this.logger.log(`Exchanging auth code (length: ${authCode.length})`);

      const params = new URLSearchParams();
      params.append('app_id', this.appId);
      params.append('code', authCode);
      params.append('code_verifier', codeVerifier);
      params.append('grant_type', 'authorization_code');

      const response = await axios.post(
        'https://oauth.zaloapp.com/v4/access_token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            secret_key: this.appSecret,
          },
        },
      );

      this.logger.log(`OAuth token exchange response: ${JSON.stringify(response.data)}`);

      if (response.data.error) {
        this.logger.error(`OAuth exchange error: ${JSON.stringify(response.data)}`);
        throw new BadRequestException('ZALO_AUTH_CODE_INVALID');
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`OAuth exchange failed: ${error.message}`);
      this.logger.error(`Response: ${JSON.stringify(error.response?.data)}`);
      throw new BadRequestException('ZALO_AUTH_CODE_EXCHANGE_FAILED');
    }
  }

  /**
   * Social API v4 — Lấy user info bằng User Access Token
   * Endpoint: GET https://graph.zalo.me/v2.0/me
   * Dùng User Access Token v4 (từ OAuth exchange)
   */
  async getUserInfo(accessToken: string): Promise<{
    zaloId: string;
    zaloName: string;
    zaloAvatar: string;
    phone?: string;
  }> {
    const mockMode = this.configService.get<string>('ZALO_MOCK_MODE') === 'true';
    if (mockMode && accessToken === 'mock-user-access-token') {
      this.logger.warn('Using MOCK mode for Zalo user info');
      return {
        zaloId: '987654321',
        zaloName: 'Antigravity Tester',
        zaloAvatar: 'https://avatar.zalo.me/default',
        phone: '0987654321',
      };
    }

    try {
      const appsecretProof = this.computeAppSecretProof(accessToken);

      const response = await axios.get('https://graph.zalo.me/v2.0/me', {
        headers: {
          access_token: accessToken,
          appsecret_proof: appsecretProof,
        },
        params: { fields: 'id,name,picture,phone' },
      });

      this.logger.log(`Zalo user info response: ${JSON.stringify(response.data)}`);

      if (response.data.error) {
        this.logger.error(`Zalo user info error: ${JSON.stringify(response.data)}`);
        throw new BadRequestException({
          message: 'ZALO_GET_USER_INFO_FAILED',
          zaloDetail: response.data,
        });
      }

      // Phone có thể trả về hoặc không, tùy scope đã grant
      let phone = response.data.phone;
      if (phone && phone.startsWith('84')) {
        phone = '0' + phone.substring(2);
      }

      return {
        zaloId: response.data.id,
        zaloName: response.data.name || '',
        zaloAvatar: response.data.picture?.data?.url || '',
        phone: phone || undefined,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const zaloError = error.response?.data || error.message;
      this.logger.error(`Zalo user info failed: ${JSON.stringify(zaloError)}`);
      throw new BadRequestException({
        message: 'ZALO_GET_USER_INFO_FAILED',
        zaloDetail: zaloError,
      });
    }
  }
}
