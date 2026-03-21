import { Controller, Post, Patch, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Zalo OAuth Login (Social API v4)
   * ZMA gửi authCode + codeVerifier → backend exchange → get user info → JWT
   */
  @Post('zalo-login')
  async zaloLogin(@Body() loginDto: ZaloLoginDto) {
    return this.authService.zaloLogin(loginDto);
  }

  /**
   * Đăng nhập bằng SĐT (fallback)
   */
  @Post('phone-login')
  async phoneLogin(@Body() loginDto: PhoneLoginDto) {
    return this.authService.phoneLogin(loginDto);
  }

  /**
   * Admin Web đăng nhập (phone + password)
   */
  @Post('admin-login')
  async adminLogin(@Body() loginDto: AdminLoginDto) {
    return this.authService.adminLogin(loginDto);
  }

  /**
   * Lấy thông tin user hiện tại từ Token
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return req.user;
  }

  /**
   * Hoàn tất profile sau Zalo login: nhập SĐT + mã giới thiệu
   * Requires JWT (member đã login qua Zalo)
   */
  @UseGuards(JwtAuthGuard)
  @Patch('complete-profile')
  async completeProfile(@Request() req, @Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(req.user.sub, dto);
  }
}
