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

  /**
   * Dashboard data cho member: profile + tier + stats
   */
  async getDashboard(memberId: string) {
    // 1. Lấy member info
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) return null;

    // 2. Xác định tier hiện tại dựa trên lifetimeSpending
    const allTiers = await this.prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'asc' },
    });

    const spending = member.lifetimeSpending ?? BigInt(0);

    // Tìm tier cao nhất mà member đạt được
    let currentTier = allTiers[0] || null;
    for (const tier of allTiers) {
      if (spending >= tier.minSpending) {
        currentTier = tier;
      }
    }

    // Tìm tier tiếp theo
    const currentIndex = allTiers.findIndex((t) => t.id === currentTier?.id);
    const nextTier = currentIndex < allTiers.length - 1 ? allTiers[currentIndex + 1] : null;
    const nextTierSpendingRequired = nextTier
      ? Number(nextTier.minSpending - spending)
      : 0;

    // 3. Stats tháng này
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Đếm transaction approved trong tháng
    const monthlyTxs = await this.prisma.transaction.findMany({
      where: {
        memberId,
        status: 'approved',
        createdAt: { gte: startOfMonth },
      },
      select: { amount: true },
    });

    const monthlyVisits = monthlyTxs.length;
    const monthlySelfSales = monthlyTxs.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    // Hoa hồng referral tháng này (tiền nhận từ F1)
    const monthlyReferralEarnings = await this.prisma.referralEarning.findMany({
      where: {
        referrerId: memberId,
        createdAt: { gte: startOfMonth },
      },
      select: { earnAmount: true },
    });

    const monthlyReferralSales = monthlyReferralEarnings.reduce(
      (sum, e) => sum + Number(e.earnAmount),
      0,
    );

    // 4. Trả về
    return {
      member: {
        id: member.id,
        zaloId: member.zaloId,
        zaloName: member.zaloName,
        zaloAvatar: member.zaloAvatar,
        phone: member.phone,
        fullName: member.fullName,
        status: member.status,
        qrCode: member.qrCode,
        referralCode: member.referralCode,
        pointsBalance: member.pointsBalance ?? 0,
        pointsEarned: member.pointsEarned ?? 0,
        pointsSpent: member.pointsSpent ?? 0,
        lifetimeSpending: Number(member.lifetimeSpending ?? 0),
        monthlySpending: Number(member.monthlySpending ?? 0),
        tierId: currentTier?.id || null,
        tierName: currentTier?.slug || 'bronze',
        tierDisplayName: currentTier?.name || 'Thành viên',
        tierMultiplier: currentTier ? Number(currentTier.pointsMultiplier) : 1,
        tierThemeConfig: currentTier?.themeConfig || null,
        referralBonusPercent: currentTier
          ? Number(currentTier.referralBonusPercent)
          : 5,
        createdAt: member.createdAt,
      },
      stats: {
        totalVisits: 0, // TODO: query all-time count if needed
        monthlyVisits,
        pointsEarned: member.pointsEarned ?? 0,
        pointsSpent: member.pointsSpent ?? 0,
        nextTierSpendingRequired,
        monthlySelfSales,
        monthlyReferralSales,
      },
      tier: currentTier
        ? {
            id: currentTier.id,
            name: currentTier.name,
            slug: currentTier.slug,
            displayOrder: currentTier.displayOrder,
            minSpending: Number(currentTier.minSpending),
            pointsMultiplier: Number(currentTier.pointsMultiplier),
            themeConfig: currentTier.themeConfig,
          }
        : null,
      nextTier: nextTier
        ? {
            name: nextTier.name,
            slug: nextTier.slug,
            minSpending: Number(nextTier.minSpending),
          }
        : null,
    };
  }

  // ═══════════════════════════════════════════════════
  // Timeline API: Personal bills + Referral earnings
  // ═══════════════════════════════════════════════════

  /** Interface cho từng item trong timeline */
  private formatVND(amount: number | bigint): string {
    return new Intl.NumberFormat('vi-VN').format(Number(amount)) + 'đ';
  }

  /**
   * GET /api/v1/members/me/timeline
   * Trả về timeline xen kẽ: bill cá nhân + hoa hồng referral, sort theo date DESC
   */
  async getTimeline(memberId: string, page: number = 1, limit: number = 20) {
    // ─── Chạy 2 query song song ───
    const [transactions, referralEarnings] = await Promise.all([
      // Query 1: Bill cá nhân (approved / auto_approved)
      this.prisma.transaction.findMany({
        where: {
          memberId,
          status: { in: ['approved', 'auto_approved'] },
        },
        select: {
          id: true,
          posBillCode: true,
          finalAmount: true,
          amount: true,
          createdAt: true,
          branch: {
            select: {
              address: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Query 2: Hoa hồng giới thiệu (referral earnings)
      this.prisma.referralEarning.findMany({
        where: {
          referrerId: memberId,
        },
        select: {
          id: true,
          earnAmount: true,
          pointsAwarded: true,
          billAmount: true,
          createdAt: true,
          referee: {
            select: {
              zaloName: true,
              fullName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ─── Map thành timeline items ───
    type TimelineItem = {
      type: 'personal_bill' | 'referral_bonus';
      id: string;
      title: string;
      amount?: number;
      points?: number;
      date: string;
    };

    const billItems: TimelineItem[] = transactions.map((tx) => ({
      type: 'personal_bill' as const,
      id: tx.id,
      title: `Bill ${this.formatVND(tx.finalAmount)} - ${tx.branch?.address || 'Chi nhánh'}`,
      amount: Number(tx.finalAmount),
      date: tx.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const referralItems: TimelineItem[] = referralEarnings.map((earning) => {
      const refereeName =
        earning.referee?.zaloName ||
        earning.referee?.fullName ||
        earning.referee?.phone ||
        'Bạn bè';

      return {
        type: 'referral_bonus' as const,
        id: earning.id,
        title: `${refereeName} ăn ${this.formatVND(earning.billAmount)}, bạn +${this.formatVND(earning.earnAmount)}`,
        points: earning.pointsAwarded,
        date: earning.createdAt?.toISOString() || new Date().toISOString(),
      };
    });

    // ─── Merge + Sort (mới nhất trước) ───
    const merged = [...billItems, ...referralItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // ─── Pagination ───
    const total = merged.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = merged.slice(offset, offset + limit);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
