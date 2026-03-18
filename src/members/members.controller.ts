import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from './dto/pagination.dto';

@Controller('api/v1/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /**
   * GET /api/v1/members/me/dashboard
   * Trả về toàn bộ thông tin dashboard cho member đang login
   */
  @Get('me/dashboard')
  @UseGuards(JwtAuthGuard)
  async getMyDashboard(@Req() req: any) {
    const memberId = req.user.id;
    return this.membersService.getDashboard(memberId);
  }

  /**
   * GET /api/v1/members/me/timeline?page=1&limit=20
   * Trả về timeline xen kẽ: bill cá nhân + referral earnings
   * Sorted theo date giảm dần (mới nhất lên trước)
   *
   * Response format:
   * {
   *   data: [
   *     { type: 'personal_bill', id, title, amount, date },
   *     { type: 'referral_bonus', id, title, points, date },
   *   ],
   *   meta: { page, limit, total, totalPages }
   * }
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
}
