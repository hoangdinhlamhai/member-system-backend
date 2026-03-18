import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRewardDto, UpdateRewardDto, CreateDiscountTierDto, UpdateDiscountTierDto } from '../dto/reward.dto';

@Injectable()
export class AdminRewardsService {
  constructor(private prisma: PrismaService) {}

  // ── Rewards Catalog ──

  async findAllRewards() {
    return this.prisma.rewardCatalog.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneReward(id: string) {
    const reward = await this.prisma.rewardCatalog.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException('Reward not found');
    return reward;
  }

  async createReward(dto: CreateRewardDto) {
    return this.prisma.rewardCatalog.create({
      data: {
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type,
        pointsRequired: dto.pointsRequired,
        quantityLimit: dto.quantityLimit,
        perMemberLimit: dto.perMemberLimit ?? 1,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    await this.findOneReward(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl;
    if (dto.pointsRequired !== undefined) data.pointsRequired = dto.pointsRequired;
    if (dto.quantityLimit !== undefined) data.quantityLimit = dto.quantityLimit;
    if (dto.perMemberLimit !== undefined) data.perMemberLimit = dto.perMemberLimit;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.validFrom !== undefined) data.validFrom = new Date(dto.validFrom);
    if (dto.validUntil !== undefined) data.validUntil = new Date(dto.validUntil);

    return this.prisma.rewardCatalog.update({ where: { id }, data });
  }

  async removeReward(id: string) {
    await this.findOneReward(id);
    const used = await this.prisma.redemption.count({ where: { rewardId: id } });
    if (used > 0) {
      throw new BadRequestException('Không thể xóa quà đã có người đổi. Hãy tắt isActive thay vì xóa.');
    }
    return this.prisma.rewardCatalog.delete({ where: { id } });
  }

  // ── Discount Tiers ──

  async findAllDiscountTiers() {
    return this.prisma.discountTier.findMany({
      orderBy: { pointsRequired: 'asc' },
    });
  }

  async createDiscountTier(dto: CreateDiscountTierDto) {
    return this.prisma.discountTier.create({
      data: {
        discountPercent: dto.discountPercent,
        pointsRequired: dto.pointsRequired,
        maxDiscountAmount: dto.maxDiscountAmount ? BigInt(dto.maxDiscountAmount) : undefined,
      },
    });
  }

  async updateDiscountTier(id: string, dto: UpdateDiscountTierDto) {
    const existing = await this.prisma.discountTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Discount tier not found');

    const data: Record<string, unknown> = {};
    if (dto.discountPercent !== undefined) data.discountPercent = dto.discountPercent;
    if (dto.pointsRequired !== undefined) data.pointsRequired = dto.pointsRequired;
    if (dto.maxDiscountAmount !== undefined) data.maxDiscountAmount = BigInt(dto.maxDiscountAmount);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.discountTier.update({ where: { id }, data });
  }

  async removeDiscountTier(id: string) {
    const existing = await this.prisma.discountTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Discount tier not found');
    return this.prisma.discountTier.delete({ where: { id } });
  }
}
