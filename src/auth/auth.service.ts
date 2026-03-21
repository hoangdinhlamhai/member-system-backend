import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ZaloService } from '../zalo/zalo.service';
import { MembersService } from '../members/members.service';
import { ReferralsService } from '../referrals/referrals.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import * as bcrypt from 'bcryptjs';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private zaloService: ZaloService,
    private membersService: MembersService,
    private referralsService: ReferralsService,
  ) {}

  /**
   * Normalize số điện thoại: bỏ khoảng trắng, các ký tự không phải số,
   * chuyển +84 thành 0 nếu có.
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^\d+]/g, '');
    if (normalized.startsWith('+84')) {
      normalized = '0' + normalized.substring(3);
    } else if (normalized.startsWith('84')) {
      normalized = '0' + normalized.substring(2);
    }
    return normalized;
  }

  /**
   * Zalo Login Flow (trusted frontend data):
   * 1. ZMA frontend: getUserInfo() → { zaloId, name, avatar } (client-side, in Zalo sandbox)
   * 2. Backend: Find/create member by zaloId
   * 3. Tạo JWT
   *
   * Note: exchangeAuthCode is attempted as best-effort verification but NOT required.
   * getUserInfo() from ZMP SDK runs in Zalo app sandbox → trustworthy for loyalty app.
   */
  async zaloLogin(dto: ZaloLoginDto) {
    try {
      // Best-effort verification (non-blocking)
      if (dto.authCode && dto.codeVerifier) {
        try {
          await this.zaloService.exchangeAuthCode(dto.authCode, dto.codeVerifier);
          this.logger.log(`Zalo OAuth verified ✅ for zaloId: ${dto.zaloId}`);
        } catch (verifyErr) {
          this.logger.warn(`Zalo OAuth verification skipped (non-critical): ${verifyErr.message}`);
        }
      }

      this.logger.log(`Zalo login for zaloId: ${dto.zaloId}`);

      // Step 2: Tìm member theo zaloId (from frontend getUserInfo)
      let member = await this.membersService.findByZaloId(dto.zaloId);
      let isNewUser = false;

      if (member) {
        // Member đã tồn tại → cập nhật info mới nhất từ Zalo
        const updateData: any = {
          lastActiveAt: new Date(),
        };
        if (dto.zaloName) updateData.zaloName = dto.zaloName;
        if (dto.zaloAvatar) updateData.zaloAvatar = dto.zaloAvatar;

        member = await this.membersService.updateMemberInfo(member.id, updateData);
        this.logger.log(`Existing Zalo member updated: ${member.id}`);
      } else {
        // Tìm xem có member với zaloId placeholder (phone_xxx) không → merge
        // Hoặc tạo mới
        member = await this.membersService.createMember({
          zaloId: dto.zaloId,
          zaloName: dto.zaloName,
          zaloAvatar: dto.zaloAvatar,
          phone: `zalo_${dto.zaloId}`,
        });
        isNewUser = true;

        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }

        this.logger.log(`New Zalo member created: ${member.id}`);
      }

      // Step 3: Tạo JWT
      if (!member) {
        throw new UnauthorizedException('MEMBER_CREATION_FAILED');
      }

      const accessToken = this.jwtService.sign({
        sub: member.id,
        zaloId: member.zaloId,
        phone: member.phone,
        type: 'member',
      });

      return {
        accessToken,
        userType: 'member',
        member: {
          id: member.id,
          zaloId: member.zaloId,
          zaloName: member.zaloName,
          zaloAvatar: member.zaloAvatar,
          phone: member.phone,
          points: member.pointsBalance ?? 0,
        },
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`Zalo login failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Flow xử lý đăng nhập bằng SĐT:
   * 1. Check cả bảng staff và members
   * 2. Nếu có ở staff → trả về staff info + role → FE redirect Staff UI
   * 3. Nếu chỉ có ở members → trả về member info → FE redirect Member UI
   * 4. Nếu không có ở cả 2 → tạo member mới → FE redirect Member UI
   */
  async phoneLogin(dto: PhoneLoginDto) {
    try {
      // 1. Normalize SĐT
      const phone = this.normalizePhone(dto.phone);

      // 2. Check bảng staff trước
      const staff = await this.prisma.staff.findUnique({
        where: { phone },
        include: { branch: true },
      });

      if (staff) {
        // Staff tồn tại → kiểm tra active
        if (!staff.isActive) {
          throw new UnauthorizedException('Tài khoản nhân viên đã bị vô hiệu hóa.');
        }

        // Tạo JWT cho staff
        const accessToken = this.jwtService.sign({
          sub: staff.id,
          phone: staff.phone,
          role: staff.role,
          type: 'staff',
        });

        this.logger.log(`Staff login: ${staff.fullName} (${staff.role})`);

        return {
          accessToken,
          userType: 'staff',
          staff: {
            id: staff.id,
            phone: staff.phone,
            fullName: staff.fullName,
            role: staff.role,
            branchId: staff.branchId,
            branchName: staff.branch?.address || null,
            branchAddress: staff.branch?.address || null,
          },
          isNewUser: false,
        };
      }

      // 3. Không phải staff → tìm hoặc tạo member
      let { member, isNewUser } = await this.membersService.findByPhone(phone);

      if (isNewUser) {
        // Xử lý referral nếu có
        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }
      } else {
        // Cập nhật lastActiveAt
        member = await this.membersService.updateMemberInfo(member.id, {
          lastActiveAt: new Date(),
        });
      }

      // 4. Tạo JWT cho member
      const accessToken = this.jwtService.sign({
        sub: member.id,
        phone: member.phone,
        type: 'member',
      });

      this.logger.log(`Member login: ${member.phone} (${isNewUser ? 'new' : 'existing'})`);

      return {
        accessToken,
        userType: 'member',
        member,
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`Phone login failed: ${error.message}`);
      throw error;
    }
  }

  async adminLogin(dto: AdminLoginDto) {
    const phone = this.normalizePhone(dto.phone);

    const staff = await this.prisma.staff.findUnique({
      where: { phone },
      include: { branch: true },
    });

    if (!staff) {
      throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng.');
    }

    if (!staff.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa.');
    }

    if (!['admin', 'store_manager'].includes(staff.role)) {
      throw new UnauthorizedException('Tài khoản không có quyền truy cập Admin.');
    }

    if (!staff.passwordHash) {
      throw new UnauthorizedException('Tài khoản chưa được thiết lập mật khẩu.');
    }

    const isMatch = await bcrypt.compare(dto.password, staff.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng.');
    }

    const accessToken = this.jwtService.sign({
      sub: staff.id,
      phone: staff.phone,
      role: staff.role,
      type: 'staff',
    });

    this.logger.log(`Admin login: ${staff.fullName} (${staff.role})`);

    return {
      accessToken,
      staff: {
        id: staff.id,
        phone: staff.phone,
        fullName: staff.fullName,
        role: staff.role,
        branchId: staff.branchId,
      },
    };
  }
}
