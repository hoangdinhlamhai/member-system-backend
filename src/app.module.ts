import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ZaloModule } from './zalo/zalo.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { ReferralsModule } from './referrals/referrals.module';
import { TransactionsModule } from './transactions/transactions.module';
import { WebhookModule } from './webhook/webhook.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      serveRoot: '/',
      serveStaticOptions: {
        index: false, // Không serve index.html tự động
      },
    }),
    PrismaModule,
    ZaloModule,
    AuthModule,
    MembersModule,
    ReferralsModule,
    TransactionsModule,
    WebhookModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

