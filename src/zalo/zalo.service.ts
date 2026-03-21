import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);
  private readonly appId: string;
  private readonly appSecret: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('ZALO_APP_ID') || '';
    this.appSecret = this.configService.get<string>('ZALO_APP_SECRET') || '';
  }

  /**
   * Social API v4 — Exchange authCode for User Access Token
   * Endpoint: POST https://oauth.zaloapp.com/v4/access_token
   * Used to VERIFY the user is legitimately authenticated via Zalo.
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
      this.logger.log(`Exchanging auth code (length: ${authCode.length}), app_id: ${this.appId.substring(0, 6)}...`);

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

      this.logger.log(`OAuth response: ${JSON.stringify(response.data)}`);

      if (response.data.error) {
        this.logger.error(`OAuth exchange error: ${JSON.stringify(response.data)}`);
        throw new BadRequestException({
          message: 'ZALO_AUTH_CODE_INVALID',
          zaloError: response.data,
          appIdUsed: this.appId.substring(0, 8) + '...',
        });
      }

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = error.response?.data || error.message;
      this.logger.error(`OAuth exchange failed: ${JSON.stringify(detail)}`);
      throw new BadRequestException({
        message: 'ZALO_AUTH_CODE_EXCHANGE_FAILED',
        detail,
        appIdUsed: this.appId.substring(0, 8) + '...',
      });
    }
  }
}

