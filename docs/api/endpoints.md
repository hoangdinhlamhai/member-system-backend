# API Documentation - Member System Backend

Updated at: 2026-03-19
Base URL: `http://localhost:3003`

---

## 🔐 Authentication

### POST /auth/phone-login
Đăng nhập bằng SĐT. Tự tạo member nếu chưa có, trả JWT.

### GET /auth/me
Thông tin user hiện tại từ JWT.

---

## 👤 Members (ZMA - Public & Auth)

### GET /api/v1/members/me/dashboard 🔒
Dashboard: profile, tier hiện tại, themeConfig, monthly stats, progress lên hạng.

### GET /api/v1/members/me/timeline 🔒
Timeline xen kẽ bill cá nhân + hoa hồng referral, sort mới nhất, phân trang.

**Query:** `?page=1&limit=20`

### GET /api/v1/members/rewards
Danh sách quà đổi điểm (active). **Public — không cần auth.**

**Response (200):**
```json
[
  {
    "id": "uuid", "name": "Cà phê sữa đá", "description": "...",
    "imageUrl": "☕", "type": "drink", "pointsRequired": 200,
    "quantityRedeemed": 15, "isActive": true
  }
]
```

### GET /api/v1/members/discount-tiers
Các mức giảm giá bill bằng điểm. **Public — không cần auth.**

**Response (200):**
```json
[
  {
    "id": "uuid", "pointsRequired": 100,
    "discountPercent": 5, "maxDiscountAmount": 100000,
    "description": "Giảm 5% cho hóa đơn"
  }
]
```

### GET /api/v1/members/me/vouchers 🔒
Voucher đã đổi của member hiện tại.

**Response (200):**
```json
[
  {
    "id": "uuid", "type": "discount", "title": "Giảm 5% Tổng Bill",
    "voucherCode": "ZDC-D-1234", "qrData": "ZDC:VOUCHER:ZDC-D-1234",
    "status": "active", "expiresAt": "2026-04-01T00:00:00Z"
  }
]
```

---

## 💼 Transactions

### POST /api/v1/transactions/manual 🔒 (Staff)
Staff nhập bill tay → status: pending_review.

### GET /api/v1/transactions/pending 🔒 (Manager)
List bill chờ duyệt.

### GET /api/v1/transactions/search-member 🔒
Tìm member theo SĐT. `?phone=0901234567`

### PATCH /api/v1/transactions/:id/approve 🔒 (Manager)
Duyệt bill → cộng spending + check thăng hạng + referral 5%.

### PATCH /api/v1/transactions/:id/reject 🔒 (Manager)
Từ chối bill. Body: `{ "reason": "..." }`

---

## 🔗 Webhook

### POST /api/v1/webhook/cukcuk
POS CUKCUK gọi khi có bill mới. Signature guard, idempotent by pos_bill_id.
- Member found → auto_approved + cộng spending + referral
- Member not found → pending_review (bill mồ côi)

---

## 🛡️ Admin APIs

> Tất cả admin API đều ở prefix `/api/v1/admin/`

### Members

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/admin/members` | Danh sách + search (`?q=`) + pagination (`?page=&perPage=`) |
| GET | `/admin/members/:id` | Chi tiết (kèm referrals, tiers, transactions, point history) |
| POST | `/admin/members` | Tạo mới (auto referralCode + link referrer + assign default tier) |
| PATCH | `/admin/members/:id` | Sửa (phone, zaloName, fullName — check dup phone) |
| DELETE | `/admin/members/:id` | Xóa (chặn nếu có GD, cascade cleanup) |
| PATCH | `/admin/members/:id/adjust-points` | Cộng/trừ điểm |
| GET | `/admin/members/stats/overview` | Thống kê tổng quan |

**POST /admin/members Body:**
```json
{
  "phone": "0901234567",
  "zaloName": "Nguyễn Văn A",
  "fullName": "Nguyễn Văn A",
  "referrerCode": "ZDC-ABC123"
}
```

**PATCH /admin/members/:id/adjust-points Body:**
```json
{ "type": "admin_add", "points": 100, "note": "Bù điểm lỗi hệ thống" }
```

### Tiers

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/admin/tiers` | Danh sách hạng thẻ |
| POST | `/admin/tiers` | Tạo hạng mới |
| PATCH | `/admin/tiers/:id` | Sửa hạng |
| DELETE | `/admin/tiers/:id` | Xóa hạng |

### Rewards & Discounts

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/admin/rewards` | Danh sách quà + discount tiers |
| POST | `/admin/rewards` | Tạo quà mới |
| DELETE | `/admin/rewards/:id` | Xóa quà |
| POST | `/admin/rewards/discount-tiers` | Tạo mức giảm giá |
| DELETE | `/admin/rewards/discount-tiers/:id` | Xóa mức giảm giá |

### System Configs

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/admin/configs` | Danh sách configs + branches |
| POST | `/admin/configs` | Tạo config |
| PATCH | `/admin/configs/:id` | Sửa config |
| DELETE | `/admin/configs/:id` | Xóa config |

---

🔒 = Yêu cầu JWT token: `Authorization: Bearer <token>`
