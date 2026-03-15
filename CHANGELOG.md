# Changelog - Member System Backend

## [2026-03-14] - Zalo Auth Implementation (Phases 1-7)

### Added
- **Core Infrastructure**: Integrated Prisma with PostgreSQL (Neon), JWT Authentication, and Global Config.
- **Zalo Integration**: Implemented `ZaloService` to verify profile and decrypt phone numbers from Zalo Mini App SDK.
- **Authentication**: `AuthModule` with `/auth/zalo-login` and `/auth/me` protected by JWT.
- **User Management**: `MembersService` handles automatic account creation, phone deduplication, and auto-generation of QR/Referral codes.
- **Referral System**: `ReferralsService` tracks F1 relationships (referrer/referee) with strict validation and pending status.
- **Testing Tools**: Added `test-zalo-auth.ps1` and `ZALO_MOCK_MODE` for local development without real Zalo tokens.

### Changed
- Refactored `AppModule` to include `Prisma`, `Zalo`, `Auth`, `Members`, and `Referrals` modules.
- Updated `.env` with JWT and Zalo credentials.

### Fixed
- Resolved Prisma connection issues by using `pgbouncer=true` and `PrismaService` lifecycle hooks.
- Fixed JWT expiresIn type casting errors.
