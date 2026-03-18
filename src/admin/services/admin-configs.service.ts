import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertConfigDto } from '../dto/config.dto';

@Injectable()
export class AdminConfigsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.systemConfig.findMany({
      orderBy: { configKey: 'asc' },
    });
  }

  async upsert(dto: UpsertConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: {
        brandId_configKey: {
          brandId: null as unknown as string,
          configKey: dto.configKey,
        },
      },
      update: {
        configValue: dto.configValue as object,
        description: dto.description,
        updatedAt: new Date(),
      },
      create: {
        configKey: dto.configKey,
        configValue: dto.configValue as object,
        description: dto.description,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.systemConfig.delete({ where: { id } });
  }

  // Branches management
  async findAllBranches() {
    return this.prisma.branch.findMany({
      include: { brand: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateBranch(id: string, data: { address?: string; phone?: string; webhookSecret?: string; isActive?: boolean }) {
    return this.prisma.branch.update({ where: { id }, data });
  }
}
