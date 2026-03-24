import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CukcukWebhookDto } from './dto/cukcuk-webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xử lý webhook từ CUKCUK POS
   * Toàn bộ logic nằm trong 1 prisma.$transaction atomic
   */
  async handleCukcukWebhook(dto: CukcukWebhookDto) {
    const { branch_id: cukcukBranchId, customer_phone, invoice } = dto;

    // ─── 0. Tìm Branch ───
    const branch = await this.prisma.branch.findFirst({
      where: { cukcukBranchId },
    });

    if (!branch) {
      this.logger.warn(`Branch không tồn tại: cukcuk_branch_id=${cukcukBranchId}`);
      return {
        success: true,
        message: 'Branch không tồn tại, đã bỏ qua.',
        transactionId: null,
      };
    }

    // ─── 1. Kiểm tra bill trùng (idempotent) ───
    const existingTx = await this.prisma.transaction.findUnique({
      where: { posBillId: invoice.id },
    });

    if (existingTx) {
      this.logger.log(`Bill đã tồn tại: posBillId=${invoice.id}, skip.`);
      return {
        success: true,
        message: 'Bill đã được xử lý trước đó.',
        transactionId: existingTx.id,
      };
    }

    // ─── 2. Tìm Member bằng SĐT ───
    let member = customer_phone
      ? await this.prisma.member.findFirst({
          where: { phone: customer_phone },
        })
      : null;

    // Chuẩn bị amount dạng BigInt
    const billAmount = BigInt(invoice.total_amount);
    const discountAmount = BigInt(invoice.discount_amount ?? 0);
    const finalAmount = invoice.final_amount
      ? BigInt(invoice.final_amount)
      : billAmount - discountAmount;

    // Kiểm tra first visit
    let isFirstVisit = false;
    if (member) {
      const previousTxCount = await this.prisma.transaction.count({
        where: {
          memberId: member.id,
          status: { in: ['approved', 'auto_approved'] },
        },
      });
      isFirstVisit = previousTxCount === 0;
    }

    // ═══ Tất cả ghi DB trong 1 prisma.$transaction ═══
    const result = await this.prisma.$transaction(async (tx) => {
      // ─── 3. Tạo Transaction ───
      const newTx = await tx.transaction.create({
        data: {
          memberId: member?.id || null,
          branchId: branch.id,
          posBillId: invoice.id,
          posBillCode: invoice.code || null,
          amount: billAmount,
          discountApplied: discountAmount,
          finalAmount: finalAmount,
          itemsSummary: invoice.items
            ? (invoice.items as any)
            : undefined,
          source: 'webhook_auto',
          status: member ? 'auto_approved' : 'pending_review', // Bill mồ côi → pending
          isFirstVisit,
          billCreatedAt: invoice.created_at
            ? new Date(invoice.created_at)
            : null,
          webhookReceivedAt: new Date(),
        },
      });

      this.logger.log(
        `[Webhook] Created transaction: ${newTx.id} | member=${member?.phone || 'NULL'} | ${finalAmount}đ`,
      );

      // Nếu không tìm được member → bill mồ côi, return sớm
      if (!member) {
        this.logger.log(`[Webhook] Bill mồ côi (no member): posBillId=${invoice.id}`);
        return {
          transaction: newTx,
          tierPromotion: null,
          referralResult: null,
        };
      }

      // ─── 4. Cộng doanh số cho member ───
      await tx.member.update({
        where: { id: member.id },
        data: {
          lifetimeSpending: { increment: finalAmount },
          monthlySpending: { increment: finalAmount },
          lastActiveAt: new Date(),
        },
      });

      this.logger.log(
        `[Webhook] Member ${member.phone}: +${finalAmount} spending`,
      );

      // ─── 5. Kiểm tra & Thăng hạng thẻ (Tier Promotion) ───
      const tierPromotion = await this.checkAndUpgradeTier(tx, member.id, member.phone || '');

      // ─── 6. Referral Engine (5% hoa hồng) — chỉ bill >= 100k ───
      const MIN_BILL_FOR_REFERRAL = BigInt(100_000); // 100k VND
      let referralResult: { referrerId: string; earnAmount: number; pointsAwarded: number } | null = null;

      if (member.referredById) {
        if (finalAmount < MIN_BILL_FOR_REFERRAL) {
          this.logger.log(
            `[Referral] Bill ${finalAmount}đ < ${MIN_BILL_FOR_REFERRAL}đ, skip referral (keep pending)`,
          );
        } else {
          // Activate referral + tính hoa hồng chỉ khi bill >= 100k
          await this.activateReferralIfPending(tx, member.referredById, member.id);
          referralResult = await this.processReferralEngine(
            tx,
            member,
            newTx.id,
            finalAmount,
            invoice.code || invoice.id.slice(0, 8),
          );
        }
      }

      // TODO: sendZNS cho Referrer (báo nảy điểm)
      // Payload: "Bạn nhận được {points} điểm hoa hồng từ {refereeName}"

      // TODO: sendZNS cho Referee/Member (báo nhận bill)
      // Payload: "Bill {billCode} đã được ghi nhận: {finalAmount}đ"

      return {
        transaction: newTx,
        tierPromotion,
        referralResult,
      };
    });

    return {
      success: true,
      message: member
        ? `Đã ghi nhận bill ${invoice.code || invoice.id} cho ${member.phone}`
        : `Bill mồ côi (SĐT ${customer_phone} chưa đăng ký), đã lưu pending.`,
      transactionId: result.transaction.id,
      tierPromotion: result.tierPromotion,
      referral: result.referralResult,
    };
  }

  // ═══════════════════════════════════════════════════
  // PRIVATE: Tier Promotion
  // ═══════════════════════════════════════════════════

  private async checkAndUpgradeTier(
    tx: any,
    memberId: string,
    memberPhone: string,
  ) {
    // Lấy spending mới nhất
    const updatedMember = await tx.member.findUnique({
      where: { id: memberId },
      select: { lifetimeSpending: true },
    });
    const newSpending = updatedMember?.lifetimeSpending ?? BigInt(0);

    // Hạng hiện tại từ tier_histories
    const latestTierHistory = await tx.tierHistory.findFirst({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: { toTierId: true },
    });
    const currentTierId = latestTierHistory?.toTierId ?? null;

    // Tất cả tiers active, sắp xếp giảm dần
    const allTiers = await tx.tier.findMany({
      where: { isActive: true },
      orderBy: { minSpending: 'desc' },
    });

    // Tìm hạng cao nhất đạt được
    const targetTier = allTiers.find(
      (t: any) => newSpending >= t.minSpending,
    ) || null;

    if (!targetTier || targetTier.id === currentTierId) {
      return null; // Không thay đổi hạng
    }

    // Lấy tên hạng cũ
    let fromTierName: string | null = null;
    if (currentTierId) {
      const fromTier = allTiers.find((t: any) => t.id === currentTierId);
      fromTierName = fromTier?.name ?? null;
    }

    // Insert tier_histories
    await tx.tierHistory.create({
      data: {
        memberId,
        fromTierId: currentTierId,
        toTierId: targetTier.id,
        reason: 'spending_milestone',
        spendingAtChange: newSpending,
      },
    });

    this.logger.log(
      `[TierPromotion] Member ${memberPhone}: ${fromTierName ?? 'Chưa xếp hạng'} → ${targetTier.name}`,
    );

    // TODO: Gửi ZNS thông báo thăng hạng
    // Payload: "Chúc mừng lên hạng ${targetTier.name}! Tích điểm x${targetTier.pointsMultiplier}"

    return {
      fromTierName,
      toTierName: targetTier.name,
      pointsMultiplier: Number(targetTier.pointsMultiplier),
    };
  }

  // ═══════════════════════════════════════════════════
  // PRIVATE: Activate referral (pending → active)
  // ═══════════════════════════════════════════════════

  private async activateReferralIfPending(tx: any, referrerId: string, refereeId: string) {
    const referral = await tx.referral.findFirst({
      where: { referrerId, refereeId },
    });

    if (referral && referral.status === 'pending') {
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'active',
          activatedAt: new Date(),
        },
      });
      this.logger.log(
        `[Referral] Activated referral ${referral.id} (${referrerId} → ${refereeId})`,
      );
    }
  }

  // ═══════════════════════════════════════════════════
  // PRIVATE: Referral Engine (5% ngang hàng)
  // ═══════════════════════════════════════════════════

  private async processReferralEngine(
    tx: any,
    member: { id: string; referredById: string | null; fullName: string | null; zaloName: string | null; phone: string | null },
    transactionId: string,
    billAmount: bigint,
    billCodeDisplay: string,
  ) {
    if (!member.referredById) return null;

    const referrerId = member.referredById;

    // Tìm bản ghi referral
    const referral = await tx.referral.findFirst({
      where: {
        referrerId,
        refereeId: member.id,
      },
    });

    if (!referral) return null;

    // Tính 5%
    const REFERRAL_PERCENT = 5;
    const earnAmount = (billAmount * BigInt(REFERRAL_PERCENT)) / BigInt(100);
    const pointsAwarded = Number(earnAmount / BigInt(1000)); // 1000đ = 1 điểm

    if (pointsAwarded <= 0) return null;

    // Cập nhật points cho referrer
    const updatedReferrer = await tx.member.update({
      where: { id: referrerId },
      data: {
        pointsBalance: { increment: pointsAwarded },
        pointsEarned: { increment: pointsAwarded },
      },
    });

    // Cập nhật referral record
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        totalBills: { increment: 1 },
        totalBillAmount: { increment: billAmount },
        totalEarned: { increment: earnAmount },
      },
    });

    // Tạo referral_earnings (lịch sử hoa hồng)
    await tx.referralEarning.create({
      data: {
        referralId: referral.id,
        referrerId,
        refereeId: member.id,
        transactionId,
        billAmount,
        earnPercent: REFERRAL_PERCENT,
        earnAmount,
        pointsAwarded,
      },
    });

    // Tạo point_transactions cho referrer
    const memberDisplayName =
      member.fullName || member.zaloName || member.phone || 'Khách';

    await tx.pointTransaction.create({
      data: {
        memberId: referrerId,
        type: 'referral_earning',
        points: pointsAwarded,
        balanceAfter: updatedReferrer.pointsBalance ?? pointsAwarded,
        referenceType: 'referral_earning',
        referenceId: referral.id,
        note: `Hoa hồng 5% bill ${billCodeDisplay} từ ${memberDisplayName}`,
      },
    });

    this.logger.log(
      `[Referral] Referrer ${referrerId}: +${pointsAwarded} pts (5% of ${billAmount} = ${earnAmount}đ)`,
    );

    // TODO: sendZNS cho Referrer → "Bạn nhận được {pointsAwarded} điểm từ {memberDisplayName}"

    return {
      referrerId,
      earnAmount: Number(earnAmount),
      pointsAwarded,
    };
  }
}
