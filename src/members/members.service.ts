import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(private prisma: PrismaService) {}

  async findByZaloId(zaloId: string) {
    return this.prisma.member.findUnique({
      where: { zaloId },
    });
  }

  async findByPhone(phone: string) {
    // 1. Tìm member theo phone
    const existing = await this.prisma.member.findFirst({
      where: { phone },
    });

    if (existing) {
      return { member: existing, isNewUser: false };
    }

    // 2. Không tìm thấy → tạo mới
    const member = await this.createMemberByPhone({ phone });
    return { member, isNewUser: true };
  }

  async findByReferralCode(referralCode: string) {
    return this.prisma.member.findUnique({
      where: { referralCode },
    });
  }

  async createMember(data: {
    zaloId: string;
    zaloName?: string;
    zaloAvatar?: string;
    phone?: string;
  }) {
    // Generate unique codes
    const qrCode = `QR-${nanoid(8).toUpperCase()}`;
    const referralCode = `ZDC-${nanoid(6).toUpperCase()}`;

    try {
      return await this.prisma.member.create({
        data: {
          ...data,
          qrCode,
          referralCode,
          status: 'verified',
          pointsBalance: 0,
          pointsEarned: 0,
          pointsSpent: 0,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating member: ${error.message}`);
      // Handle potential collision of random codes (though unlikely)
      if (error.code === 'P2002') {
        throw new ConflictException('MEMBER_ALREADY_EXISTS_OR_CODE_COLLISION');
      }
      throw error;
    }
  }

  async createMemberByPhone(data: { phone: string }) {
    const qrCode = `QR-${nanoid(8).toUpperCase()}`;
    const referralCode = `ZDC-${nanoid(6).toUpperCase()}`;

    try {
      return await this.prisma.member.create({
        data: {
          zaloId: `phone_${data.phone}`,  // placeholder vì schema yêu cầu unique
          phone: data.phone,
          qrCode,
          referralCode,
          status: 'verified',
          pointsBalance: 0,
          pointsEarned: 0,
          pointsSpent: 0,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating member by phone: ${error.message}`);
      if (error.code === 'P2002') {
        throw new ConflictException('MEMBER_ALREADY_EXISTS_OR_CODE_COLLISION');
      }
      throw error;
    }
  }

  async updateMemberInfo(id: string, data: {
    zaloName?: string;
    zaloAvatar?: string;
    phone?: string;
    lastActiveAt?: Date;
  }) {
    return this.prisma.member.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async findById(id: string) {
    return this.prisma.member.findUnique({
      where: { id },
    });
  }
}
