import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { ZaloOaChatbotService } from './zalo-oa-chatbot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ZaloModule } from '../zalo/zalo.module';

@Module({
  imports: [PrismaModule, ConfigModule, ZaloModule],
  controllers: [WebhookController],
  providers: [WebhookService, ZaloOaChatbotService],
})
export class WebhookModule {}


