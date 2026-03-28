import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';
import { RedeemType } from './dto/redeem.dto';

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
    const qrCode = `QR-${nanoid(8).toUpperCase()}`;
    const referralCode = `ZDC-${nanoid(6).toUpperCase()}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
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

        // Assign default tier (lowest displayOrder)
        const defaultTier = await tx.tier.findFirst({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        });
        if (defaultTier) {
          await tx.tierHistory.create({
            data: {
              memberId: member.id,
              toTierId: defaultTier.id,
              reason: 'Đăng ký mới',
            },
          });
        }

        return member;
      });
    } catch (error) {
      this.logger.error(`Error creating member: ${error.message}`);
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
      return await this.prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: {
            zaloId: `phone_${data.phone}`,
            phone: data.phone,
            qrCode,
            referralCode,
            status: 'verified',
            pointsBalance: 0,
            pointsEarned: 0,
            pointsSpent: 0,
          },
        });

        // Assign default tier (lowest displayOrder)
        const defaultTier = await tx.tier.findFirst({
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
        });
        if (defaultTier) {
          await tx.tierHistory.create({
            data: {
              memberId: member.id,
              toTierId: defaultTier.id,
              reason: 'Đăng ký mới',
            },
          });
        }

        return member;
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

    // Đếm transaction approved + auto_approved trong tháng
    const monthlyTxs = await this.prisma.transaction.findMany({
      where: {
        memberId,
        status: { in: ['approved', 'auto_approved'] },
        createdAt: { gte: startOfMonth },
      },
      select: { finalAmount: true },
    });

    const monthlyVisits = monthlyTxs.length;
    const monthlySelfSales = monthlyTxs.reduce(
      (sum, tx) => sum + Number(tx.finalAmount),
      0,
    );

    // Tổng lượt ghé (all-time)
    const totalVisits = await this.prisma.transaction.count({
      where: {
        memberId,
        status: { in: ['approved', 'auto_approved'] },
      },
    });

    // Hoa hồng referral tháng này (tiền nhận từ F1)
    const monthlyReferralEarnings = await this.prisma.referralEarning.findMany({
      where: {
        referrerId: memberId,
        createdAt: { gte: startOfMonth },
      },
      select: { billAmount: true },
    });

    // monthlyReferralSales = tổng bill F1, KHÔNG phải earnAmount
    const monthlyReferralSales = monthlyReferralEarnings.reduce(
      (sum, e) => sum + Number(e.billAmount),
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
        totalVisits,
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

  // ═══════════════════════════════════════════════════
  // Rewards & Discount Tiers (public) + Vouchers (auth)
  // ═══════════════════════════════════════════════════

  async getRewardsCatalog() {
    const rewards = await this.prisma.rewardCatalog.findMany({
      where: { isActive: true },
      orderBy: { pointsRequired: 'asc' },
    });

    return rewards.map((r) => ({
      id: r.id,
      brandId: r.brandId,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl || '🎁',
      type: r.type,
      pointsRequired: r.pointsRequired,
      quantityLimit: r.quantityLimit,
      quantityRedeemed: r.quantityRedeemed ?? 0,
      perMemberLimit: r.perMemberLimit,
      isActive: r.isActive ?? true,
      validFrom: r.validFrom?.toISOString() || null,
      validUntil: r.validUntil?.toISOString() || null,
    }));
  }

  async getDiscountTiers() {
    const tiers = await this.prisma.discountTier.findMany({
      where: { isActive: true },
      orderBy: { pointsRequired: 'asc' },
    });

    return tiers.map((d) => ({
      id: d.id,
      pointsRequired: d.pointsRequired,
      discountPercent: Number(d.discountPercent),
      maxDiscountAmount: Number(d.maxDiscountAmount ?? 0),
      description: `Giảm ${Number(d.discountPercent)}% cho hóa đơn`,
    }));
  }

  async getMyVouchers(memberId: string) {
    const redemptions = await this.prisma.redemption.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      include: {
        reward: { select: { name: true, description: true, imageUrl: true } },
        discountTier: { select: { discountPercent: true, maxDiscountAmount: true } },
      },
    });

    return redemptions.map((r) => {
      const isDiscount = r.type === 'discount';
      const now = new Date();
      let status: 'active' | 'used' | 'expired' = 'active';
      if (r.redeemedAt) status = 'used';
      else if (new Date(r.expiresAt) < now) status = 'expired';

      return {
        id: r.id,
        memberId: r.memberId,
        type: r.type as 'reward' | 'discount',
        rewardId: r.rewardId,
        discountTierId: r.discountTierId,
        title: isDiscount
          ? `Giảm ${Number(r.discountPercent)}% Tổng Bill`
          : r.reward?.name || 'Quà tặng',
        description: isDiscount
          ? `Giảm tối đa ${Number(r.discountTier?.maxDiscountAmount ?? 0) / 1000}K`
          : r.reward?.description || '',
        imageUrl: r.reward?.imageUrl || undefined,
        voucherCode: r.voucherCode || '',
        qrData: `ZDC:VOUCHER:${r.voucherCode}`,
        status,
        expiresAt: r.expiresAt.toISOString(),
        redeemedAt: r.redeemedAt?.toISOString(),
        createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
      };
    });
  }

  // ═══════════════════════════════════════════════════
  // Redeem: Đổi quà / Giảm giá bằng điểm
  // ═══════════════════════════════════════════════════

  async redeemItem(memberId: string, type: RedeemType, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lấy member + lock row (serializable trong $transaction)
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new NotFoundException('MEMBER_NOT_FOUND');

      const balance = member.pointsBalance ?? 0;
      let pointsRequired = 0;
      let rewardId: string | null = null;
      let discountTierId: string | null = null;
      let discountPercent: number | null = null;
      let rewardName = '';

      if (type === RedeemType.REWARD) {
        // ─── Reward validation ───
        const reward = await tx.rewardCatalog.findUnique({ where: { id: itemId } });
        if (!reward || !reward.isActive) {
          throw new NotFoundException('REWARD_NOT_FOUND');
        }

        // Check quantity limit
        if (reward.quantityLimit !== null) {
          const redeemed = reward.quantityRedeemed ?? 0;
          if (redeemed >= reward.quantityLimit) {
            throw new BadRequestException('REWARD_OUT_OF_STOCK');
          }
        }

        // Check per-member limit
        if (reward.perMemberLimit !== null) {
          const memberRedemptionCount = await tx.redemption.count({
            where: { memberId, rewardId: itemId },
          });
          if (memberRedemptionCount >= (reward.perMemberLimit ?? 1)) {
            throw new BadRequestException('REWARD_LIMIT_REACHED');
          }
        }

        // Check validity period
        const now = new Date();
        if (reward.validFrom && now < new Date(reward.validFrom)) {
          throw new BadRequestException('REWARD_NOT_STARTED');
        }
        if (reward.validUntil && now > new Date(reward.validUntil)) {
          throw new BadRequestException('REWARD_EXPIRED');
        }

        pointsRequired = reward.pointsRequired;
        rewardId = reward.id;
        rewardName = reward.name;

      } else {
        // ─── Discount validation ───
        const discount = await tx.discountTier.findUnique({ where: { id: itemId } });
        if (!discount || !discount.isActive) {
          throw new NotFoundException('DISCOUNT_TIER_NOT_FOUND');
        }

        pointsRequired = discount.pointsRequired;
        discountTierId = discount.id;
        discountPercent = Number(discount.discountPercent);
        rewardName = `Giảm ${discountPercent}% Tổng Bill`;
      }

      // 2. Check đủ điểm
      if (balance < pointsRequired) {
        throw new BadRequestException('INSUFFICIENT_POINTS');
      }

      // 3. Generate voucher code
      const voucherCode = `ZDC-V-${nanoid(8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Hết hạn sau 30 ngày

      // 4. Tạo Redemption
      const redemption = await tx.redemption.create({
        data: {
          memberId,
          type,
          rewardId,
          discountTierId,
          discountPercent: discountPercent !== null ? discountPercent : undefined,
          voucherCode,
          expiresAt,
        },
      });

      // 5. Tạo PointTransaction (ghi log trừ điểm)
      const newBalance = balance - pointsRequired;
      await tx.pointTransaction.create({
        data: {
          memberId,
          type: 'spend',
          points: -pointsRequired,
          balanceAfter: newBalance,
          referenceType: 'redemption',
          referenceId: redemption.id,
          note: `Đổi ${type === 'reward' ? 'quà' : 'giảm giá'}: ${rewardName}`,
        },
      });

      // 6. Update member points
      await tx.member.update({
        where: { id: memberId },
        data: {
          pointsBalance: newBalance,
          pointsSpent: (member.pointsSpent ?? 0) + pointsRequired,
          updatedAt: new Date(),
        },
      });

      // 7. Nếu là reward → tăng quantityRedeemed
      if (type === RedeemType.REWARD && rewardId) {
        await tx.rewardCatalog.update({
          where: { id: rewardId },
          data: { quantityRedeemed: { increment: 1 } },
        });
      }

      // 8. Trả về voucher (match ZMA's Voucher interface)
      return {
        id: redemption.id,
        memberId,
        type: type as 'reward' | 'discount',
        rewardId,
        discountTierId,
        title: rewardName,
        description: type === RedeemType.DISCOUNT
          ? `Giảm tối đa ${discountPercent ? Math.round(discountPercent) : 0}K` // sẽ format chuẩn hơn nếu cần
          : '',
        voucherCode,
        qrData: `ZDC:VOUCHER:${voucherCode}`,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        pointsSpent: pointsRequired,
        newBalance,
      };
    });
  }
}

