# Script test luồng Zalo Login (Mock Mode)
# Đảm bảo NestJS đang chạy: npm run start:dev

$BASE_URL = "http://localhost:3000"

Write-Host "--- 1. Testing Zalo Login (New User) ---" -ForegroundColor Cyan
$loginBody = @{
    accessToken = "mock-token"
    phoneToken = "mock-phone-token"
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "$BASE_URL/auth/zalo-login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "Success! New User Created."
    Write-Host ($loginRes | ConvertTo-Json)
    $token = $loginRes.accessToken
} catch {
    Write-Host "Login Failed: $_" -ForegroundColor Red
    exit
}

Write-Host "`n--- 2. Testing JWT Protected Route (/auth/me) ---" -ForegroundColor Cyan
try {
    $headers = @{ Authorization = "Bearer $token" }
    $meRes = Invoke-RestMethod -Uri "$BASE_URL/auth/me" -Method Get -Headers $headers
    Write-Host "Success! Token is valid."
    Write-Host ($meRes | ConvertTo-Json)
} catch {
    Write-Host "Auth/Me Failed: $_" -ForegroundColor Red
}

Write-Host "`n--- 3. Testing Login with Referral Code ---" -ForegroundColor Cyan
# Lấy mã refCode của user vừa tạo
$refCode = $loginRes.member.referralCode
Write-Host "Using Ref Code: $refCode"

# Giả lập user 2 logout và login (Dùng Zalo ID khác bằng cách tắt mock mode hoặc sửa code, 
# nhưng ở đây chúng ta test logic validate refCode trước)
$loginBodyRef = @{
    accessToken = "mock-token" # Sẽ dùng ID cũ vì mock cố định ID, nên logic sẽ là Update thay vì Create
    phoneToken = "mock-phone-token"
    refCode = $refCode
} | ConvertTo-Json

try {
    $loginResRef = Invoke-RestMethod -Uri "$BASE_URL/auth/zalo-login" -Method Post -Body $loginBodyRef -ContentType "application/json"
    Write-Host "Success! Login with Ref Code completed."
    Write-Host ($loginResRef | ConvertTo-Json)
} catch {
    Write-Host "Login with Ref Failed: $_" -ForegroundColor Red
}

Write-Host "`n--- TEST COMPLETED ---" -ForegroundColor Green
Write-Host "Hãy mở Prisma Studio để kiểm tra các record trong bảng Member và Referral."
