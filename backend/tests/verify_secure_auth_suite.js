const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../database/db');
const { getTestOtp } = require('../utils/emailService');
const { JWT_SECRET } = require('../middleware/auth');

console.log('========================================================================');
console.log('  SECURE AUTHENTICATION TEST MATRIX (EMAIL OTP + GOOGLE SIGN-IN)');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

async function step(title, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${title}`);
    console.error(`     Reason: ${err.message}`);
    failed++;
  }
}

function apiRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (dataString) {
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

function cleanupTestMembers() {
  try {
    db.exec(`
      DELETE FROM auth_otps WHERE email LIKE '%matrix%' OR email LIKE '%test%' OR email = 'akhilesh@library.com';
      DELETE FROM members WHERE email = 'matrix.member@example.com';
    `);
  } catch (_) {}
}

async function runSecurityMatrix() {
  process.env.NODE_ENV = 'test';
  cleanupTestMembers();

  const librarianEmail = 'akhilesh@library.com';
  const librarianPassword = 'Password@123';

  // 1. Valid email + wrong password -> Rejected (401) & no OTP issued
  await step('[Matrix 01] Valid email + wrong password -> 401 Rejected (No OTP generated)', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: librarianEmail,
      password: 'WrongPassword123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.otp_required, undefined);
    assert.strictEqual(res.body.token, undefined);
  });

  // 2. Fake / unregistered email + password -> Rejected (401 generic error)
  await step('[Matrix 02] Fake email + password -> 401 Rejected (Generic error, no enumeration)', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'fake-user-999@example.invalid',
      password: 'AnyPassword@123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.otp_required, undefined);
    assert.strictEqual(res.body.token, undefined);
  });

  // 3. Fake Member Code -> Rejected (401)
  await step('[Matrix 03] Fake Member Code -> 401 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'MEM-999999',
      password: 'AnyPassword@123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 4. Fake email + fake OTP attempt -> Rejected (400)
  await step('[Matrix 04] Fake email + fake OTP attempt -> 400 Rejected', async () => {
    const fakeToken = jwt.sign({ purpose: 'OTP_VERIFY', otp_type: 'LOGIN', email: 'fake@example.com' }, JWT_SECRET, { expiresIn: '5m' });
    const res = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: fakeToken,
      otp: '123456'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 5. Valid email + correct password -> Receives OTP prompt & NO final JWT
  let loginTempToken = null;
  await step('[Matrix 05] Valid email + correct password -> 200 OK with OTP required & NO JWT token', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: librarianEmail,
      password: librarianPassword
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.otp_required, true);
    assert.ok(res.body.temp_token, 'Must return temp_token for verification');
    assert.ok(res.body.email_masked, 'Must return masked email');
    assert.strictEqual(res.body.token, undefined, 'Must NOT return final auth JWT before OTP verification');
    loginTempToken = res.body.temp_token;
  });

  // 6. Security Check: Cannot access protected API with temp_token
  await step('[Matrix 06] Security Barrier: Temporary OTP token cannot access protected APIs (403/401)', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${loginTempToken}`
    });
    assert.strictEqual(res.status, 403);
  });

  // 7. Valid email + wrong OTP -> Rejected (400) & increments attempt counter
  await step('[Matrix 07] Valid email + wrong OTP -> 400 Rejected & attempt counted', async () => {
    const res = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: loginTempToken,
      otp: '000000'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('incorrect'));
  });

  // 8. Valid email + correct OTP -> Authenticated (200 + final JWT + role)
  let librarianJwt = null;
  await step('[Matrix 08] Valid email + correct OTP -> 200 OK Authenticated with final JWT', async () => {
    const correctOtp = getTestOtp(librarianEmail);
    assert.ok(correctOtp, 'Test OTP must be retrieved from secure test store');

    const res = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: loginTempToken,
      otp: correctOtp
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Must issue final JWT');
    assert.strictEqual(res.body.user.role, 'Librarian');
    assert.strictEqual(res.body.user.email, librarianEmail);
    librarianJwt = res.body.token;
  });

  // 9. Reused OTP -> Rejected (400 single-use enforcement)
  await step('[Matrix 09] Reused OTP -> 400 Rejected (Single-use enforcement)', async () => {
    const correctOtp = getTestOtp(librarianEmail);
    const res = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: loginTempToken,
      otp: correctOtp
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 10. Multi-step Member Registration Flow with OTP
  const newMemberEmail = 'matrix.member@example.com';
  const newMemberPass = 'MemberPass@2026';
  let regTempToken = null;

  await step('[Matrix 10] Registration Step 1: Valid details -> 200 OK with OTP sent', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Pooja Verma',
      email: newMemberEmail,
      phone: '+91 91234 56789',
      password: newMemberPass,
      confirm_password: newMemberPass
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.otp_required, true);
    assert.ok(res.body.temp_token);
    regTempToken = res.body.temp_token;
  });

  // 11. Registration OTP verification -> 201 Created & Active Member
  let newMemberCode = null;
  await step('[Matrix 11] Registration Step 2: Correct OTP -> 201 Created & Member activated', async () => {
    const regOtp = getTestOtp(newMemberEmail);
    assert.ok(regOtp, 'Registration test OTP must exist');

    const res = await apiRequest('POST', '/api/auth/verify-register-otp', {
      temp_token: regTempToken,
      otp: regOtp
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, newMemberEmail);
    assert.strictEqual(res.body.user.status, 'Active');
    assert.ok(res.body.user.member_code);
    newMemberCode = res.body.user.member_code;
  });

  // 12. Valid Member Code + wrong password -> 401 Rejected
  await step('[Matrix 12] Valid Member Code + wrong password -> 401 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: newMemberCode,
      password: 'WrongPassword'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 13. Valid Member Code + correct password -> 200 OK with OTP sent to verified email
  let memberLoginTempToken = null;
  await step('[Matrix 13] Valid Member Code + correct password -> 200 OK with OTP sent to registered email', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: newMemberCode,
      password: newMemberPass
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.otp_required, true);
    assert.ok(res.body.temp_token);
    memberLoginTempToken = res.body.temp_token;
  });

  // 14. Member Login OTP verification -> 200 Authenticated with Member JWT
  let memberJwt = null;
  await step('[Matrix 14] Member Login OTP verification -> 200 Authenticated with Member JWT', async () => {
    const memberOtp = getTestOtp(newMemberEmail);
    assert.ok(memberOtp);

    const res = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: memberLoginTempToken,
      otp: memberOtp
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.member_code, newMemberCode);
    memberJwt = res.body.token;
  });

  // 15. Google Sign-In with Authorized Existing Library Account
  await step('[Matrix 15] Google Sign-In: Authorized existing account -> 200 OK Authenticated', async () => {
    const testGoogleToken = `test_google_token_${librarianEmail}`;
    const res = await apiRequest('POST', '/api/auth/google', {
      id_token: testGoogleToken
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'Librarian');
  });

  // 16. Google Sign-In with Unauthorized / Unregistered Google Account -> 403 Rejected
  await step('[Matrix 16] Google Sign-In: Unauthorized Google account -> 403 Rejected (No auto-creation)', async () => {
    const testGoogleToken = `test_google_token_unregistered.stranger@gmail.com`;
    const res = await apiRequest('POST', '/api/auth/google', {
      id_token: testGoogleToken
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('No library account is associated'));
  });

  // 17. Rate Limiting: OTP Resend Cooldown (45s)
  await step('[Matrix 17] Rate Limiting: Resend OTP before 45s cooldown -> 429 Too Many Requests', async () => {
    // Initiate fresh login
    const loginRes = await apiRequest('POST', '/api/auth/login', {
      email: librarianEmail,
      password: librarianPassword
    });
    const token = loginRes.body.temp_token;

    // Immediately attempt resend
    const resendRes = await apiRequest('POST', '/api/auth/resend-otp', {
      temp_token: token
    });
    assert.strictEqual(resendRes.status, 429);
    assert.strictEqual(resendRes.body.success, false);
    assert.ok(resendRes.body.message.includes('wait'));
  });

  // 18. Too many failed OTP attempts -> Blocked / Invalidated
  await step('[Matrix 18] Brute Force Defense: 5 failed OTP attempts invalidates code', async () => {
    // Initiate login
    const loginRes = await apiRequest('POST', '/api/auth/login', {
      email: newMemberEmail,
      password: newMemberPass
    });
    const token = loginRes.body.temp_token;

    // Send 5 incorrect attempts
    for (let i = 0; i < 5; i++) {
      await apiRequest('POST', '/api/auth/verify-otp', {
        temp_token: token,
        otp: `99999${i}`
      });
    }

    // Attempt with correct OTP should now be rejected as invalidated
    const correctOtp = getTestOtp(newMemberEmail);
    const finalRes = await apiRequest('POST', '/api/auth/verify-otp', {
      temp_token: token,
      otp: correctOtp
    });
    assert.strictEqual(finalRes.status, 400);
    assert.strictEqual(finalRes.body.success, false);
    assert.ok(finalRes.body.message.includes('Too many failed attempts') || finalRes.body.message.includes('incorrect or expired'));
  });

  // 19. Role Isolation: Member JWT attempting staff endpoint -> 403 Forbidden
  await step('[Matrix 19] Role Isolation: Member token accessing Librarian endpoint -> 403 Forbidden', async () => {
    const res = await apiRequest('POST', '/api/loans/issue', {
      book_id: 1,
      member_id: 1
    }, {
      'Authorization': `Bearer ${memberJwt}`
    });
    assert.strictEqual(res.status, 403);
  });

  // 20. Member Token accessing Member Profile -> 200 OK
  await step('[Matrix 20] Member Portal Access: Member token accessing GET /api/auth/me -> 200 OK', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${memberJwt}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, newMemberEmail);
  });

  // 21. Librarian Token accessing Librarian Dashboard -> 200 OK
  await step('[Matrix 21] Librarian Portal Access: Librarian token accessing GET /api/dashboard/stats -> 200 OK', async () => {
    const res = await apiRequest('GET', '/api/dashboard/stats', null, {
      'Authorization': `Bearer ${librarianJwt}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data || res.body.stats);
  });

  console.log('\n========================================================================');
  console.log(`  SECURITY MATRIX RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`Security test matrix failed with ${failed} failure(s).`);
  }
}

if (require.main === module) {
  runSecurityMatrix().catch(err => {
    console.error('Test execution error:', err.message);
    process.exit(1);
  });
}

module.exports = { runSecurityMatrix };
