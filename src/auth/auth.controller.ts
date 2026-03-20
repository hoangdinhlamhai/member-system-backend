import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint chính cho Zalo Mini App OAuth Login
   * Flow: ZMA authorize → getAccessToken → getPhoneNumber → POST here
   */
  @Post('zalo-login')
  async zaloLogin(@Body() loginDto: ZaloLoginDto) {
    return this.authService.zaloLogin(loginDto);
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
