import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

/** Token data stored in system_configs */
interface OaTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (ms)
}

@Injectable()
export class ZaloService {
  private readonly logger = new Logger(ZaloService.name);
  private readonly appId: string;
  private readonly appSecret: string;

  /** In-memory cache to avoid DB read on every request */
  private cachedOaToken: OaTokenData | null = null;

  private static readonly SYSTEM_CONFIG_KEY = 'zalo_oa_tokens';
  /** Refresh 5 phút trước khi hết hạn */
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.appId = this.configService.get<string>('ZALO_APP_ID') || '';
    this.appSecret = this.configService.get<string>('ZALO_APP_SECRET') || '';
  }

  // ═══════════════════════════════════════════════════════
  // Social API v4 — Auth Code Exchange (User login)
  // ═══════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════
  // Zalo OA Token Management (auto-refresh)
  // ═══════════════════════════════════════════════════════

  /**
   * Lấy OA Access Token hợp lệ. Tự động refresh nếu gần hết hạn.
   *
   * Flow:
   * 1. Check in-memory cache → nếu còn hạn → return
   * 2. Check DB (system_configs) → nếu còn hạn → cache + return
   * 3. Nếu gần/hết hạn → gọi Zalo API refresh → lưu DB + cache → return
   * 4. Nếu refresh token cũng hết hạn → throw error (cần re-init thủ công)
   */
  async getOaAccessToken(): Promise<string> {
    const now = Date.now();

    // 1. Check in-memory cache
    if (this.cachedOaToken && this.cachedOaToken.expiresAt > now + ZaloService.REFRESH_BUFFER_MS) {
      return this.cachedOaToken.accessToken;
    }

    // 2. Load from DB
    const dbToken = await this.loadTokenFromDb();

    if (dbToken && dbToken.expiresAt > now + ZaloService.REFRESH_BUFFER_MS) {
      this.cachedOaToken = dbToken;
      return dbToken.accessToken;
    }

    // 3. Token gần/hết hạn → refresh
    if (dbToken?.refreshToken) {
      this.logger.log('[ZaloOA] Access token expired or near-expiry, refreshing...');
      const newToken = await this.refreshOaToken(dbToken.refreshToken);
      return newToken.accessToken;
    }

    // 4. Không có token nào → check env fallback
    const envToken = this.configService.get<string>('ZALO_OA_ACCESS_TOKEN');
    if (envToken) {
      this.logger.warn('[ZaloOA] Using static ZALO_OA_ACCESS_TOKEN from env (no auto-refresh)');
      return envToken;
    }

    throw new BadRequestException(
      'ZALO_OA_TOKEN_NOT_CONFIGURED: Chạy POST /api/v1/admin/zalo-oa/init-token để khởi tạo.',
    );
  }

  /**
   * Refresh OA token bằng refresh_token.
   * Zalo trả về access_token MỚI + refresh_token MỚI (1 lần dùng).
   */
  async refreshOaToken(refreshToken: string): Promise<OaTokenData> {
    try {
      const params = new URLSearchParams();
      params.append('app_id', this.appId);
      params.append('refresh_token', refreshToken);
      params.append('grant_type', 'refresh_token');

      const response = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            secret_key: this.appSecret,
          },
        },
      );

      if (response.data.error) {
        this.logger.error(`[ZaloOA] Refresh failed: ${JSON.stringify(response.data)}`);
        throw new BadRequestException({
          message: 'ZALO_OA_REFRESH_FAILED',
          detail: response.data,
          hint: 'Refresh token có thể đã hết hạn (3 tháng). Cần re-init: POST /api/v1/admin/zalo-oa/init-token',
        });
      }

      const expiresIn = parseInt(String(response.data.expires_in), 10) || 3600; // seconds (Zalo OA returns string)
      const tokenData: OaTokenData = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + expiresIn * 1000,
      };

      // Persist to DB + update cache
      await this.saveTokenToDb(tokenData);
      this.cachedOaToken = tokenData;

      this.logger.log(`[ZaloOA] Token refreshed ✅ (expires in ${expiresIn}s)`);
      return tokenData;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`[ZaloOA] Refresh error: ${error.message}`, error.stack);
      throw new BadRequestException({
        message: 'ZALO_OA_REFRESH_ERROR',
        detail: error.message,
      });
    }
  }

  /**
   * Khởi tạo OA token lần đầu (hoặc khi refresh token hết hạn 3 tháng).
   *
   * Cách dùng:
   * 1. Lấy OA refresh_token từ Zalo Developers Console
   * 2. Set env: ZALO_OA_REFRESH_TOKEN=xxx
   * 3. Gọi POST /api/v1/admin/zalo-oa/init-token
   *
   * Sau đó hệ thống tự refresh vĩnh viễn (miễn là không quá 3 tháng không chạy).
   */
  async initOaToken(refreshToken?: string): Promise<{ message: string; expiresAt: string }> {
    const token = refreshToken || this.configService.get<string>('ZALO_OA_REFRESH_TOKEN');

    if (!token) {
      throw new BadRequestException(
        'Cần truyền refreshToken trong body hoặc set ZALO_OA_REFRESH_TOKEN trong env.',
      );
    }

    const result = await this.refreshOaToken(token);

    return {
      message: 'OA token initialized. Hệ thống sẽ tự refresh trước khi hết hạn.',
      expiresAt: new Date(result.expiresAt).toISOString(),
    };
  }

  /**
   * Lưu trực tiếp cặp token đã có sẵn vào DB (không gọi Zalo API).
   * Dùng khi đã lấy token thủ công từ Zalo Developers Console.
   */
  async initOaTokenDirect(accessToken: string, refreshToken: string, expiresIn: number): Promise<{ message: string; expiresAt: string }> {
    const tokenData: OaTokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    await this.saveTokenToDb(tokenData);
    this.cachedOaToken = tokenData;

    this.logger.log(`[ZaloOA] Token saved directly ✅ (expires in ${expiresIn}s)`);

    return {
      message: 'OA token saved. Hệ thống sẽ tự refresh trước khi hết hạn.',
      expiresAt: new Date(tokenData.expiresAt).toISOString(),
    };
  }

  /**
   * Xem trạng thái token hiện tại (cho admin debug).
   */
  async getOaTokenStatus(): Promise<{
    hasToken: boolean;
    expiresAt: string | null;
    isExpired: boolean;
    expiresInMinutes: number | null;
  }> {
    const dbToken = await this.loadTokenFromDb();
    if (!dbToken) {
      return { hasToken: false, expiresAt: null, isExpired: true, expiresInMinutes: null };
    }

    const now = Date.now();
    const isExpired = dbToken.expiresAt <= now;
    const expiresInMinutes = Math.round((dbToken.expiresAt - now) / 60000);

    return {
      hasToken: true,
      expiresAt: new Date(dbToken.expiresAt).toISOString(),
      isExpired,
      expiresInMinutes: isExpired ? 0 : expiresInMinutes,
    };
  }

  // ═══════════════════════════════════════════════════════
  // DB persistence (system_configs table)
  // ═══════════════════════════════════════════════════════

  private async loadTokenFromDb(): Promise<OaTokenData | null> {
    try {
      const config = await this.prisma.systemConfig.findFirst({
        where: { configKey: ZaloService.SYSTEM_CONFIG_KEY, brandId: null },
      });

      if (!config) return null;

      const value = config.configValue as any;
      if (!value?.accessToken || !value?.refreshToken || !value?.expiresAt) return null;

      return {
        accessToken: value.accessToken,
        refreshToken: value.refreshToken,
        expiresAt: value.expiresAt,
      };
    } catch (error) {
      this.logger.error(`[ZaloOA] Failed to load token from DB: ${error.message}`);
      return null;
    }
  }

  private async saveTokenToDb(tokenData: OaTokenData): Promise<void> {
    try {
      const existing = await this.prisma.systemConfig.findFirst({
        where: { configKey: ZaloService.SYSTEM_CONFIG_KEY, brandId: null },
      });

      if (existing) {
        await this.prisma.systemConfig.update({
          where: { id: existing.id },
          data: {
            configValue: tokenData as any,
            updatedAt: new Date(),
          },
        });
      } else {
        await this.prisma.systemConfig.create({
          data: {
            configKey: ZaloService.SYSTEM_CONFIG_KEY,
            configValue: tokenData as any,
            description: 'Zalo OA access_token + refresh_token (auto-managed)',
          },
        });
      }
    } catch (error) {
      this.logger.error(`[ZaloOA] Failed to save token to DB: ${error.message}`);
    }
  }
}

