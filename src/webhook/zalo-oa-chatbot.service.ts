import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZaloService } from '../zalo/zalo.service';
import axios from 'axios';

@Injectable()
export class ZaloOaChatbotService {
  private readonly logger = new Logger(ZaloOaChatbotService.name);

  /** Từ khóa trigger auto-reply (case-insensitive) */
  private readonly KEYWORDS = [
    'doanh số',
    'doanh so',
    'điểm',
    'diem',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly zaloService: ZaloService,
  ) {}

  /**
   * Xử lý bất đồng bộ tin nhắn user_send_text từ Zalo OA webhook.
   * Được gọi fire-and-forget từ controller (không await).
   */
  async handleUserSendText(senderZaloId: string, messageText: string): Promise<void> {
    try {
      // 1. Check keyword match
      const lowerText = messageText.toLowerCase();
      const matched = this.KEYWORDS.some((kw) => lowerText.includes(kw));

      if (!matched) {
        this.logger.debug(`[ZaloOA] No keyword match for: "${messageText}"`);
        return;
      }

      this.logger.log(`[ZaloOA] Keyword matched! sender=${senderZaloId}, text="${messageText}"`);

      // 2. Query member by zaloId
      const member = await this.prisma.member.findUnique({
        where: { zaloId: senderZaloId },
      });

      if (!member) {
        await this.sendTextMessage(
          senderZaloId,
          '❌ Xin lỗi, hệ thống không tìm thấy tài khoản của bạn. Vui lòng đăng ký thành viên qua Zalo Mini App trước nhé!',
        );
        return;
      }

      // 3. Xác định hạng thẻ hiện tại
      const allTiers = await this.prisma.tier.findMany({
        where: { isActive: true },
        orderBy: { minSpending: 'asc' },
      });

      const spending = member.lifetimeSpending ?? BigInt(0);
      let currentTierName = 'Thành viên';
      for (const tier of allTiers) {
        if (spending >= tier.minSpending) {
          currentTierName = tier.name;
        }
      }

      // 4. Doanh số tự tạo trong tháng (monthly_spending realtime)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthlyTxs = await this.prisma.transaction.findMany({
        where: {
          memberId: member.id,
          status: { in: ['approved', 'auto_approved'] },
          createdAt: { gte: startOfMonth },
        },
        select: { finalAmount: true },
      });

      const monthlySelfSales = monthlyTxs.reduce(
        (sum, tx) => sum + Number(tx.finalAmount),
        0,
      );

      // 5. Query danh sách F1 (referrals mà member là referrer)
      const referrals = await this.prisma.referral.findMany({
        where: { referrerId: member.id },
        include: {
          referee: {
            select: {
              zaloName: true,
              fullName: true,
              phone: true,
            },
          },
        },
      });

      // 6. Format tin nhắn
      const displayName = member.zaloName || member.fullName || member.phone || 'Thành viên';
      const pointsBalance = member.pointsBalance ?? 0;

      let replyText = `🍻 ZÔ DỨT CẠN — Báo cáo doanh số\n`;
      replyText += `━━━━━━━━━━━━━━━\n`;
      replyText += `👤 ${displayName}\n`;
      replyText += `🏅 Hạng: ${currentTierName}\n`;
      replyText += `💰 Điểm hiện tại: ${this.formatNumber(pointsBalance)} điểm\n`;
      replyText += `📊 Doanh số tháng này: ${this.formatVND(monthlySelfSales)}\n`;
      replyText += `━━━━━━━━━━━━━━━\n`;

      if (referrals.length > 0) {
        replyText += `\n👥 DANH SÁCH F1 (${referrals.length} người):\n`;

        for (let i = 0; i < referrals.length; i++) {
          const ref = referrals[i];
          const refName = ref.referee?.zaloName || ref.referee?.fullName || ref.referee?.phone || 'Ẩn danh';
          const f1Sales = Number(ref.totalBillAmount ?? 0);
          const f1Earned = Number(ref.totalEarned ?? 0);
          const f1Bills = ref.totalBills ?? 0;

          replyText += `\n${i + 1}. ${refName}\n`;
          replyText += `   📈 DS F1: ${this.formatVND(f1Sales)}\n`;
          replyText += `   💵 Đã hưởng: ${this.formatVND(f1Earned)}\n`;
          replyText += `   🧾 Số lần ăn: ${f1Bills} lần\n`;
        }
      } else {
        replyText += `\n👥 Chưa có F1 nào. Chia sẻ mã giới thiệu để nhận hoa hồng 5%!\n`;
      }

      replyText += `\n━━━━━━━━━━━━━━━\n`;
      replyText += `📱 Xem chi tiết trên Zô Dứt Cạn Mini App`;

      // 7. Gửi tin nhắn qua Zalo OA API
      await this.sendTextMessage(senderZaloId, replyText);

    } catch (error) {
      this.logger.error(
        `[ZaloOA] Failed to handle message from ${senderZaloId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Gửi tin nhắn text qua Zalo OA Customer Service API (cs).
   * Endpoint: POST https://openapi.zalo.me/v3.0/oa/message/cs
   *
   * Access token được lấy tự động từ ZaloService (auto-refresh).
   * KHÔNG phải ZNS (template message trả phí).
   */
  private async sendTextMessage(recipientZaloId: string, text: string): Promise<void> {
    try {
      const accessToken = await this.zaloService.getOaAccessToken();

      const response = await axios.post(
        'https://openapi.zalo.me/v3.0/oa/message/cs',
        {
          recipient: {
            user_id: recipientZaloId,
          },
          message: {
            text,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            access_token: accessToken,
          },
        },
      );

      if (response.data.error !== 0) {
        this.logger.error(
          `[ZaloOA] Send message failed: ${JSON.stringify(response.data)}`,
        );
      } else {
        this.logger.log(
          `[ZaloOA] Message sent to ${recipientZaloId} ✅ (msg_id: ${response.data.data?.message_id || 'N/A'})`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[ZaloOA] API call failed for ${recipientZaloId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /** Format number with VND: 1500000 → "1.500.000đ" */
  private formatVND(amount: number | bigint): string {
    return new Intl.NumberFormat('vi-VN').format(Number(amount)) + 'đ';
  }

  /** Format plain number: 1500 → "1.500" */
  private formatNumber(n: number | bigint): string {
    return new Intl.NumberFormat('vi-VN').format(Number(n));
  }
}
