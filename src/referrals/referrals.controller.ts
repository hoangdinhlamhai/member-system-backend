import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-referees')
  async getMyReferees(@Request() req) {
    return this.referralsService.getRefereesByReferrerId(req.user.id);
  }
}
