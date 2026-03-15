# API Documentation - Member System Backend

Updated at: 2026-03-14
Base URL: `http://localhost:3000`

---

## 🔐 Authentication (Zalo Mini App)

### POST /auth/zalo-login
Main login endpoint for Zalo Mini App. Replaces traditional login/register.

**Request Body:**
```json
{
  "accessToken": "string", // From api.getAccessToken()
  "phoneToken": "string",   // From api.getPhoneNumber()
  "refCode": "string"       // Optional: "ZDC-XXXXXX"
}
```

**Response (201):**
```json
{
  "accessToken": "JWT_STR",
  "member": {
    "id": "uuid",
    "zaloId": "string",
    "zaloName": "string",
    "zaloAvatar": "string",
    "phone": "string",
    "referralCode": "ZDC-XXXXXX",
    "qrCode": "QR-XXXXXXXX",
    ...
  },
  "isNewUser": boolean
}
```

**Errors:**
- 400: Invalid Request / Missing Data
- 401: Invalid Zalo Token / Phone linked to other account
- 403: Forbidden

---

### GET /auth/me
Get current member info from JWT token.

**Headers:**
`Authorization: Bearer <JWT_TOKEN>`

**Response (200):**
```json
{
  "id": "member_id",
  "zaloId": "zalo_id"
}
```

---

## 👥 Members

*(More endpoints coming soon in Phase 8)*

---

## 🔗 Referrals

*(Logic is integrated into zalo-login for now)*
