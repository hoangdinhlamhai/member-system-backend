import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @deprecated Tạm thời khóa luồng này vì chưa có Zalo OA
   * Endpoint chính cho Zalo Mini App Login
   */
  /*
  @Post('zalo-login')
  async login(@Body() loginDto: ZaloLoginDto) {
    return this.authService.zaloLogin(loginDto);
  }
  */

  /**
   * Endpoint cho đăng nhập bằng SĐT (khi không có Zalo OA)
   */
  @Post('phone-login')
  async phoneLogin(@Body() loginDto: PhoneLoginDto) {
    return this.authService.phoneLogin(loginDto);
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
