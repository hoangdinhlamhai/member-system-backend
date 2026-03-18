import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || '',
    });
  }

  async validate(payload: any) {
    // Trả về dữ liệu user sẽ được gắn vào request.user
    if (payload.type === 'staff') {
      // Staff token → query bảng staff để lấy info mới nhất
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
        include: { branch: true },
      });
      if (!staff || !staff.isActive) return null;
      return {
        id: staff.id,
        phone: staff.phone,
        fullName: staff.fullName,
        role: staff.role,
        branchId: staff.branchId,
        branchName: staff.branch?.address || null,
        branchAddress: staff.branch?.address || null,
        userType: 'staff',
      };
    }

    // Member token (hoặc legacy tokens)
    const member = await this.prisma.member.findUnique({
      where: { id: payload.sub },
    });
    if (!member) return null;
    return {
      ...member,
      userType: 'member',
    };
  }
}

