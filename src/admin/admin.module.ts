import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ZaloModule } from '../zalo/zalo.module';
import { AdminTiersController } from './controllers/admin-tiers.controller';
import { AdminTiersService } from './services/admin-tiers.service';
import { AdminRewardsController } from './controllers/admin-rewards.controller';
import { AdminRewardsService } from './services/admin-rewards.service';
import { AdminConfigsController } from './controllers/admin-configs.controller';
import { AdminConfigsService } from './services/admin-configs.service';
import { AdminMembersController } from './controllers/admin-members.controller';
import { AdminMembersService } from './services/admin-members.service';
import { AdminZaloOaController } from './controllers/admin-zalo-oa.controller';

@Module({
  imports: [PrismaModule, ZaloModule],
  controllers: [
    AdminTiersController,
    AdminRewardsController,
    AdminConfigsController,
    AdminMembersController,
    AdminZaloOaController,
  ],
  providers: [
    AdminTiersService,
    AdminRewardsService,
    AdminConfigsService,
    AdminMembersService,
  ],
})
export class AdminModule {}

