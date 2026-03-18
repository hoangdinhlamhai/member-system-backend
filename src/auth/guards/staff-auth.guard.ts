import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard dành riêng cho Staff endpoints.
 * Kế thừa JwtAuthGuard, sau khi verify token sẽ kiểm tra thêm userType === 'staff'.
 */
@Injectable()
export class StaffAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }

    if (user.userType !== 'staff') {
      throw new UnauthorizedException('Chỉ nhân viên mới được truy cập chức năng này.');
    }

    return user;
  }
}
