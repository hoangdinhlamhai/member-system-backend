import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateManualBillDto } from './dto/create-manual-bill.dto';
import { RejectBillDto } from './dto/review-bill.dto';
import { StaffAuthGuard } from '../auth/guards/staff-auth.guard';
import { CurrentStaff } from '../auth/decorators/current-staff.decorator';
import type { CurrentStaffPayload } from '../auth/decorators/current-staff.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/v1/transactions/pending
   * Lấy danh sách bill đang chờ duyệt (Manager only)
   */
  @Get('pending')
  @UseGuards(StaffAuthGuard)
  async getPendingBills(@CurrentStaff() staff: CurrentStaffPayload) {
    const data = await this.transactionsService.getPendingBills(staff);
    return {
      success: true,
      data,
      total: data.length,
    };
  }

  /**
   * PATCH /api/v1/transactions/:id/approve
   * Manager phê duyệt bill
   */
  @Patch(':id/approve')
  @UseGuards(StaffAuthGuard)
  async approveBill(
    @Param('id') id: string,
    @CurrentStaff() staff: CurrentStaffPayload,
  ) {
    const data = await this.transactionsService.approveBill(id, staff);
    return {
      success: true,
      message: `Đã phê duyệt bill ${data.posBillCode}.`,
      data,
    };
  }

  /**
   * PATCH /api/v1/transactions/:id/reject
   * Manager từ chối bill
   */
  @Patch(':id/reject')
  @UseGuards(StaffAuthGuard)
  async rejectBill(
    @Param('id') id: string,
    @Body() dto: RejectBillDto,
    @CurrentStaff() staff: CurrentStaffPayload,
  ) {
    const data = await this.transactionsService.rejectBill(id, dto.reject_reason, staff);
    return {
      success: true,
      message: `Đã từ chối bill ${data.posBillCode}.`,
      data,
    };
  }

  /**
   * POST /api/v1/transactions/manual
   * Nhân viên nhập bill thủ công → chờ Manager duyệt
   */
  @Post('manual')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createManualBill(
    @Body() dto: CreateManualBillDto,
    @CurrentStaff() staff: CurrentStaffPayload,
  ) {
    const transaction = await this.transactionsService.createManualBill(
      dto,
      staff,
    );

    return {
      success: true,
      message: 'Hóa đơn đã được ghi nhận, đang chờ duyệt.',
      data: transaction,
    };
  }

  /**
   * GET /api/v1/transactions/search-member?phone=0901234567
   * Staff tìm khách hàng theo SĐT để nhập bill
   */
  @Get('search-member')
  @UseGuards(StaffAuthGuard)
  async searchMember(@Query('phone') phone: string) {
    if (!phone || phone.trim().length < 3) {
      return { success: true, data: null, message: 'Nhập ít nhất 3 ký tự để tìm kiếm.' };
    }

    const normalizedPhone = phone.replace(/[^\d]/g, '');

    const member = await this.prisma.member.findFirst({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        phone: true,
        zaloName: true,
        fullName: true,
        pointsBalance: true,
      },
    });

    if (!member) {
      throw new NotFoundException(`Không tìm thấy khách hàng với SĐT: ${phone}`);
    }

    return {
      success: true,
      data: member,
    };
  }
}

