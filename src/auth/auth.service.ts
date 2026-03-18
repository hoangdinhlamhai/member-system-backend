import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ZaloService } from '../zalo/zalo.service';
import { MembersService } from '../members/members.service';
import { ReferralsService } from '../referrals/referrals.service';
import { ZaloLoginDto } from './dto/zalo-login.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';

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

  /**
   * @deprecated Tạm thời khóa luồng này vì chưa có Zalo OA
   * Flow xử lý đăng nhập Zalo
   */
  /*
  async zaloLogin(dto: ZaloLoginDto) {
    try {
      const zaloUser = await this.zaloService.verifyAccessToken(dto.accessToken);
      const { phone } = await this.zaloService.decryptPhoneNumber(dto.phoneToken, dto.accessToken);

      let member = await this.membersService.findByZaloId(zaloUser.zaloId);
      let isNewUser = false;

      if (!member) {
        const existingPhone = await this.membersService.findByPhone(phone);
        if (existingPhone) {
          throw new UnauthorizedException('PHONE_ALREADY_LINKED_TO_OTHER_ZALO_ID');
        }

        member = await this.membersService.createMember({
          zaloId: zaloUser.zaloId,
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          phone: phone,
        });
        isNewUser = true;

        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }
      } else {
        member = await this.membersService.updateMemberInfo(member.id, {
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          phone: phone,
          lastActiveAt: new Date(),
        });
      }

      const accessToken = this.jwtService.sign({ sub: member.id, zaloId: member.zaloId });

      return {
        accessToken,
        member,
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw error;
    }
  }
  */
}
