# 📋 IMPLEMENTATION PLAN — Zô Dứt Cạn Loyalty System

> **Dựa trên:** PRD Kỹ Thuật v4.0 (24 trang)
> **Ngày tạo:** 2026-03-18
> **Cập nhật:** 2026-03-23
> **Trạng thái:** Active — Sprint 5 đang triển khai
> **Tiến độ tổng:** ████████░░░░░░░ ~55% MVP

---

## 📊 GAP ANALYSIS SUMMARY

### Đã hoàn thành ✅

| #   | Feature                                         | Files chính                                                                |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | DB Schema 16 bảng (Prisma)                      | `prisma/schema.prisma`                                                     |
| 2   | Auth Phone Login + JWT                          | `src/auth/`                                                                |
| 3   | **Zalo OAuth Login (trusted frontend)**         | `src/auth/`, `src/zalo/`, ZMA `zalo-auth.ts`                               |
| 4   | **Admin Login (phone + password)**              | `src/auth/auth.service.ts`, `dto/admin-login.dto.ts`                       |
| 5   | **Complete Profile (SĐT + refCode)**            | `src/auth/auth.controller.ts`, ZMA `complete-profile.tsx`, `add-phone.tsx` |
| 6   | CUKCUK Webhook (signature, idempotent, atomic)  | `src/webhook/`                                                             |
| 7   | Bill Manual Entry (staff nhập bill)             | `src/transactions/`                                                        |
| 8   | Bill Approval (manager approve/reject)          | `src/transactions/`                                                        |
| 9   | Spending Update (lifetime + monthly)            | `src/transactions/`, `src/webhook/`                                        |
| 10  | Tier Promotion (auto check sau approve/webhook) | `src/transactions/`, `src/webhook/`                                        |
| 11  | Referral Engine 5% (trọn đời, ngang hàng F1)    | `src/webhook/`, `src/transactions/`                                        |
| 12  | Dashboard API (profile + tier + stats)          | `src/members/`                                                             |
| 13  | Timeline API (bill + referral xen kẽ)           | `src/members/`                                                             |
| 14  | Frontend Dashboard + Timeline + Approve Bill    | ZMA project                                                                |
| 15  | Frontend Tier Card (dynamic themeConfig)        | ZMA project                                                                |
| 16  | **Rewards API (catalog, vouchers, redeem)**     | `src/rewards/`, ZMA stores                                                 |
| 17  | **Frontend Rewards (real API, not mock)**       | ZMA `stores/`, `hooks/`, `pages/rewards.tsx`                               |

### Còn thiếu ❌

| Priority | Feature                            | Effort | Sprint       |
| -------- | ---------------------------------- | ------ | ------------ |
| 🔴 P0    | Schema migration (bổ sung columns) | S      | 1            |
| 🔴 P0    | Tier config align PRD              | S      | 1            |
| 🔴 P0    | Bill min 100k cho referral         | S      | 1            |
| 🔴 P0    | Rewards/Vouchers API               | L      | 2            |
| 🔴 P0    | ZNS Notifications (6 loại)         | L      | 3            |
| ✅ Done  | Zalo OAuth 2.0 (trusted frontend)  | L      | ~~4~~ Done   |
| 🟡 P1    | Monthly spending reset (cron)      | M      | 4            |
| 🟡 P1    | Points expiry (12 tháng)           | M      | 4            |
| 🟡 P1    | Staff quét voucher                 | M      | 2            |
| 🟡 P1    | Redis cache                        | M      | 4            |
| � P2     | Web Admin Dashboard (Next.js)      | XL     | 5 (đang làm) |
| 🟠 P2    | Fraud Detection engine             | L      | 6            |
| 🟠 P2    | Fallback polling (BullMQ cron)     | M      | 6            |
| 🟠 P2    | Zalo OA Chatbot                    | M      | 6            |
| 🟢 P3    | HMAC-SHA256 per-branch             | M      | 6            |
| 🟢 P3    | S3 Storage (bill images)           | S      | 6            |
| 🟢 P3    | CI/CD + Sentry                     | L      | 6            |

> **Effort:** S = 1-2h · M = 3-6h · L = 1-2 ngày · XL = 3-5 ngày

---

## ⚠️ CÂU HỎI CẦN CONFIRM TRƯỚC KHI CODE

| #   | Câu hỏi                                                                                                                          | Ảnh hưởng                  | Trạng thái     |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| 1   | **Mốc hạng thẻ:** PRD ghi Bạc=5M, Vàng=20M, Bạch Kim=50M, Kim Cương=100M. Code hiện tại: 2M, 5M, 15M, 50M. **Dùng giá trị nào?** | Seed data, FE progress bar | ⏳ Cần confirm |
| 2   | **Points multiplier:** PRD: Bạch Kim=x1.8, Kim Cương=x2.0. Code: x2.0, x3.0. **Dùng giá trị nào?**                               | Tính điểm                  | ⏳ Cần confirm |
| 3   | **CUKCUK webhook format:** PRD ghi "cần confirm MISA". **Đã confirm format thực chưa?**                                          | Webhook DTO                | ⏳ Cần confirm |
| 4   | **Bill tối thiểu 100k:** Áp dụng **chỉ cho referral** hay cho **tất cả bill**?                                                   | Business logic             | ⏳ Cần confirm |
| 5   | **Zalo OA:** Đã tạo Official Account và đăng ký ZNS chưa? **Template IDs?**                                                      | ZNS integration            | ⏳ Cần confirm |
| 6   | **Zalo Mini App:** Đã đăng ký trên Zalo Developers chưa? **App ID?**                                                             | Auth OAuth                 | ⏳ Cần confirm |
| 7   | **Điểm hết hạn 12 tháng:** Confirm hay thay đổi thời hạn?                                                                        | Cron job logic             | ⏳ Cần confirm |

---

## 🔵 SPRINT 1 — Schema Fix + Business Rules

> **Mục tiêu:** Align DB schema và business rules với PRD
> **Effort:** ~1 ngày
> **Trạng thái:** ⬜ Chưa bắt đầu

### Task 1.1 — Migration: Bổ sung columns cho `members`

**File:** `prisma/schema.prisma`

Thêm 2 fields PRD yêu cầu mà schema hiện tại thiếu:

```prisma
model Member {
  // ... existing fields ...

  // ★ PRD 3.2: Tracking doanh số referral + current tier
  currentTierId        String?  @map("current_tier_id") @db.Uuid
  referralTotalEarning BigInt?  @default(0) @map("referral_total_earning")

  // Relation
  currentTier          Tier?    @relation("CurrentTier", fields: [currentTierId], references: [id])
}
```

**Verify:** `npx prisma migrate dev --name add_member_prd_columns`

---

### Task 1.2 — Migration: Bổ sung columns cho `transactions`

**File:** `prisma/schema.prisma`

PRD section 3.5 yêu cầu referral tracking trên transaction:

```prisma
model Transaction {
  // ... existing fields ...

  // ★ PRD 3.5: Referral tracking trên từng bill
  hasReferralEarning   Boolean?  @default(false) @map("has_referral_earning")
  referralEarnAmount   BigInt?   @default(0) @map("referral_earn_amount")
}
```

---

### Task 1.3 — Migration: Bổ sung columns cho `redemptions`

**File:** `prisma/schema.prisma`

PRD section 3.7 có `points_spent` và `status`:

```prisma
model Redemption {
  // ... existing fields ...

  // ★ PRD 3.7
  pointsSpent    Int       @map("points_spent")
  status         String?   @default("issued") @db.VarChar(20)
  // 'issued', 'redeemed', 'expired', 'cancelled'
}
```

---

### Task 1.4 — Migration: Bổ sung `alert_type` cho `fraud_alerts`

**File:** `prisma/schema.prisma`

PRD section 3.8:

```prisma
model FraudAlert {
  // ... existing fields ...

  // ★ PRD 3.8
  alertType     String    @map("alert_type") @db.VarChar(50)
  // 'self_referral', 'bulk_fake_accounts', 'bulk_referral', 'bill_mismatch', 'ghost_referral'
}
```

---

### Task 1.5 — Update Tier Seed Data

**File:** `prisma/seed.ts`

**⚠️ CẦN CONFIRM trước khi làm — Xem câu hỏi #1 và #2**

PRD seed data (nếu dùng PRD values):

| Hạng              | min_spending | points_multiplier |
| ----------------- | ------------ | ----------------- |
| Thành viên (Đồng) | 0đ           | x1.0              |
| Bạc               | 5,000,000đ   | x1.2              |
| Vàng              | 20,000,000đ  | x1.5              |
| Bạch Kim          | 50,000,000đ  | x1.8              |
| Kim Cương         | 100,000,000đ | x2.0              |

Hiện tại trong code:

| Hạng      | min_spending | points_multiplier |
| --------- | ------------ | ----------------- |
| Đồng      | 0đ           | x1.0              |
| Bạc       | 2,000,000đ   | x1.2              |
| Vàng      | 5,000,000đ   | x1.5              |
| Bạch Kim  | 15,000,000đ  | x2.0              |
| Kim Cương | 50,000,000đ  | x3.0              |

---

### Task 1.6 — Business Rule: Bill tối thiểu 100k cho referral

**Files:**

- `src/webhook/webhook.service.ts` → `processReferralEngine()`
- `src/transactions/transactions.service.ts` → `approveBill()` referral section

**Logic:**

```typescript
// Lấy từ system_configs hoặc hardcode MVP
const MIN_BILL_FOR_REFERRAL = 100_000; // 100k VND

if (Number(billAmount) < MIN_BILL_FOR_REFERRAL) {
  this.logger.log(
    `[Referral] Bill ${billAmount} < ${MIN_BILL_FOR_REFERRAL}, skip referral`,
  );
  return null;
}
```

**Test cases:**

- [ ] Bill 50k → referral KHÔNG tính
- [ ] Bill 100k → referral tính 5%
- [ ] Bill 500k → referral tính 5%

---

### Task 1.7 — Update Referral Engine: Cộng `referral_total_earning`

**Files:** `src/webhook/webhook.service.ts`, `src/transactions/transactions.service.ts`

Sau khi tính referral earning, cập nhật thêm trên member:

```typescript
// Cập nhật referrer
await tx.member.update({
  where: { id: referrerId },
  data: {
    pointsBalance: { increment: pointsAwarded },
    pointsEarned: { increment: pointsAwarded },
    referralTotalEarning: { increment: earnAmount }, // ★ PRD field mới
  },
});
```

---

### Task 1.8 — Update Tier Promotion: Set `current_tier_id`

**Files:** `src/webhook/webhook.service.ts` → `checkAndUpgradeTier()`

Sau khi thăng hạng, update `current_tier_id` trên member:

```typescript
// Sau khi insert tier_histories
await tx.member.update({
  where: { id: memberId },
  data: { currentTierId: targetTier.id },
});
```

---

### Sprint 1 — Checklist

- [ ] 1.1 Migration: `members` + `current_tier_id`, `referral_total_earning`
- [ ] 1.2 Migration: `transactions` + `has_referral_earning`, `referral_earn_amount`
- [ ] 1.3 Migration: `redemptions` + `points_spent`, `status`
- [ ] 1.4 Migration: `fraud_alerts` + `alert_type`
- [ ] 1.5 Update tier seed data (**cần confirm**)
- [ ] 1.6 Bill min 100k cho referral
- [ ] 1.7 Cộng `referral_total_earning`
- [ ] 1.8 Set `current_tier_id` khi thăng hạng
- [ ] Chạy `npx prisma migrate dev`
- [ ] Chạy `npx prisma db seed`
- [ ] Test webhook flow
- [ ] Test approve flow

---

## 🟡 SPRINT 2 — Rewards & Vouchers API

> **Mục tiêu:** API đổi điểm, tạo voucher, staff quét voucher
> **Effort:** ~2 ngày
> **Dependency:** Sprint 1 xong (schema mới)
> **Trạng thái:** ⬜ Chưa bắt đầu

### Task 2.1 — Tạo RewardsModule

**Tạo mới:** `src/rewards/`

```
src/rewards/
├── rewards.module.ts
├── rewards.controller.ts
├── rewards.service.ts
└── dto/
    ├── redeem-reward.dto.ts
    └── redeem-discount.dto.ts
```

---

### Task 2.2 — API: List Rewards + Discount Tiers

**Endpoints:**

```
GET /api/v1/rewards/catalog
  → List rewards_catalog (is_active=true, valid_from/valid_until)
  → Response: { rewards: [...], discountTiers: [...] }

GET /api/v1/rewards/my-vouchers
  → Auth: JWT (member)
  → List redemptions của member (status != 'cancelled')
  → Response: { vouchers: [...] }
```

---

### Task 2.3 — API: Đổi điểm → Tạo Voucher

**Endpoint:**

```
POST /api/v1/rewards/redeem
Auth: JWT (member)
Body: {
  type: "gift" | "discount",
  rewardId?: string,       // Nếu type=gift
  discountTierId?: string  // Nếu type=discount
}
```

**Business Logic (atomic `prisma.$transaction`):**

1. Check member có đủ điểm không
2. Check reward còn hàng / per-member limit
3. Trừ `points_balance`, `points_spent`
4. Tạo `point_transactions` (type: `redeem_gift` hoặc `redeem_discount`)
5. Generate `voucher_code` (nanoid, 8 chars, uppercase)
6. Tạo `redemptions` (status: `issued`, expires_at: +7 days)
7. Return voucher info + QR data

**Test cases:**

- [ ] Đổi giảm giá 5% (100 điểm) → voucher QR tạo thành công
- [ ] Đổi giảm giá 10% (200 điểm) → OK
- [ ] Đổi quà → OK, quantity giảm
- [ ] Không đủ điểm → 400 error
- [ ] Vượt per_member_limit → 400 error
- [ ] Hết hàng → 400 error

---

### Task 2.4 — API: Staff quét voucher

**Endpoint:**

```
POST /api/v1/staff/scan-voucher
Auth: JWT (staff)
Body: { voucherCode: "ABC12345" }
```

**Business Logic:**

1. Tìm redemption by `voucher_code`
2. Check status = `issued` (chưa dùng)
3. Check chưa hết hạn (`expires_at > now()`)
4. Update status → `redeemed`, `redeemed_at`, `redeemed_by`, `branch_id`
5. Nếu discount → trả thông tin % giảm, max amount
6. Nếu gift → trả thông tin quà

**Test cases:**

- [ ] Quét voucher hợp lệ → 200, info hiển thị
- [ ] Voucher đã dùng → 400 `"Voucher đã được sử dụng"`
- [ ] Voucher hết hạn → 400 `"Voucher đã hết hạn"`
- [ ] Voucher không tồn tại → 404

---

### Task 2.5 — Seed Data: Rewards + Discount Tiers

**File:** `prisma/seed.ts`

```typescript
// Discount Tiers
{ discountPercent: 5.00, pointsRequired: 100, maxDiscountAmount: 100_000 }
{ discountPercent: 10.00, pointsRequired: 200, maxDiscountAmount: 200_000 }

// Sample Rewards
{ name: "Trà đào miễn phí", type: "gift", pointsRequired: 50, quantityLimit: 100 }
{ name: "Voucher 50k", type: "voucher", pointsRequired: 150, quantityLimit: 50 }
```

---

### Task 2.6 — Frontend: Kết nối API thật

**Files:** ZMA project

- `src/stores/member-store.ts` → Thay mock data bằng API calls
- `src/components/rewards/` → Cập nhật components

---

### Sprint 2 — Checklist

- [ ] 2.1 Tạo `RewardsModule` (module, controller, service)
- [ ] 2.2 `GET /rewards/catalog` + `GET /rewards/my-vouchers`
- [ ] 2.3 `POST /rewards/redeem` (atomic, voucher code gen)
- [ ] 2.4 `POST /staff/scan-voucher`
- [ ] 2.5 Seed data (discount tiers + sample rewards)
- [ ] 2.6 Frontend: replace mock với API thật
- [ ] Test toàn bộ flow: đổi điểm → voucher → staff quét

---

## 🔴 SPRINT 3 — ZNS Notifications + BullMQ

> **Mục tiêu:** Gửi ZNS realtime + async queue
> **Effort:** ~2 ngày
> **Dependency:** Zalo OA đã tạo + ZNS templates đã đăng ký
> **Trạng thái:** ⬜ Chưa bắt đầu

### Task 3.1 — Setup Redis + BullMQ

**Install:**

```bash
npm install @nestjs/bullmq bullmq ioredis
```

**Config:** `app.module.ts`

```typescript
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
}),
```

---

### Task 3.2 — Tạo ZnsModule

**Tạo mới:** `src/zns/`

```
src/zns/
├── zns.module.ts
├── zns.service.ts        // Zalo OA API client (ZNS send)
├── zns.producer.ts       // Queue producer (dispatch jobs)
├── zns.consumer.ts       // Queue consumer (process + send)
└── types/
    └── zns-templates.ts  // Template types & payloads
```

**ZNS API Flow:**

```
Event xảy ra (webhook/approve/redeem)
  → Producer dispatch job vào BullMQ
  → Consumer pick job
  → Gọi Zalo OA API: POST /oa/message/zns
  → Retry 3 lần nếu fail
  → Log kết quả
```

---

### Task 3.3 — ZNS Templates (6 loại)

| #   | Event               | Template Key       | Payload                                             | Trigger             |
| --- | ------------------- | ------------------ | --------------------------------------------------- | ------------------- |
| 1   | Bill ghi nhận       | `bill_confirmed`   | amount, branch, points                              | Webhook + Approve   |
| 2   | Referral earning    | `referral_earn`    | friend_name, bill_amount, earn_amount, total_points | Webhook + Approve   |
| 3   | F1 đăng ký          | `referral_new_f1`  | referee_name                                        | Auth (registration) |
| 4   | Thăng hạng          | `tier_upgrade`     | tier_name, multiplier                               | Webhook + Approve   |
| 5   | Đủ điểm giảm giá    | `points_milestone` | points, discount_percent                            | Sau tính điểm       |
| 6   | Voucher sắp hết hạn | `voucher_expiring` | voucher_code, discount, expires_at                  | Cron (24h trước)    |

---

### Task 3.4 — Integrate ZNS vào các flows

**Files cần sửa:**

| File                      | Thêm ZNS events                                       |
| ------------------------- | ----------------------------------------------------- |
| `webhook.service.ts`      | Bill confirmed, Referral earn, Tier upgrade           |
| `transactions.service.ts` | Bill confirmed (approve), Referral earn, Tier upgrade |
| `auth.service.ts`         | F1 đăng ký (new referral)                             |
| `rewards.service.ts`      | Points milestone check                                |

---

### Task 3.5 — Voucher Expiry Alert Cron

**Logic:** BullMQ repeatable job, chạy mỗi ngày 9:00 AM

```typescript
// Tìm voucher expires trong 24h tới
const expiringVouchers = await prisma.redemption.findMany({
  where: {
    status: 'issued',
    expiresAt: {
      gte: now,
      lte: now + 24h,
    },
  },
});
// Gửi ZNS cho mỗi member
```

---

### Sprint 3 — Checklist

- [ ] 3.1 Install + config Redis + BullMQ
- [ ] 3.2 Tạo `ZnsModule` (service, producer, consumer)
- [ ] 3.3 Define 6 ZNS template types
- [ ] 3.4 Integrate vào webhook.service.ts
- [ ] 3.5 Integrate vào transactions.service.ts
- [ ] 3.6 Integrate vào auth.service.ts
- [ ] 3.7 Voucher expiry alert cron job
- [ ] Test: Gửi ZNS thành công (sandbox)

---

## 🟣 SPRINT 4 — ~~Zalo OAuth~~ + Cron Jobs

> **Mục tiêu:** ~~Auth đúng PRD~~ ✅ Done + monthly reset + points expiry + Redis cache
> **Effort:** ~2 ngày
> **Dependency:** ~~Zalo Mini App đã đăng ký~~ ✅ Done
> **Trạng thái:** 🟡 Zalo OAuth Done, Cron Jobs chưa

### Task 4.1 — Zalo OAuth 2.0 ✅ DONE

**Files:** `src/auth/auth.service.ts`, `src/zalo/zalo.service.ts`, ZMA `src/services/zalo-auth.ts`

**Flow thực tế (đã implement, khác PRD do IP restriction):**

```
1. ZMA gọi authorize() → xin quyền
2. ZMA gọi getUserInfo() → { zaloId, zaloName, zaloAvatar } (client-side, in Zalo sandbox)
3. ZMA gọi getAuthCode() → authCode + codeVerifier
4. ZMA gửi lên backend: { zaloId, zaloName, zaloAvatar, authCode, codeVerifier, refCode? }
5. Backend: exchangeAuthCode() as best-effort verification (non-blocking)
6. Backend: Find/create member by zaloId (KHÔNG có SĐT)
7. Backend: Process referral nếu có refCode
8. Return JWT + isNewUser flag
```

**⚠️ Lý do khác PRD:**

- `graph.zalo.me` (getUserInfo server-side) bị **chặn IP ngoài Việt Nam** → Vercel không gọi được
- `getPhoneNumber()` trả về encrypted token, cần server VN decrypt → cũng bị chặn
- **Giải pháp:** Dùng ZMP SDK `getUserInfo()` client-side (trusted vì chạy trong Zalo sandbox)
- SĐT: User tự nhập sau login từ Dashboard

**Endpoints:**

```
POST /auth/zalo-login
Body: {
  zaloId: string,         // Từ getUserInfo()
  zaloName?: string,      // Từ getUserInfo()
  zaloAvatar?: string,    // Từ getUserInfo()
  authCode?: string,      // Từ getAuthCode() — optional
  codeVerifier?: string,  // Từ getAuthCode() — optional
  refCode?: string        // Mã giới thiệu
}

PATCH /auth/complete-profile  (JWT required)
Body: {
  phone?: string,   // Thêm SĐT (từ dashboard)
  refCode?: string  // Mã giới thiệu (cho new user)
}
→ Handles: update phone, merge with phone-login member, process referral
```

**Frontend pages:**

| Page                   | Route               | Chức năng                     |
| ---------------------- | ------------------- | ----------------------------- |
| `complete-profile.tsx` | `/complete-profile` | New user nhập mã giới thiệu   |
| `add-phone.tsx`        | `/add-phone`        | Thêm SĐT từ dashboard         |
| Dashboard card         | `/dashboard`        | Hiện "+ Thêm SĐT" nếu chưa có |

---

### Task 4.2 — Monthly Spending Reset Cron

**File:** `src/cron/monthly-reset.processor.ts`

**Logic:** BullMQ repeatable job, ngày 1 hàng tháng 00:05 AM

```typescript
await prisma.member.updateMany({
  data: { monthlySpending: 0 },
});
```

---

### Task 4.3 — Points Expiry Cron (12 tháng)

**File:** `src/cron/points-expiry.processor.ts`

**Logic:** BullMQ repeatable job, chạy mỗi ngày 01:00 AM

```typescript
// Tìm point_transactions cũ hơn 12 tháng, type = earn (chưa expired)
// Tính total points cần trừ
// Trừ member.points_balance
// Tạo point_transactions type 'expired'
// Gửi ZNS thông báo (nếu có trừ)
```

---

### Task 4.4 — Redis Cache cho Dashboard

**File:** `src/members/members.service.ts`

```typescript
// Cache key: `dashboard:${memberId}`
// TTL: 5 phút
// Invalidate khi: webhook, approve, redeem
```

---

### Sprint 4 — Checklist

- [x] 4.1 Zalo OAuth endpoint (trusted frontend getUserInfo) ✅
- [x] 4.2 Auto F1 qua `refCode` param ✅
- [x] 4.3 Complete profile: thêm SĐT + merge member ✅
- [ ] 4.4 Follow OA check API
- [ ] 4.5 Monthly spending reset cron
- [ ] 4.6 Points expiry cron (12 tháng)
- [ ] 4.7 Redis cache dashboard
- [x] Test: Zalo login flow E2E ✅

---

## 🟠 SPRINT 5 — Web Admin Dashboard

> **Mục tiêu:** Next.js admin panel cho quản lý
> **Effort:** ~3-5 ngày
> **Dependency:** Backend APIs sẵn sàng
> **Trạng thái:** 🟡 Đang triển khai — Core pages done

### Task 5.1 — Setup Next.js Project ✅ DONE

**Project:** `member-system-zodutcan-web-admin` (Next.js 16 + Tailwind v4 + Prisma)

- Chạy local port 3005
- Kết nối trực tiếp Neon DB qua Prisma (server components)
- Gọi backend API (NEXT_PUBLIC_API_URL) cho các action (approve, reject, update)

### Task 5.2 — Auth ✅ DONE

- Admin login page (`/login`) — phone + password
- Middleware kiểm tra `admin_token` cookie
- Gọi `POST /api/v1/auth/admin-login` trên backend
- Logout button trên sidebar

### Task 5.3 — Backend: Admin APIs ✅ DONE

```
GET    /api/v1/admin/members         — List + search + filter + pagination
GET    /api/v1/admin/members/:id     — Detail + transactions + referrals
PATCH  /api/v1/admin/members/:id/adjust-points — Điều chỉnh điểm
GET    /api/v1/admin/reports/overview — Tổng quan stats (dashboard)
GET    /api/v1/admin/configs/branches — List chi nhánh
PATCH  /api/v1/admin/configs/branches/:id — Update chi nhánh
GET    /api/v1/transactions/pending   — Bill chờ duyệt
PATCH  /api/v1/transactions/:id/approve — Duyệt bill
PATCH  /api/v1/transactions/:id/reject  — Từ chối bill
```

### Task 5.4 — Admin Pages ✅ DONE

| Page        | Route                | Features                                             | Status  |
| ----------- | -------------------- | ---------------------------------------------------- | ------- |
| Tổng quan   | `/`                  | Stats cards, recent transactions, member mới         | ✅ Done |
| Thành viên  | `/members`           | List + search + filter hạng + pagination             | ✅ Done |
| Chi tiết TV | `/members/[id]`      | Detail + transactions + referrals                    | ✅ Done |
| Giao dịch   | `/transactions`      | List + status tabs + pagination                      | ✅ Done |
| Chi tiết GD | `/transactions/[id]` | Detail bill info, items, customer, branch            | ✅ Done |
| Đổi quà     | `/rewards`           | List rewards catalog + discount tiers                | ✅ Done |
| Hạng thẻ    | `/tiers`             | Tier config display                                  | ✅ Done |
| Gian lận    | `/fraud`             | Fraud alerts list                                    | ✅ Done |
| Chi nhánh   | `/branches`          | List + inline edit (address, phone, webhook, toggle) | ✅ Done |
| Login       | `/login`             | Phone + password auth                                | ✅ Done |

### Task 5.5 — Sidebar Navigation ✅ DONE

- Tổng quan, Thành viên, Giao dịch, Đổi quà, Hạng thẻ, Gian lận, Chi nhánh
- Logout button
- Removed: Webhook, Cài đặt (không cần cho MVP)

---

### Sprint 5 — Checklist

- [x] 5.1 Setup Next.js project (Next.js 16, Tailwind v4, Prisma) ✅
- [x] 5.2 Auth: admin login + middleware + logout ✅
- [x] 5.3 Backend: Admin APIs (members, configs, transactions) ✅
- [x] 5.4 Dashboard page (stats, recent activity) ✅
- [x] 5.5 Members management page (list + detail) ✅
- [x] 5.6 Transactions page (list + status tabs + detail view) ✅
- [x] 5.7 Rewards page ✅
- [x] 5.8 Tiers page ✅
- [x] 5.9 Fraud alerts page ✅
- [x] 5.10 Branch management page (list + inline edit) ✅
- [x] 5.11 Sidebar navigation + logout ✅
- [ ] Reports page (referral cost, retention)
- [ ] Export CSV/Excel
- [ ] System settings page (CRUD configs)

---

## 🟢 SPRINT 6 — Polish & Production Ready

> **Mục tiêu:** Security, fraud, monitoring, CI/CD
> **Effort:** ~2 ngày
> **Trạng thái:** ⬜ Chưa bắt đầu

### Task 6.1 — HMAC-SHA256 Webhook Signature

**File:** `src/webhook/guards/cukcuk-signature.guard.ts`

```typescript
// 1. Lấy branch_id từ request body
// 2. Query branch.webhook_secret
// 3. HMAC-SHA256(raw_body, webhook_secret)
// 4. Compare với X-CUKCUK-Signature header
```

---

### Task 6.2 — Fraud Detection Engine

**File:** `src/fraud/fraud-detection.service.ts`

6 rules:

| Rule               | Logic                                 | Action                          |
| ------------------ | ------------------------------------- | ------------------------------- |
| Self-referral      | Cùng device/IP giữa referrer-referee  | Auto-reject referral            |
| Bulk fake accounts | Nhiều Zalo ID từ cùng device trong 1h | Flag `fraud_alerts`             |
| Bill tối thiểu     | Bill < 100k                           | Skip referral (Sprint 1 đã làm) |
| Referral abuse     | 1 referrer earning > threshold/ngày   | Flag `fraud_alerts`             |
| Webhook replay     | Cùng bill_id                          | Skip (Sprint 0 đã có)           |
| Ghost referral     | F1 > 60 ngày không bill               | Cron flag inactive              |

---

### Task 6.3 — Fallback Polling Worker

**File:** `src/webhook/webhook-fallback.processor.ts`

BullMQ cron mỗi 5 phút:

- GET bills từ CUKCUK API (from: last_sync_at)
- So sánh với transactions đã có
- Insert missing → xử lý như webhook

---

### Task 6.4 — Zalo OA Chatbot

- Setup Zalo OA Menu (5 items)
- Keyword auto-reply: "doanh số", "điểm"
- Format rich message → Zalo OA API reply

---

### Task 6.5 — CI/CD + Monitoring

```
GitHub Actions:
  → Build Docker image
  → Push to registry
  → Deploy via Dokploy (VPS)

Sentry:
  → npm install @sentry/nestjs
  → Error tracking + performance monitoring
```

---

### Sprint 6 — Checklist

- [ ] 6.1 HMAC-SHA256 per-branch signature
- [ ] 6.2 Fraud detection engine (6 rules)
- [ ] 6.3 Fallback polling worker
- [ ] 6.4 Zalo OA Chatbot
- [ ] 6.5 CI/CD (GitHub Actions + Docker)
- [ ] 6.6 Sentry monitoring
- [ ] 6.7 E2E Testing (Playwright)

---

## 📅 TIMELINE TỔNG

```
Sprint 1 ████████░░░░░░░░░░░░░░░░░░░░  Schema + Rules      (~1 ngày)
Sprint 2 ░░░░░░░░████████████░░░░░░░░░  Rewards/Vouchers    (~2 ngày)
Sprint 3 ░░░░░░░░░░░░░░░░░░░████████░░  ZNS + BullMQ        (~2 ngày)
Sprint 4 ░░░░░░░░░░░░░░░░░░░░░░░░████  Zalo OAuth + Crons  (~2 ngày)
Sprint 5 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Web Admin           (~3-5 ngày)
Sprint 6 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Polish + Production (~2 ngày)
         ─────────────────────────────
         Tổng ước tính: ~12-14 ngày (2-3 tuần)
```

---

## 📁 FILE REFERENCE

### Backend (NestJS)

| Module       | Path                | Status                                                 |
| ------------ | ------------------- | ------------------------------------------------------ |
| Auth         | `src/auth/`         | ✅ Phone + Zalo OAuth + Admin Login + Complete Profile |
| Members      | `src/members/`      | ✅ Có                                                  |
| Transactions | `src/transactions/` | ✅ Có                                                  |
| Referrals    | `src/referrals/`    | ✅ Có                                                  |
| Webhook      | `src/webhook/`      | ✅ Có                                                  |
| Prisma       | `src/prisma/`       | ✅ Có                                                  |
| Zalo         | `src/zalo/`         | ✅ exchangeAuthCode (best-effort)                      |
| Rewards      | `src/rewards/`      | ✅ Catalog + Vouchers + Redeem                         |
| **ZNS**      | `src/zns/`          | ❌ Chưa tạo                                            |
| **Cron**     | `src/cron/`         | ❌ Chưa tạo                                            |
| **Fraud**    | `src/fraud/`        | ❌ Chưa tạo                                            |
| **Admin**    | `src/admin/`        | ✅ Members + Configs + Branches                        |

### Frontend (Zalo Mini App)

| Component            | Status                                 |
| -------------------- | -------------------------------------- |
| Login (Zalo + Phone) | ✅ Zalo OAuth + Phone fallback         |
| Complete Profile     | ✅ Mã giới thiệu (new user)            |
| Add Phone            | ✅ Thêm SĐT (từ dashboard)             |
| Dashboard            | ✅ Real API + Thông tin cá nhân card   |
| Timeline             | ✅ Real API                            |
| Tier Card            | ✅ Dynamic themeConfig                 |
| Rewards              | ✅ Real API                            |
| Vouchers             | ✅ Real API                            |
| QR Code              | ✅ Có                                  |
| Staff Pages          | ✅ Home + Scan + Manual Bill + Approve |

### Frontend (Web Admin - Next.js)

| Component          | Route                | Status                               |
| ------------------ | -------------------- | ------------------------------------ |
| Admin Login        | `/login`             | ✅ Phone + Password + Cookie auth    |
| Dashboard          | `/`                  | ✅ Stats cards + recent activity     |
| Members List       | `/members`           | ✅ Search + filter + pagination      |
| Member Detail      | `/members/[id]`      | ✅ Detail + transactions + referrals |
| Transactions List  | `/transactions`      | ✅ Status tabs + pagination          |
| Transaction Detail | `/transactions/[id]` | ✅ Bill info + items + customer      |
| Rewards            | `/rewards`           | ✅ Catalog + discount tiers          |
| Tiers              | `/tiers`             | ✅ Tier config display               |
| Fraud Alerts       | `/fraud`             | ✅ Alerts list                       |
| Branch Management  | `/branches`          | ✅ List + inline edit                |
| Sidebar + Logout   | —                    | ✅ Navigation + logout               |
| Reports            | —                    | ⬜ Chưa làm                          |
| System Settings    | —                    | ⬜ Chưa làm                          |

---

_Plan tạo bởi Antigravity — Gap Analysis PRD v4.0_
_Cập nhật: 2026-03-23_
