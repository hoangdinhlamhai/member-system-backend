import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustPointsDto } from '../dto/config.dto';
import { CreateMemberDto, UpdateMemberDto } from '../dto/member.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class AdminMembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: string, page = 1, perPage = 20) {
    const where = query
      ? {
          OR: [
            { phone: { contains: query } },
            { zaloName: { contains: query, mode: 'insensitive' as const } },
            { fullName: { contains: query, mode: 'insensitive' as const } },
            { referralCode: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        take: perPage,
        skip: (page - 1) * perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          referralsMade: { select: { id: true } },
          tierHistories: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { toTier: { select: { name: true, slug: true } } },
          },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return { data, total, page, perPage, totalPages: Math.ceil(total / perPage) };
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, zaloName: true, phone: true, referralCode: true } },
        referralsMade: {
          include: {
            referee: { select: { id: true, zaloName: true, phone: true, fullName: true, lifetimeSpending: true } },
          },
        },
        tierHistories: {
          include: { fromTier: true, toTier: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { branch: { select: { address: true } } },
        },
        pointTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async create(dto: CreateMemberDto) {
    // Check duplicate phone
    const existing = await this.prisma.member.findFirst({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException(`SĐT ${dto.phone} đã tồn tại`);

    const referralCode = `ZDC-${nanoid(6).toUpperCase()}`;

    // Find referrer if code provided
    let referrerId: string | undefined;
    if (dto.referrerCode) {
      const referrer = await this.prisma.member.findUnique({
        where: { referralCode: dto.referrerCode },
      });
      if (!referrer) throw new BadRequestException(`Mã giới thiệu "${dto.referrerCode}" không tồn tại`);
      referrerId = referrer.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          phone: dto.phone,
          zaloId: `admin_${dto.phone}`,
          qrCode: `https://zalo.me/qr/${dto.phone}`,
          zaloName: dto.zaloName || null,
          fullName: dto.fullName || null,
          referralCode,

        },
      });

      // Create referral relationship if referrer exists
      if (referrerId) {
        await tx.referral.create({
          data: {
            referrerId,
            refereeId: member.id,
            status: 'active',
          },
        });
      }

      // Assign default tier (lowest)
      const defaultTier = await tx.tier.findFirst({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      });
      if (defaultTier) {
        await tx.tierHistory.create({
          data: {
            memberId: member.id,
            toTierId: defaultTier.id,
            reason: 'Đăng ký mới từ admin',
          },
        });
      }

      return member;
    });
  }

  async update(id: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    // Check duplicate phone if changed
    if (dto.phone && dto.phone !== member.phone) {
      const dup = await this.prisma.member.findFirst({ where: { phone: dto.phone } });
      if (dup) throw new ConflictException(`SĐT ${dto.phone} đã tồn tại`);
    }

    const data: Record<string, unknown> = {};
    if (dto.zaloName !== undefined) data.zaloName = dto.zaloName;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;

    return this.prisma.member.update({ where: { id }, data });
  }

  async remove(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    // Check if member has transactions
    const txCount = await this.prisma.transaction.count({ where: { memberId: id } });
    if (txCount > 0) {
      throw new BadRequestException(
        `Không thể xóa thành viên đã có ${txCount} giao dịch. Hãy liên hệ dev nếu cần xóa dữ liệu.`,
      );
    }

    // Cascade delete related records without transactions
    await this.prisma.$transaction(async (tx) => {
      await tx.pointTransaction.deleteMany({ where: { memberId: id } });
      await tx.tierHistory.deleteMany({ where: { memberId: id } });
      await tx.referral.deleteMany({ where: { OR: [{ referrerId: id }, { refereeId: id }] } });
      await tx.member.delete({ where: { id } });
    });

    return { deleted: true };
  }

  async adjustPoints(memberId: string, dto: AdjustPointsDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const isAdd = dto.type === 'admin_add';
    const pointsDelta = isAdd ? Math.abs(dto.points) : -Math.abs(dto.points);
    const newBalance = (member.pointsBalance ?? 0) + pointsDelta;

    if (newBalance < 0) {
      throw new BadRequestException('Không đủ điểm để trừ');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { id: memberId },
        data: {
          pointsBalance: newBalance,
          ...(isAdd
            ? { pointsEarned: { increment: pointsDelta } }
            : { pointsSpent: { increment: Math.abs(pointsDelta) } }),
        },
      });

      await tx.pointTransaction.create({
        data: {
          memberId,
          type: dto.type,
          points: pointsDelta,
          balanceAfter: newBalance,
          note: dto.note || (isAdd ? 'Admin cộng điểm' : 'Admin trừ điểm'),
        },
      });

      return updated;
    });
  }

  async getOverviewStats() {
    const [totalMembers, newThisMonth, totalTransactions, revenue, pendingBills, activeReferrals] =
      await Promise.all([
        this.prisma.member.count(),
        this.prisma.member.count({
          where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        }),
        this.prisma.transaction.count({ where: { status: { in: ['approved', 'auto_approved'] } } }),
        this.prisma.transaction.aggregate({
          _sum: { finalAmount: true },
          where: { status: { in: ['approved', 'auto_approved'] } },
        }),
        this.prisma.transaction.count({ where: { status: 'pending_review' } }),
        this.prisma.referral.count({ where: { status: 'active' } }),
      ]);

    return {
      totalMembers,
      newThisMonth,
      totalTransactions,
      totalRevenue: (revenue._sum.finalAmount ?? BigInt(0)).toString(),
      pendingBills,
      activeReferrals,
    };
  }
}
