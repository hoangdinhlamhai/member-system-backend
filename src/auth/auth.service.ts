import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
   * Flow xử lý đăng nhập bằng SĐT (khi không có Zalo OA)
   */
  async phoneLogin(dto: PhoneLoginDto) {
    try {
      // 1. Normalize SĐT
      const phone = this.normalizePhone(dto.phone);

      // 2. Tìm hoặc tạo member theo phone
      let { member, isNewUser } = await this.membersService.findByPhone(phone);

      if (isNewUser) {
        // 3. Xử lý referral nếu có
        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }
      } else {
        // Cập nhật lastActiveAt
        member = await this.membersService.updateMemberInfo(member.id, {
          lastActiveAt: new Date(),
        });
      }

      // 4. Tạo JWT
      const accessToken = this.generateTokenByPhone(member);

      return {
        accessToken,
        member,
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`Phone login failed: ${error.message}`);
      throw error;
    }
  }

  generateTokenByPhone(member: any) {
    const payload = { sub: member.id, phone: member.phone };
    return this.jwtService.sign(payload);
  }

  /**
   * @deprecated Tạm thời khóa luồng này vì chưa có Zalo OA
   * Flow xử lý đăng nhập Zalo
   */
  /*
  async zaloLogin(dto: ZaloLoginDto) {
    try {
      // 1. Lấy thông tin Zalo ID
      const zaloUser = await this.zaloService.verifyAccessToken(dto.accessToken);
      
      // 2. Lấy số điện thoại
      const { phone } = await this.zaloService.decryptPhoneNumber(dto.phoneToken, dto.accessToken);

      // 3. Tìm member theo Zalo ID
      let member = await this.membersService.findByZaloId(zaloUser.zaloId);
      let isNewUser = false;

      if (!member) {
        // Kiểm tra xem SĐT đã bị chiếm dụng bởi Zalo ID khác chưa
        const existingPhone = await this.membersService.findByPhone(phone);
        if (existingPhone) {
          throw new UnauthorizedException('PHONE_ALREADY_LINKED_TO_OTHER_ZALO_ID');
        }

        // Tạo member mới
        member = await this.membersService.createMember({
          zaloId: zaloUser.zaloId,
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          phone: phone,
        });
        isNewUser = true;

        // 4. Xử lý Referral nếu có mã giới thiệu
        if (dto.refCode) {
          await this.referralsService.processReferral(dto.refCode, member.id);
        }
      } else {
        // Cập nhật thông tin mới nhất và thời gian hoạt động
        member = await this.membersService.updateMemberInfo(member.id, {
          zaloName: zaloUser.zaloName,
          zaloAvatar: zaloUser.zaloAvatar,
          phone: phone,
          lastActiveAt: new Date(),
        });
      }

      // 5. Tạo JWT
      const accessToken = this.generateToken(member);

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

  generateToken(member: any) {
    const payload = { sub: member.id, zaloId: member.zaloId };
    return this.jwtService.sign(payload);
  }
  */
}
