import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Endpoint chính cho Zalo Mini App OAuth Login
   * Flow: ZMA authorize → getAccessToken → getPhoneNumber → POST here
   */
  @Post('zalo-login')
  async zaloLogin(@Body() loginDto: ZaloLoginDto) {
    return this.authService.zaloLogin(loginDto);
  }

  /**
   * ⚠️ DEBUG ONLY — Xóa sau khi fix xong
   * Test trực tiếp Zalo API, trả raw response để debug
   */
  @Post('debug-zalo')
  async debugZalo(@Body() body: { accessToken: string; phoneToken?: string }) {
    const appSecret = this.configService.get<string>('ZALO_APP_SECRET') || '';
    const appSecretProof = crypto
      .createHmac('sha256', appSecret)
      .update(body.accessToken)
      .digest('hex');

    const results: any = {
      appSecretConfigured: !!appSecret,
      appSecretLength: appSecret.length,
      accessTokenLength: body.accessToken.length,
      appsecretProof: appSecretProof.substring(0, 10) + '...',
    };

    // Test 1: GET /v2.0/me
    try {
      const meRes = await axios.get('https://graph.zalo.me/v2.0/me', {
        headers: {
          access_token: body.accessToken,
          appsecret_proof: appSecretProof,
        },
        params: { fields: 'id,name,picture' },
      });
      results.meResponse = meRes.data;
    } catch (err: any) {
      results.meError = {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      };
    }

    // Test 2: GET /v2.0/me/info (if phoneToken provided)
    if (body.phoneToken) {
      try {
        const phoneRes = await axios.get('https://graph.zalo.me/v2.0/me/info', {
          headers: {
            access_token: body.accessToken,
            code: body.phoneToken,
            secret_key: appSecret,
            appsecret_proof: appSecretProof,
          },
        });
        results.phoneResponse = phoneRes.data;
      } catch (err: any) {
        results.phoneError = {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        };
      }
    }

    return results;
  }

  /**
   * Endpoint cho đăng nhập bằng SĐT (fallback khi không dùng Zalo OAuth)
   */
  @Post('phone-login')
  async phoneLogin(@Body() loginDto: PhoneLoginDto) {
    return this.authService.phoneLogin(loginDto);
  }

  /**
   * Endpoint cho Admin Web đăng nhập (phone + password)
   */
  @Post('admin-login')
  async adminLogin(@Body() loginDto: AdminLoginDto) {
    return this.authService.adminLogin(loginDto);
  }

  /**
   * Lấy thông tin member hiện tại từ Token
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    // req.user được gán từ JwtStrategy.validate()
    return req.user;
  }
}
