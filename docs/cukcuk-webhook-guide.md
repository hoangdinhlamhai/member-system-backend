# 🔌 CUKCUK POS Webhook — Integration Guide

> **Project:** Zô Dứt Cạn Loyalty System
> **Endpoint:** `POST /api/v1/webhook/cukcuk`
> **Version:** 1.0 (MVP)
> **Last updated:** 2026-03-18

---

## 📑 Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Endpoint & Authentication](#2-endpoint--authentication)
3. [Request Format](#3-request-format)
4. [Response Format](#4-response-format)
5. [Business Logic Flow](#5-business-logic-flow)
6. [Test Scenarios](#6-test-scenarios)
7. [Error Handling](#7-error-handling)
8. [Ghi chú Production](#8-ghi-chú-production)

---

## 1. Tổng quan

Webhook nhận dữ liệu hóa đơn realtime từ máy tính tiền **CUKCUK POS**. Khi khách hàng thanh toán tại quầy, CUKCUK gửi thông tin bill qua webhook để loyalty system:

- Ghi nhận giao dịch cho member
- Cộng doanh số (`lifetime_spending`, `monthly_spending`)
- Kiểm tra & thăng hạng tự động
- Xử lý hoa hồng giới thiệu 5% (referral engine)

### Nguyên tắc quan trọng

| Nguyên tắc | Mô tả |
|------------|--------|
| **Always 200 OK** | Webhook luôn trả `200` để POS không retry sai |
| **Idempotent** | Trùng `pos_bill_id` → skip, không tạo duplicate |
| **Atomic** | Toàn bộ logic trong 1 `prisma.$transaction` |
| **Orphan Bills** | SĐT không tìm thấy member → lưu `pending_review` (staff claim sau) |

---

## 2. Endpoint & Authentication

### URL

```
POST {BASE_URL}/api/v1/webhook/cukcuk
```

| Environment | Base URL |
|-------------|----------|
| Local Dev | `http://localhost:3003` |
| Production | `https://api.zodutcan.vn` *(TBD)* |

### Headers (Bắt buộc)

| Header | Type | Required | Mô tả |
|--------|------|----------|--------|
| `Content-Type` | string | ✅ | `application/json` |
| `X-CUKCUK-Signature` | string | ✅ | Signature xác thực webhook |

### Authentication

**MVP (hiện tại):**
```
X-CUKCUK-Signature: secret_123
```

> ⚠️ **Production:** Sẽ upgrade lên HMAC-SHA256 per-branch. Xem [Ghi chú Production](#8-ghi-chú-production).

---

## 3. Request Format

### Body Schema

```jsonc
{
  "branch_id": "string",        // (required) CUKCUK branch ID, mapping sang branches.cukcuk_branch_id
  "customer_phone": "string",   // (optional) SĐT khách hàng
  "customer_id": "string",      // (optional) Customer ID trên CUKCUK
  "invoice": {                  // (required) Thông tin hóa đơn
    "id": "string",             // (required) ID bill duy nhất từ CUKCUK (dùng để idempotent check)
    "code": "string",           // (optional) Mã hóa đơn hiển thị, VD: "HD-20260317-001"
    "total_amount": 200000,      // (required) Tổng tiền (number, đơn vị: VND)
    "discount_amount": 0,       // (optional) Giảm giá. Default: 0
    "final_amount": 200000,      // (optional) Thực thu. Default: total_amount - discount_amount
    "created_at": "2026-03-18T10:30:00+07:00",  // (optional) Thời gian tạo bill trên POS (ISO 8601)
    "items": [                  // (optional) Chi tiết món
      {
        "item_name": "Trà sữa trân châu",  // (required) Tên món
        "quantity": 2,                       // (required) Số lượng
        "unit_price": 45000,                 // (required) Đơn giá
        "amount": 90000                      // (required) Thành tiền
      }
    ]
  }
}
```

### Validation Rules

| Field | Rule |
|-------|------|
| `branch_id` | Không rỗng, phải match `branches.cukcuk_branch_id` trong DB |
| `customer_phone` | Optional. Nếu có → tìm member theo SĐT |
| `invoice.id` | Không rỗng, unique. Nếu trùng → skip |
| `invoice.total_amount` | Số nguyên, đơn vị VND |
| `invoice.items[].item_name` | Không rỗng |
| `invoice.items[].quantity` | Số |
| `invoice.items[].unit_price` | Số |
| `invoice.items[].amount` | Số |

---

## 4. Response Format

### Thành công (200 OK)

```jsonc
{
  "success": true,
  "message": "Đã ghi nhận bill HD-001 cho 0901234567",
  "data": {
    "transactionId": "clxxx...",           // ID giao dịch được tạo
    "tierPromotion": {                      // null nếu không thăng hạng
      "fromTierName": "Bạc",
      "toTierName": "Vàng",
      "pointsMultiplier": 1.5
    },
    "referral": {                           // null nếu không có referrer
      "referrerId": "clyyy...",
      "earnAmount": 10000,                  // 5% hoa hồng (VND)
      "pointsAwarded": 10                   // Điểm cho referrer (1000đ = 1 điểm)
    }
  }
}
```

### Bill trùng (Idempotent — vẫn 200 OK)

```json
{
  "success": true,
  "message": "Bill đã được xử lý trước đó.",
  "data": {
    "transactionId": "clxxx...",
    "tierPromotion": null,
    "referral": null
  }
}
```

### Bill mồ côi — SĐT không tìm thấy member (200 OK)

```json
{
  "success": true,
  "message": "Bill mồ côi (SĐT 0909999888 chưa đăng ký), đã lưu pending.",
  "data": {
    "transactionId": "clxxx...",
    "tierPromotion": null,
    "referral": null
  }
}
```

### Branch không tồn tại (200 OK)

```json
{
  "success": true,
  "message": "Branch không tồn tại, đã bỏ qua.",
  "data": {
    "transactionId": null,
    "tierPromotion": null,
    "referral": null
  }
}
```

### Lỗi Signature (401 Unauthorized)

```json
{
  "statusCode": 401,
  "message": "Missing webhook signature"
}
```

```json
{
  "statusCode": 401,
  "message": "Invalid webhook signature"
}
```

---

## 5. Business Logic Flow

```
CUKCUK POS gửi webhook
        │
        ▼
┌─────────────────────┐
│ Guard: Check Header  │
│ X-CUKCUK-Signature   │
│ ✗ → 401 Unauthorized │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ Tìm Branch          │
│ by cukcuk_branch_id  │
│ ✗ → 200 (skip)      │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ Check bill trùng     │
│ by pos_bill_id       │
│ Trùng → 200 (skip)  │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ Tìm Member           │
│ by customer_phone    │
│ ✗ → Bill mồ côi     │
│      pending_review  │
└─────────┬───────────┘
          ▼
  ╔═══════════════════╗
  ║ prisma.$transaction║
  ║ (Atomic Block)     ║
  ╠═══════════════════╣
  ║ 1. Tạo Transaction║
  ║    auto_approved   ║
  ║                    ║
  ║ 2. Cộng doanh số  ║
  ║    lifetime +      ║
  ║    monthly         ║
  ║                    ║
  ║ 3. Thăng hạng     ║
  ║    lifetime →      ║
  ║    check tiers     ║
  ║                    ║
  ║ 4. Referral 5%    ║
  ║    hoa hồng →     ║
  ║    điểm referrer  ║
  ╚═══════════════════╝
          ▼
    Return 200 OK
```

### Chi tiết từng bước

#### Bước 3 — Thăng hạng tự động

| Hạng | Min Spending | Points Multiplier |
|------|--------------|-------------------|
| Đồng | 0đ | x1.0 |
| Bạc | 2,000,000đ | x1.2 |
| Vàng | 5,000,000đ | x1.5 |
| Bạch Kim | 15,000,000đ | x2.0 |
| Kim Cương | 50,000,000đ | x3.0 |

- So sánh `lifetime_spending` mới với bảng tiers
- Nếu đạt hạng cao hơn → insert `tier_histories` + ghi log

#### Bước 4 — Referral Engine

- Nếu member có `referred_by` (người giới thiệu):
  - Tính **5% giá trị bill** → hoa hồng
  - Quy đổi: `1,000đ = 1 điểm` → cộng điểm cho referrer
  - Tạo `referral_earnings` (lịch sử hoa hồng)
  - Tạo `point_transactions` (lịch sử điểm)
  - Nếu referral đang `pending` → chuyển `active` (lần đầu referee có bill)

---

## 6. Test Scenarios

### 6.1 ❌ Missing Signature

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json

{
  "branch_id": "CK-BRANCH-001",
  "customer_phone": "0901234567",
  "invoice": {
    "id": "BILL-TEST-001",
    "total_amount": 200000
  }
}
```

**Expected:** `401 Unauthorized` — `"Missing webhook signature"`

---

### 6.2 ❌ Wrong Signature

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json
X-CUKCUK-Signature: wrong_secret

{
  "branch_id": "CK-BRANCH-001",
  "customer_phone": "0901234567",
  "invoice": {
    "id": "BILL-TEST-002",
    "total_amount": 200000
  }
}
```

**Expected:** `401 Unauthorized` — `"Invalid webhook signature"`

---

### 6.3 ✅ Valid Member — Full Flow

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json
X-CUKCUK-Signature: secret_123

{
  "branch_id": "CK-BRANCH-001",
  "customer_phone": "0901234567",
  "invoice": {
    "id": "BILL-TEST-003",
    "code": "HD-20260318-001",
    "total_amount": 250000,
    "discount_amount": 50000,
    "final_amount": 200000,
    "created_at": "2026-03-18T10:30:00+07:00",
    "items": [
      {
        "item_name": "Trà sữa trân châu",
        "quantity": 2,
        "unit_price": 45000,
        "amount": 90000
      },
      {
        "item_name": "Bánh mì thịt nướng",
        "quantity": 1,
        "unit_price": 35000,
        "amount": 35000
      }
    ]
  }
}
```

**Expected:** `200 OK` — Transaction created, spending updated, tier promotion & referral result included if applicable.

---

### 6.4 ✅ Duplicate Bill (Idempotent)

Gửi lại request 6.3 **cùng `invoice.id`** = `"BILL-TEST-003"`.

**Expected:** `200 OK` — `"Bill đã được xử lý trước đó."` — Không tạo transaction mới.

---

### 6.5 ✅ Orphan Bill — Customer Not Registered

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json
X-CUKCUK-Signature: secret_123

{
  "branch_id": "CK-BRANCH-001",
  "customer_phone": "0999888777",
  "invoice": {
    "id": "BILL-TEST-005",
    "code": "HD-20260318-002",
    "total_amount": 150000,
    "final_amount": 150000
  }
}
```

**Expected:** `200 OK` — Transaction `status=pending_review`, `member_id=null`. Staff có thể claim sau.

---

### 6.6 ✅ No Customer Phone

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json
X-CUKCUK-Signature: secret_123

{
  "branch_id": "CK-BRANCH-001",
  "invoice": {
    "id": "BILL-TEST-006",
    "code": "HD-20260318-003",
    "total_amount": 100000
  }
}
```

**Expected:** `200 OK` — Bill mồ côi (khách vãng lai, không nhập SĐT).

---

### 6.7 ✅ Unknown Branch

```http
POST /api/v1/webhook/cukcuk
Content-Type: application/json
X-CUKCUK-Signature: secret_123

{
  "branch_id": "CK-UNKNOWN-999",
  "customer_phone": "0901234567",
  "invoice": {
    "id": "BILL-TEST-007",
    "total_amount": 100000
  }
}
```

**Expected:** `200 OK` — `"Branch không tồn tại, đã bỏ qua."` — Không tạo transaction.

---

## 7. Error Handling

| Tình huống | HTTP Status | Xử lý |
|------------|-------------|--------|
| Missing `X-CUKCUK-Signature` | `401` | Guard reject |
| Wrong `X-CUKCUK-Signature` | `401` | Guard reject |
| Branch không tồn tại | `200` | Skip, log warning |
| Bill trùng `pos_bill_id` | `200` | Skip, return existing transaction ID |
| Member không tìm thấy | `200` | Tạo bill mồ côi `pending_review` |
| Validation fail (missing required fields) | `400` | DTO validation pipe |
| Server error (DB down, etc.) | `500` | NestJS default handler |

> **Tại sao luôn trả 200?**
> Vì CUKCUK POS sẽ retry khi nhận non-2xx. Nếu trả 500 khi bill trùng → POS retry vô hạn. Chỉ signature lỗi (401) mới là reject thực sự.

---

## 8. Ghi chú Production

### 🔐 Signature Upgrade

MVP đang dùng static string `secret_123`. Production cần:

```
HMAC-SHA256(request_body, webhook_secret_per_branch)
```

**Kế hoạch:**
1. Thêm column `webhook_secret` vào bảng `branches`
2. Guard lấy `branch_id` từ body → query secret → verify HMAC
3. Header format: `X-CUKCUK-Signature: sha256={hmac_hex}`

### 📱 ZNS Notifications (TODO)

Có 3 TODO trong code chờ implement:

| Event | Recipient | Message template |
|-------|-----------|------------------|
| Bill ghi nhận | Member | `"Bill {code} đã được ghi nhận: {amount}đ"` |
| Hoa hồng referral | Referrer | `"Bạn nhận được {points} điểm từ {refereeName}"` |
| Thăng hạng | Member | `"Chúc mừng lên hạng {tierName}! x{multiplier} điểm"` |

### 🔄 Monthly Spending Reset

`monthly_spending` hiện chỉ cộng dồn, chưa có cron job reset đầu tháng.

### 🏪 Seed Data (Test)

| Data | Value |
|------|-------|
| Branch 1 | `cukcuk_branch_id = "CK-BRANCH-001"` (Q1) |
| Branch 2 | `cukcuk_branch_id = "CK-BRANCH-002"` (Q3) |
| Test member | Phone: `0901234567` |
| Manager | Phone: `0912345678` |
| Cashier | Phone: `0987654321` |

---

## 📁 Source Files

| File | Mô tả |
|------|--------|
| `src/webhook/webhook.controller.ts` | Controller — route `POST /api/v1/webhook/cukcuk` |
| `src/webhook/webhook.service.ts` | Service — business logic (transaction, tier, referral) |
| `src/webhook/dto/cukcuk-webhook.dto.ts` | DTO — validation schema cho payload |
| `src/webhook/guards/cukcuk-signature.guard.ts` | Guard — verify `X-CUKCUK-Signature` header |
| `src/webhook/webhook.module.ts` | Module — imports PrismaModule |

---

*Generated from source code — Zô Dứt Cạn Loyalty System*
