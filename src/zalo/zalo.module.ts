import { Module } from '@nestjs/common';
import { ZaloService } from './zalo.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ZaloService],
  exports: [ZaloService],
})
export class ZaloModule {}

