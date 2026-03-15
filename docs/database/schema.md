# Database Schema Overview

Updated at: 2026-03-14
Powered by: PostgreSQL + Prisma

## Entity: Member (Thành viên)
Lưu trữ thông tin người dùng từ Zalo và hệ thống tích điểm.

| Field | Type | Description |
|---|---|---|
| id | Int (PK) | Auto-increment ID |
| zaloId | String (Unique) | Unique ID từ Zalo |
| zaloName | String? | Tên hiển thị trên Zalo |
| zaloAvatar | String? | URL ảnh đại diện Zalo |
| phone | String? (Unique) | Số điện thoại (format: 0xxxxxxxxx) |
| referralCode | String (Unique) | Mã giới thiệu cá nhân (ZDC-XXXXXX) |
| qrCode | String (Unique) | Mã QR cá nhân (QR-XXXXXXXX) |
| status | String | verified / pending / banned |
| pointsBalance | Float | Số dư điểm hiện tại |
| referredById | Int? (FK) | ID của người đã giới thiệu (F0) |

## Entity: Referral (Quan hệ giới thiệu)
Ghi lại lịch sử ai giới thiệu ai.

| Field | Type | Description |
|---|---|---|
| id | Int (PK) | Auto-increment ID |
| referrerId | Int (FK) | Người đi giới thiệu |
| refereeId | Int (FK, Unique) | Người được giới thiệu |
| status | String | pending (chờ bill đầu) / active / invalid |
| createdAt | DateTime | Thời gian giới thiệu |

## Relationships
- **Member (Referrer) -> Member (Referee)**: One-to-Many qua `referredById`.
- **Referral Table**: Lưu chi tiết quan hệ giới thiệu 1-1 giữa Referrer và Referee.
