// ══════════════════════════════════════════════════════════
// E2E Test — Full Flow: Member + Staff
// Run: npx ts-node test/full-flow.e2e-test.ts
// ══════════════════════════════════════════════════════════

const BASE_URL = process.env.API_URL || 'http://localhost:3003';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
  data?: any;
}

const results: TestResult[] = [];
let memberToken = '';
let staffToken = '';
let memberId = '';
let memberPhone = '';
let staffPhone = '';

// ─── Helpers ───────────────────────────────────────────
async function req(
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

function test(name: string, pass: boolean, detail: string, data?: any) {
  results.push({ name, pass, detail, data });
  const icon = pass ? '✅' : '❌';
  console.log(`  ${icon} ${name}`);
  if (!pass) console.log(`     → ${detail}`);
}

// ═══════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════
async function runTests() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🧪 E2E Test — Full Flow Member + Staff  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // ─── 1. HEALTH CHECK ───────────────────────────────
  console.log('📡 1. Health Check');
  try {
    const { status, data } = await req('GET', '/');
    test('Server is running', status === 200, `Status: ${status}`, data);
  } catch (e: any) {
    test('Server is running', false, `Cannot connect: ${e.message}`);
    printSummary();
    return;
  }

  // ─── 2. MEMBER LOGIN ──────────────────────────────
  console.log('\n👤 2. Member Auth Flow');

  // 2a. Login with new phone → should create member
  memberPhone = `09${Date.now().toString().slice(-8)}`;
  {
    const { status, data } = await req('POST', '/auth/phone-login', { phone: memberPhone });
    const pass = status === 201 && data.accessToken && data.userType === 'member';
    test('Member login (new phone)', pass, `Status: ${status}, UserType: ${data.userType}`);
    if (pass) {
      memberToken = data.accessToken;
      memberId = data.member?.id;
      test('  → isNewUser = true', data.isNewUser === true, `Got: ${data.isNewUser}`);
      test('  → Has memberId', !!memberId, `ID: ${memberId}`);
    }
  }

  // 2b. Login again → existing member
  {
    const { status, data } = await req('POST', '/auth/phone-login', { phone: memberPhone });
    const pass = status === 201 && data.isNewUser === false;
    test('Member login (existing)', pass, `Status: ${status}, isNewUser: ${data.isNewUser}`);
  }

  // 2c. Get profile (GET /auth/me)
  {
    const { status, data } = await req('GET', '/auth/me', undefined, memberToken);
    const pass = status === 200 && data.userType === 'member';
    test('GET /auth/me (member)', pass, `Status: ${status}, userType: ${data.userType}`);
  }

  // 2d. GET /auth/me without token → 401
  {
    const { status } = await req('GET', '/auth/me');
    test('GET /auth/me (no token) → 401', status === 401, `Status: ${status}`);
  }

  // ─── 3. MEMBER REFERRAL ───────────────────────────
  console.log('\n🤝 3. Referral Flow');

  // 3a. Get referees (empty for new member)
  {
    const { status, data } = await req('GET', '/referrals/my-referees', undefined, memberToken);
    const pass = status === 200 && Array.isArray(data);
    test('GET /referrals/my-referees', pass, `Status: ${status}, Count: ${Array.isArray(data) ? data.length : 'N/A'}`);
  }

  // ─── 4. STAFF LOGIN ───────────────────────────────
  console.log('\n👨‍💼 4. Staff Auth Flow');

  // 4a. Find a staff phone from DB
  // We'll try known staff phones or use the search endpoint
  // First, try to login as staff — we need a phone that exists in the staff table
  const staffPhones = ['0900000001', '0900000002', '0111111111'];
  let staffLoginSuccess = false;

  for (const phone of staffPhones) {
    const { status, data } = await req('POST', '/auth/phone-login', { phone });
    if (status === 201 && data.userType === 'staff') {
      staffToken = data.accessToken;
      staffPhone = phone;
      staffLoginSuccess = true;
      test(`Staff login (${phone})`, true, `Role: ${data.staff?.role}, Branch: ${data.staff?.branchId}`);
      break;
    }
  }

  if (!staffLoginSuccess) {
    // If no predefined staff found, note it
    test('Staff login (predefined phones)', false, 'No staff found with test phones. Trying to find staff...');

    // Try to get staff info from DB via a raw query approach
    // We'll skip staff tests if no staff exists
    console.log('  ⚠️  No staff account found. Skipping staff-specific tests.');
    console.log('  💡 To run staff tests, ensure staff records exist in the database.');
    printSummary();
    return;
  }

  // 4b. GET /auth/me (staff)
  {
    const { status, data } = await req('GET', '/auth/me', undefined, staffToken);
    const pass = status === 200 && data.userType === 'staff';
    test('GET /auth/me (staff)', pass, `Status: ${status}, Role: ${data.role}`);
  }

  // ─── 5. STAFF: SEARCH MEMBER ─────────────────────
  console.log('\n🔍 5. Staff — Search Member');

  // 5a. Search with valid phone
  {
    const { status, data } = await req('GET', `/api/v1/transactions/search-member?phone=${memberPhone}`, undefined, staffToken);
    const pass = status === 200 && data.success === true && data.data?.id === memberId;
    test(`Search member (${memberPhone})`, pass, `Found: ${data.data?.fullName || data.data?.phone || 'N/A'}`);
  }

  // 5b. Search with non-existent phone → 404
  {
    const { status } = await req('GET', '/api/v1/transactions/search-member?phone=0999999999', undefined, staffToken);
    test('Search non-existent member → 404', status === 404, `Status: ${status}`);
  }

  // 5c. Search with too short query
  {
    const { status, data } = await req('GET', '/api/v1/transactions/search-member?phone=09', undefined, staffToken);
    const pass = status === 200 && data.data === null;
    test('Search with short query → null', pass, `Status: ${status}`);
  }

  // 5d. Search without token → 401
  {
    const { status } = await req('GET', `/api/v1/transactions/search-member?phone=${memberPhone}`);
    test('Search without token → 401', status === 401, `Status: ${status}`);
  }

  // 5e. Search with member token → 403 (staff only)
  {
    const { status } = await req('GET', `/api/v1/transactions/search-member?phone=${memberPhone}`, undefined, memberToken);
    test('Search with member token → 403', status === 403, `Status: ${status}`);
  }

  // ─── 6. STAFF: MANUAL BILL ───────────────────────
  console.log('\n📝 6. Staff — Manual Bill Entry');

  const testBillCode = `TEST-${Date.now()}`;

  // 6a. Create manual bill (valid)
  {
    const { status, data } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: testBillCode,
      amount: 350000,
      member_id: memberId,
    }, staffToken);
    const pass = status === 201 && data.success === true;
    test('Create manual bill', pass, `Status: ${status}, Msg: ${data.message}`);
    if (pass) {
      test('  → status = pending_review', data.data?.status === 'pending_review', `Got: ${data.data?.status}`);
      test('  → source = staff_manual', data.data?.source === 'staff_manual', `Got: ${data.data?.source}`);
      test('  → amount = 350000', Number(data.data?.amount) === 350000, `Got: ${data.data?.amount}`);
    }
  }

  // 6b. Duplicate bill code → 409
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: testBillCode,
      amount: 200000,
      member_id: memberId,
    }, staffToken);
    test('Duplicate bill code → 409', status === 409, `Status: ${status}`);
  }

  // 6c. Invalid member_id → 404
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: `FAKE-${Date.now()}`,
      amount: 100000,
      member_id: '00000000-0000-0000-0000-000000000000',
    }, staffToken);
    test('Invalid member_id → 404', status === 404, `Status: ${status}`);
  }

  // 6d. Missing required fields → 400
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: 'TEST-X',
      // amount missing
      // member_id missing
    }, staffToken);
    test('Missing required fields → 400', status === 400, `Status: ${status}`);
  }

  // 6e. Create bill without token → 401
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: 'NO-AUTH',
      amount: 100000,
      member_id: memberId,
    });
    test('Create bill without token → 401', status === 401, `Status: ${status}`);
  }

  // 6f. Create bill with member token → 403
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: 'MEMBER-TOKEN',
      amount: 100000,
      member_id: memberId,
    }, memberToken);
    test('Create bill with member token → 403', status === 403, `Status: ${status}`);
  }

  // ─── 7. VALIDATION EDGE CASES ────────────────────
  console.log('\n🛡️ 7. Validation & Edge Cases');

  // 7a. Login with empty phone
  {
    const { status } = await req('POST', '/auth/phone-login', { phone: '' });
    test('Login with empty phone → 400', status === 400 || status === 401, `Status: ${status}`);
  }

  // 7b. Login with referral code
  {
    const { status, data } = await req('POST', '/auth/phone-login', {
      phone: `08${Date.now().toString().slice(-8)}`,
      refCode: 'FAKE-REF-CODE',
    });
    // Should still create member even with invalid ref code (refCode is optional)
    test('Login with fake refCode', status === 201, `Status: ${status}, isNewUser: ${data?.isNewUser}`);
  }

  // 7c. Manual bill with negative amount
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: `NEG-${Date.now()}`,
      amount: -100,
      member_id: memberId,
    }, staffToken);
    test('Negative amount → 400', status === 400, `Status: ${status}`);
  }

  // 7d. Manual bill with zero amount
  {
    const { status } = await req('POST', '/api/v1/transactions/manual', {
      pos_bill_code: `ZERO-${Date.now()}`,
      amount: 0,
      member_id: memberId,
    }, staffToken);
    test('Zero amount → 400', status === 400, `Status: ${status}`);
  }

  // ─── SUMMARY ──────────────────────────────────────
  printSummary();
}

function printSummary() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const total = results.length;

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║            📊 KẾT QUẢ TỔNG HỢP          ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  ✅ Đạt:    ${String(passed).padEnd(4)} / ${total}                    ║`);
  console.log(`║  ❌ Lỗi:    ${String(failed).padEnd(4)} / ${total}                    ║`);
  console.log(`║  📈 Tỷ lệ:  ${total > 0 ? Math.round((passed / total) * 100) : 0}%                          ║`);
  console.log('╚══════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n🔴 Các test FAIL:');
    results
      .filter((r) => !r.pass)
      .forEach((r) => console.log(`   ❌ ${r.name}: ${r.detail}`));
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

// ─── RUN ────────────────────────────────────────────
runTests().catch((err) => {
  console.error('💥 Test runner crashed:', err);
  process.exit(1);
});
