import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Thông tin staff được gắn từ JwtStrategy.validate() vào request.user
 */
export interface CurrentStaffPayload {
  id: string;
  phone: string;
  fullName: string;
  role: string;
  branchId: string | null;
  branchName: string | null;
  branchAddress: string | null;
  userType: 'staff';
}

/**
 * Custom decorator lấy thông tin staff từ request.
 * Dùng kèm StaffAuthGuard để đảm bảo type-safety.
 *
 * @example
 * @UseGuards(StaffAuthGuard)
 * @Post('manual')
 * async create(@CurrentStaff() staff: CurrentStaffPayload) {
 *   console.log(staff.id, staff.branchId);
 * }
 */
export const CurrentStaff = createParamDecorator(
  (data: keyof CurrentStaffPayload | undefined, ctx: ExecutionContext): CurrentStaffPayload => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentStaffPayload;
    return data ? user[data] as any : user;
  },
);
