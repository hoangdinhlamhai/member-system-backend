import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from './dto/pagination.dto';
import { RedeemDto } from './dto/redeem.dto';

@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * GET /api/v1/members/me/dashboard
   */
  @Get('me/dashboard')
  @UseGuards(JwtAuthGuard)
  async getMyDashboard(@Req() req: any) {
    const memberId = req.user.id;
    return this.membersService.getDashboard(memberId);
  }

  /**
   * GET /api/v1/members/me/timeline
   */
  @Get('me/timeline')
  @UseGuards(JwtAuthGuard)
  async getMyTimeline(
    @Req() req: any,
    @Query() query: PaginationDto,
  ) {
    const memberId = req.user.id;
    return this.membersService.getTimeline(
      memberId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  /**
   * GET /api/v1/members/rewards — Danh sách quà đổi điểm (public, ko cần auth)
   */
  @Get('rewards')
  async getRewardsCatalog() {
    return this.membersService.getRewardsCatalog();
  }

  /**
   * GET /api/v1/members/discount-tiers — Các mức giảm giá bill (public)
   */
  @Get('discount-tiers')
  async getDiscountTiers() {
    return this.membersService.getDiscountTiers();
  }

  /**
   * GET /api/v1/members/me/vouchers — Voucher đã đổi của member (auth required)
   */
  @Get('me/vouchers')
  @UseGuards(JwtAuthGuard)
  async getMyVouchers(@Req() req: any) {
    const memberId = req.user.id;
    return this.membersService.getMyVouchers(memberId);
  }

  /**
   * POST /api/v1/members/me/redeem — Đổi quà hoặc giảm giá bằng điểm
   */
  @Post('me/redeem')
  @UseGuards(JwtAuthGuard)
  async redeemItem(@Req() req: any, @Body() dto: RedeemDto) {
    const memberId = req.user.id;
    return this.membersService.redeemItem(memberId, dto.type, dto.itemId);
  }
}

