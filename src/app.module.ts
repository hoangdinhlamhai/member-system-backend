import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ZaloModule } from './zalo/zalo.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { ReferralsModule } from './referrals/referrals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ZaloModule,
    AuthModule,
    MembersModule,
    ReferralsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
