import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTierDto, UpdateTierDto } from '../dto/tier.dto';

@Injectable()
export class AdminTiersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tier.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const tier = await this.prisma.tier.findUnique({ where: { id } });
    if (!tier) throw new NotFoundException('Tier not found');
    return tier;
  }

  async create(dto: CreateTierDto) {
    return this.prisma.tier.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        displayOrder: dto.displayOrder,
        minSpending: BigInt(dto.minSpending),
        pointsMultiplier: dto.pointsMultiplier ?? 1.0,
        referralBonusPercent: dto.referralBonusPercent ?? 5.0,
        themeConfig: (dto.themeConfig ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateTierDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.minSpending !== undefined) data.minSpending = BigInt(dto.minSpending);
    if (dto.pointsMultiplier !== undefined) data.pointsMultiplier = dto.pointsMultiplier;
    if (dto.referralBonusPercent !== undefined) data.referralBonusPercent = dto.referralBonusPercent;
    if (dto.themeConfig !== undefined) data.themeConfig = dto.themeConfig;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.tier.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tier.delete({ where: { id } });
  }
}
