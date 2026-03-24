import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManualBillDto } from './dto/create-manual-bill.dto';
import type { CurrentStaffPayload } from '../auth/decorators/current-staff.decorator';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly MANAGER_ROLES = ['store_manager', 'manager'];

  private isManager(role: string): boolean {
    return this.MANAGER_ROLES.includes(role);
  }

  /**
   * Lấy danh sách bill chờ duyệt (cho Manager).
   * Chỉ lấy bill cùng branchId với manager.
   */
  async getPendingBills(staff: CurrentStaffPayload) {
    if (!this.isManager(staff.role)) {
      throw new ForbiddenException('Chỉ quản lý mới được xem danh sách bill chờ duyệt.');
    }

    const bills = await this.prisma.transaction.findMany({
      where: {
        status: 'pending_review',
        // TODO: Filter theo branch nếu cần phân quyền multi-branch
      },
      include: {
        member: {
          select: {
            id: true,
            phone: true,
            zaloName: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lấy staff names cho từng bill
    const staffIds = [...new Set(bills.map((b) => b.staffId).filter(Boolean))] as string[];
    const staffList = staffIds.length > 0
      ? await this.prisma.staff.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const staffMap = new Map(staffList.map((s) => [s.id, s.fullName]));

    return bills.map((bill) => ({
      id: bill.id,
      posBillCode: bill.posBillCode,
      amount: bill.amount,
      finalAmount: bill.finalAmount,
      source: bill.source,
      status: bill.status,
      billImageUrl: bill.billImageUrl,
      staffId: bill.staffId,
      staffName: bill.staffId ? (staffMap.get(bill.staffId) || 'N/A') : 'N/A',
      memberId: bill.memberId,
      memberName: bill.member?.fullName || bill.member?.zaloName || 'Khách',
      memberPhone: bill.member?.phone || '',
      branchId: bill.branchId,
      createdAt: bill.createdAt,
    }));
  }

  /**
   * Phê duyệt bill (Manager only).
   *
   * Logic:
   * 1. Update transaction status → approved
   * 2. Cộng amount vào lifetime_spending, monthly_spending của member
   * 3. Referral Engine: nếu member có referrer → chia hoa hồng 5%
   *    - Activate referral nếu đang pending
   *    - Tạo referral_earnings record
   *    - Tạo point_transactions cho referrer
   *    - Cộng points cho referrer
   * 4. TODO: Gửi ZNS notification
   */
  async approveBill(transactionId: string, staff: CurrentStaffPayload) {
    if (!this.isManager(staff.role)) {
      throw new ForbiddenException('Chỉ quản lý mới được phê duyệt bill.');
    }

    // Lấy transaction + member info
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        member: {
          select: {
            id: true,
            phone: true,
            zaloName: true,
            fullName: true,
            referredById: true,
            pointsBalance: true,
            pointsEarned: true,
            lifetimeSpending: true,
            monthlySpending: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với ID: ${transactionId}`);
    }

    if (transaction.status !== 'pending_review') {
      throw new BadRequestException(
        `Giao dịch ${transaction.posBillCode} đã được xử lý (${transaction.status}).`,
      );
    }

    if (!transaction.member) {
      throw new BadRequestException('Giao dịch không có thông tin khách hàng.');
    }

    const member = transaction.member;
    const billAmount = transaction.amount; // BigInt

    // ═══ Thực hiện tất cả trong 1 Prisma Transaction (atomic) ═══
    const result = await this.prisma.$transaction(async (tx) => {
      // ─── 1. Cập nhật transaction status → approved ───
      const updatedTx = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'approved',
          reviewedBy: staff.id,
          reviewedAt: new Date(),
        },
      });

      // ─── 2. Cập nhật doanh số cá nhân (member) ───
      await tx.member.update({
        where: { id: member.id },
        data: {
          lifetimeSpending: { increment: billAmount },
          monthlySpending: { increment: billAmount },
          lastActiveAt: new Date(),
        },
      });

      this.logger.log(
        `[Approve] Member ${member.phone}: +${billAmount} spending`,
      );

      // ─── 2b. Kiểm tra & Thăng hạng thẻ (Tier Promotion) ───
      let tierPromotion: {
        fromTierId: string | null;
        fromTierName: string | null;
        toTierId: string;
        toTierName: string;
        pointsMultiplier: number;
      } | null = null;

      // Lấy lifetime_spending mới nhất sau khi đã cộng
      const updatedMember = await tx.member.findUnique({
        where: { id: member.id },
        select: { lifetimeSpending: true },
      });
      const newSpending = updatedMember?.lifetimeSpending ?? BigInt(0);

      // Lấy hạng hiện tại từ tier_histories (record mới nhất)
      const latestTierHistory = await tx.tierHistory.findFirst({
        where: { memberId: member.id },
        orderBy: { createdAt: 'desc' },
        select: { toTierId: true },
      });
      const currentTierId = latestTierHistory?.toTierId ?? null;

      // Lấy tất cả tiers active, sắp xếp min_spending giảm dần
      const allTiers = await tx.tier.findMany({
        where: { isActive: true },
        orderBy: { minSpending: 'desc' },
      });

      // Tìm hạng cao nhất mà member đạt được: tier đầu tiên có minSpending <= newSpending
      const targetTier = allTiers.find((t) => newSpending >= t.minSpending) || null;

      // So sánh: nếu hạng mục tiêu khác hạng hiện tại → thăng hạng
      if (targetTier && targetTier.id !== currentTierId) {
        // Lấy tên hạng cũ (nếu có)
        let fromTierName: string | null = null;
        if (currentTierId) {
          const fromTier = allTiers.find((t) => t.id === currentTierId);
          fromTierName = fromTier?.name ?? null;
        }

        // Insert tier_histories
        await tx.tierHistory.create({
          data: {
            memberId: member.id,
            fromTierId: currentTierId,
            toTierId: targetTier.id,
            reason: 'spending_milestone',
            spendingAtChange: newSpending,
          },
        });

        tierPromotion = {
          fromTierId: currentTierId,
          fromTierName,
          toTierId: targetTier.id,
          toTierName: targetTier.name,
          pointsMultiplier: Number(targetTier.pointsMultiplier),
        };

        this.logger.log(
          `[TierPromotion] Member ${member.phone}: ${fromTierName ?? 'Chưa có hạng'} → ${targetTier.name} (spending: ${newSpending})`,
        );

        // TODO: Gửi ZNS thông báo thăng hạng
        // Payload tham khảo: "Chúc mừng lên hạng [Tên hạng mới]! Tích điểm x[points_multiplier]"
        // Ví dụ: "Chúc mừng lên hạng Bạc! Tích điểm x1.2"
      }

      // ─── 3. Referral Engine (5% ngang hàng) — chỉ bill >= 100k ───
      const MIN_BILL_FOR_REFERRAL = BigInt(100_000); // 100k VND
      let referralResult: {
        referrerId: string;
        earnAmount: bigint;
        pointsAwarded: number;
      } | null = null;

      if (member.referredById) {
        const referrerId = member.referredById;

        // Tìm bản ghi referral giữa referrer và member (referee)
        const referral = await tx.referral.findFirst({
          where: {
            referrerId: referrerId,
            refereeId: member.id,
          },
        });

        if (referral) {
          // Chỉ activate + tính hoa hồng khi bill >= 100k
          if (billAmount < MIN_BILL_FOR_REFERRAL) {
            this.logger.log(
              `[Referral] Bill ${billAmount}đ < ${MIN_BILL_FOR_REFERRAL}đ, skip referral (keep pending)`,
            );
          } else {
            // 3a. Activate referral nếu đang pending
            if (referral.status === 'pending') {
              await tx.referral.update({
                where: { id: referral.id },
                data: {
                  status: 'active',
                  activatedAt: new Date(),
                },
              });
              this.logger.log(
                `[Referral] Activated referral ${referral.id} (${referrerId} → ${member.id})`,
              );
            }

            // 3b. Tính toán 5%
            const REFERRAL_PERCENT = 5;
            const earnAmount = (billAmount * BigInt(REFERRAL_PERCENT)) / BigInt(100);
            const pointsAwarded = Number(earnAmount / BigInt(1000)); // 1000đ = 1 điểm

            if (pointsAwarded > 0) {
              // 3c. Cập nhật points cho người giới thiệu (referrer)
              const updatedReferrer = await tx.member.update({
                where: { id: referrerId },
                data: {
                  pointsBalance: { increment: pointsAwarded },
                  pointsEarned: { increment: pointsAwarded },
                },
              });

              // 3d. Cập nhật referral record
              await tx.referral.update({
                where: { id: referral.id },
                data: {
                  totalBills: { increment: 1 },
                  totalBillAmount: { increment: billAmount },
                  totalEarned: { increment: earnAmount },
                },
              });

              // 3e. Tạo referral_earnings record
              await tx.referralEarning.create({
                data: {
                  referralId: referral.id,
                  referrerId: referrerId,
                  refereeId: member.id,
                  transactionId: transactionId,
                  billAmount: billAmount,
                  earnPercent: REFERRAL_PERCENT,
                  earnAmount: earnAmount,
                  pointsAwarded: pointsAwarded,
                },
              });

              // 3f. Tạo point_transactions cho referrer
              const memberDisplayName =
                member.fullName || member.zaloName || member.phone || 'Khách';
              const billCodeDisplay = transaction.posBillCode || transactionId.slice(0, 8);

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

              referralResult = {
                referrerId,
                earnAmount,
                pointsAwarded,
              };

              this.logger.log(
                `[Referral] Referrer ${referrerId}: +${pointsAwarded} points (5% of ${billAmount} = ${earnAmount}đ)`,
              );
            }
          }
        }
      }

      // TODO: Gửi ZNS cho referrer thông báo nhận hoa hồng
      // TODO: Gửi ZNS cho referee (member) thông báo bill đã được duyệt

      return { updatedTx, referralResult, tierPromotion };
    });

    this.logger.log(
      `Manager ${staff.fullName} approved bill ${result.updatedTx.posBillCode} (${result.updatedTx.id})`,
    );

    return {
      id: result.updatedTx.id,
      posBillCode: result.updatedTx.posBillCode,
      status: result.updatedTx.status,
      reviewedBy: result.updatedTx.reviewedBy,
      reviewedAt: result.updatedTx.reviewedAt,
      referral: result.referralResult
        ? {
            referrerId: result.referralResult.referrerId,
            earnAmount: result.referralResult.earnAmount,
            pointsAwarded: result.referralResult.pointsAwarded,
          }
        : null,
      tierPromotion: result.tierPromotion
        ? {
            fromTierName: result.tierPromotion.fromTierName,
            toTierName: result.tierPromotion.toTierName,
            pointsMultiplier: result.tierPromotion.pointsMultiplier,
          }
        : null,
    };
  }

  /**
   * Từ chối bill (Manager only).
   */
  async rejectBill(
    transactionId: string,
    rejectReason: string,
    staff: CurrentStaffPayload,
  ) {
    if (!this.isManager(staff.role)) {
      throw new ForbiddenException('Chỉ quản lý mới được từ chối bill.');
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, status: true, posBillCode: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Không tìm thấy giao dịch với ID: ${transactionId}`);
    }

    if (transaction.status !== 'pending_review') {
      throw new BadRequestException(
        `Giao dịch ${transaction.posBillCode} đã được xử lý (${transaction.status}).`,
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'rejected',
        rejectReason,
        reviewedBy: staff.id,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(
      `Manager ${staff.fullName} rejected bill ${updated.posBillCode}: ${rejectReason}`,
    );

    return {
      id: updated.id,
      posBillCode: updated.posBillCode,
      status: updated.status,
      rejectReason: updated.rejectReason,
      reviewedBy: updated.reviewedBy,
      reviewedAt: updated.reviewedAt,
    };
  }

  /**
   * Nhập bill thủ công bởi nhân viên.
   *
   * Flow:
   * 1. Kiểm tra member tồn tại
   * 2. Kiểm tra trùng pos_bill_code (tránh nhập 2 lần)
   * 3. Tạo transaction với status = pending_review
   */
  async createManualBill(dto: CreateManualBillDto, staff: CurrentStaffPayload) {
    // 0. Kiểm tra staff có branch
    if (!staff.branchId) {
      throw new BadRequestException(
        'Nhân viên chưa được gán chi nhánh. Liên hệ quản lý để cập nhật.',
      );
    }

    const branchId = staff.branchId;

    // 1. Kiểm tra member tồn tại
    const member = await this.prisma.member.findUnique({
      where: { id: dto.member_id },
      select: { id: true, phone: true, zaloName: true },
    });

    if (!member) {
      throw new NotFoundException(
        `Không tìm thấy khách hàng với ID: ${dto.member_id}`,
      );
    }

    // 2. Kiểm tra trùng pos_bill_code trong cùng branch (tránh nhập trùng)
    const existingBill = await this.prisma.transaction.findFirst({
      where: {
        posBillCode: dto.pos_bill_code,
        branchId: branchId,
      },
      select: { id: true },
    });

    if (existingBill) {
      throw new ConflictException(
        `Mã hóa đơn "${dto.pos_bill_code}" đã được nhập trước đó tại chi nhánh này.`,
      );
    }

    // 3. Tạo transaction
    try {
      const transaction = await this.prisma.transaction.create({
        data: {
          memberId: dto.member_id,
          branchId: branchId,
          posBillCode: dto.pos_bill_code,
          amount: BigInt(dto.amount),
          discountApplied: BigInt(0),
          finalAmount: BigInt(dto.amount),
          source: 'staff_manual',
          status: 'pending_review',
          billImageUrl: null,
          staffId: staff.id,
        },
      });

      this.logger.log(
        `Staff ${staff.fullName} (${staff.id}) tạo bill thủ công: ${transaction.id} | Member: ${member.phone} | Amount: ${dto.amount}`,
      );

      return {
        id: transaction.id,
        posBillCode: transaction.posBillCode,
        amount: transaction.amount,
        finalAmount: transaction.finalAmount,
        source: transaction.source,
        status: transaction.status,
        staffId: transaction.staffId,
        memberId: transaction.memberId,
        branchId: transaction.branchId,
        member: {
          id: member.id,
          phone: member.phone,
          zaloName: member.zaloName,
        },
        createdAt: transaction.createdAt,
      };
    } catch (error) {
      this.logger.error(
        `Lỗi tạo bill thủ công: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Đã xảy ra lỗi khi tạo hóa đơn. Vui lòng thử lại.',
      );
    }
  }
}

