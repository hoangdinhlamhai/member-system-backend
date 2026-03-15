import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembersService } from '../members/members.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private prisma: PrismaService,
    private membersService: MembersService,
  ) {}

  async getRefereesByReferrerId(referrerId: string) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId },
      include: {
        referee: {
          select: {
            id: true,
            fullName: true,
            zaloName: true,
            phone: true,
            referralCode: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return referrals.map((referral) => ({
      refereeId: referral.refereeId,
      refereeName:
        referral.referee?.fullName ||
        referral.referee?.zaloName ||
        referral.referee?.phone ||
        referral.referee?.referralCode ||
        'Ban moi',
      billCount: referral.totalBills ?? 0,
      totalBillAmount: Number(referral.totalBillAmount ?? 0),
      totalEarned: Number(referral.totalEarned ?? 0),
    }));
  }

  /**
   * Xử lý tạo quan hệ giới thiệu khi có mã refCode
   * @param refCode Mã giới thiệu (VD: ZDC-XXXXXX)
   * @param newMemberId ID của member mới (referee)
   */
  async processReferral(refCode: string, newMemberId: string) {
    try {
      const referrer = await this.membersService.findByReferralCode(refCode);

      if (!referrer) {
        this.logger.warn(`Referrer with code ${refCode} not found. Skipping referral processing.`);
        return null;
      }

      // Không cho phép tự giới thiệu chính mình
      if (referrer.id === newMemberId) {
        this.logger.warn(`Member ${newMemberId} tried to refer themselves. Skipping.`);
        return null;
      }

      // Kiểm tra xem referee đã được ai giới thiệu chưa (mỗi người chỉ có 1 referrer)
      const existingReferral = await this.prisma.referral.findUnique({
        where: { refereeId: newMemberId },
      });

      if (existingReferral) {
        this.logger.warn(`Member ${newMemberId} already has a referrer. Skipping.`);
        return null;
      }

      // Tạo record referral với status pending
      const referral = await this.prisma.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: newMemberId,
          status: 'pending', // Chờ có bill đầu tiên mới active
        },
      });

      // Cập nhật quan hệ trong bảng members
      await this.prisma.member.update({
        where: { id: newMemberId },
        data: { referredById: referrer.id },
      });

      // Tăng số lượng giới thiệu cho referrer
      await this.prisma.member.update({
        where: { id: referrer.id },
        data: { 
          totalReferrals: { increment: 1 } 
        },
      });

      this.logger.log(`Referral created: ${referrer.id} -> ${newMemberId}`);
      return referral;
    } catch (error) {
      this.logger.error(`Error processing referral: ${error.message}`);
      // Không ném lỗi ra ngoài để tránh làm sập flow login chính
      return null;
    }
  }
}
