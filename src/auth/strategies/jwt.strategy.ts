import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || '',
    });
  }

  async validate(payload: any) {
    // Trả về dữ liệu user sẽ được gắn vào request.user
    return { 
      id: payload.sub, 
      phone: payload.phone, // Dùng phone cho luồng login SĐT
      // zaloId: payload.zaloId // Khi nào có Zalo OA thì dùng lại
    };
  }
}
