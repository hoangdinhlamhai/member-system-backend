import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

/**
 * Guard kiểm tra X-CUKCUK-Signature header.
 * MVP: So sánh chuỗi fix. Production: HMAC-SHA256 với webhook_secret per branch.
 */
@Injectable()
export class CukcukSignatureGuard implements CanActivate {
  private readonly logger = new Logger(CukcukSignatureGuard.name);

  // MVP: Secret fix cứng. Production: lấy từ ConfigService hoặc per-branch webhook_secret
  private readonly EXPECTED_SIGNATURE = 'secret_123';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-cukcuk-signature'];

    if (!signature) {
      this.logger.warn('Webhook missing X-CUKCUK-Signature header');
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (signature !== this.EXPECTED_SIGNATURE) {
      this.logger.warn(`Invalid webhook signature: ${signature}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
