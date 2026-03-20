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
   * Zalo OAuth Login Flow (Social API v4):
   * 1. Exchange authCode → User Access Token v4 (via oauth.zaloapp.com)
   * 2. Get user info (zaloId, name, avatar, phone) via graph.zalo.me
   * 3. Tìm member theo zaloId → nếu có thì update info
   * 4. Nếu không có → tìm theo phone → nếu có thì link zaloId (merge data)
   * 5. Nếu chưa có member nào → tạo mới
   * 6. Xử lý referral nếu new user
   * 7. Tạo JWT
   */
  async zaloLogin(dto: ZaloLoginDto) {
    try {
      // Step 1: Exchange authCode → User Access Token v4
      const tokenData = await this.zaloService.exchangeAuthCode(
        dto.authCode,
        dto.codeVerifier,
      );
      this.logger.log(`Zalo OAuth token exchanged successfully`);

      // Step 2: Lấy user info bằng User Access Token v4
      const zaloUser = await this.zaloService.getUserInfo(tokenData.accessToken);
      this.logger.log(`Zalo user: ${zaloUser.zaloName} (${zaloUser.zaloId})`);

      const normalizedPhone = zaloUser.phone
        ? this.normalizePhone(zaloUser.phone)
        : undefined;

      // Step 3: Tìm member theo zaloId
      let member = await this.membersService.findByZaloId(zaloUser.zaloId);
      let isNewUser = false;

      if (member) {
        // Member đã tồn tại với zaloId → cập nhật info mới nhất
        const updateData: any = {
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          lastActiveAt: new Date(),
        };
        if (normalizedPhone) updateData.phone = normalizedPhone;

        member = await this.membersService.updateMemberInfo(member.id, updateData);
        this.logger.log(`Existing Zalo member updated: ${member.id}`);
      } else if (normalizedPhone) {
        // Step 4: Tìm theo phone (member có thể đã tạo qua phone-login)
        const existingByPhone = await this.prisma.member.findFirst({
          where: { phone: normalizedPhone },
        });

        if (existingByPhone) {
          if (existingByPhone.zaloId && 
              existingByPhone.zaloId !== zaloUser.zaloId && 
              !existingByPhone.zaloId.startsWith('phone_')) {
            throw new UnauthorizedException('PHONE_ALREADY_LINKED_TO_OTHER_ZALO_ID');
          }

          member = await this.membersService.updateMemberInfo(existingByPhone.id, {
            zaloName: zaloUser.zaloName,
            zaloAvatar: zaloUser.zaloAvatar,
            lastActiveAt: new Date(),
          });

          await this.prisma.member.update({
            where: { id: existingByPhone.id },
            data: { zaloId: zaloUser.zaloId },
          });

          member = await this.membersService.findById(existingByPhone.id);
          if (!member) {
            throw new UnauthorizedException('MEMBER_NOT_FOUND_AFTER_MERGE');
          }

          this.logger.log(`Phone member merged with Zalo: ${member.id}`);
        } else {
          // Step 5: Hoàn toàn mới → tạo member
          member = await this.membersService.createMember({
            zaloId: zaloUser.zaloId,
            zaloName: zaloUser.zaloName,
            zaloAvatar: zaloUser.zaloAvatar,
            phone: normalizedPhone,
          });
          isNewUser = true;

          if (dto.refCode) {
            await this.referralsService.processReferral(dto.refCode, member.id);
          }

          this.logger.log(`New Zalo member created: ${member.id}`);
        }
      } else {
        // Không có phone → tạo member chỉ với Zalo info
        member = await this.membersService.createMember({
          zaloId: zaloUser.zaloId,
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          phone: `zalo_${zaloUser.zaloId}`,
        });
        isNewUser = true;

        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }

        this.logger.log(`New Zalo member (no phone): ${member.id}`);
      }

      // Step 7: Tạo JWT
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
