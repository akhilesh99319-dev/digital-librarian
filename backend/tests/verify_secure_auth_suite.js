const assert = require('node:assert');
const http = require('node:http');
const { db } = require('../database/db');

console.log('========================================================================');
console.log('  SECURE AUTHENTICATION TEST MATRIX (DIRECT EMAIL/CODE + PASSWORD)');
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
      DELETE FROM members WHERE email IN ('matrix.member@example.com', 'direct.member@example.com');
      DELETE FROM auth_otps;
    `);
  } catch (_) {}
}

async function runSecurityMatrix() {
  process.env.NODE_ENV = 'test';
  cleanupTestMembers();

  const librarianEmail = 'akhilesh@library.com';
  const librarianPassword = 'Password@123';

  // 1. Case A — Registered account + correct password -> PASS Direct login (200 + JWT + role)
  let librarianJwt = null;
  await step('[Case A] Registered account + correct password -> 200 OK Direct login with JWT (No OTP, No Google)', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: librarianEmail,
      password: librarianPassword
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.otp_required, undefined, 'Must NOT require OTP');
    assert.strictEqual(res.body.temp_token, undefined, 'Must NOT return temp_token');
    assert.ok(res.body.token, 'Must return authoritative JWT token directly');
    assert.ok(res.body.user, 'Must return user object');
    assert.strictEqual(res.body.user.role, 'Librarian');
    assert.strictEqual(res.body.user.email, librarianEmail);
    librarianJwt = res.body.token;
  });

  // 2. Case B — Fake / unregistered email -> FAIL LOGIN (401 Generic error, no JWT, no enumeration)
  await step('[Case B] Fake/unregistered email -> 401 Rejected (Generic error, no JWT/session, no enumeration)', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'fake.nonexistent.user999@example.invalid',
      password: 'AnyPassword@123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.token, undefined);
    assert.strictEqual(res.body.temp_token, undefined);
    assert.strictEqual(res.body.message, 'Invalid email/member code or password.');
  });

  // 3. Case C — Registered account + wrong password -> FAIL LOGIN (401 Generic error, no OTP, no JWT)
  await step('[Case C] Registered account + wrong password -> 401 Rejected (No OTP, no JWT/session)', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: librarianEmail,
      password: 'WrongPassword123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.token, undefined);
    assert.strictEqual(res.body.temp_token, undefined);
    assert.strictEqual(res.body.message, 'Invalid email/member code or password.');
  });

  // 4. Missing email or password in login -> 400 Bad Request
  await step('[Validation] Empty credentials -> 400 Bad Request', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: '',
      password: ''
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 5. Member Code Login + Password -> 200 OK Direct login
  await step('[Member Code Login] Registered Member Code (MEM-001) + default password -> 200 OK Direct login', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'MEM-001',
      password: 'Member@123'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Must return JWT token directly');
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.member_code, 'MEM-001');
  });

  // 6. Member Code + wrong password -> 401 Rejected
  await step('[Member Code Login] Registered Member Code + wrong password -> 401 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'MEM-001',
      password: 'IncorrectPassword'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.token, undefined);
  });

  // 7. Fake Member Code -> 401 Rejected
  await step('[Member Code Login] Fake Member Code (MEM-999999) -> 401 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: 'MEM-999999',
      password: 'AnyPassword@123'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 8. Direct Member Registration without OTP -> 201 Created & Member Activated
  const newMemberEmail = 'direct.member@example.com';
  const newMemberPass = 'MemberPass@2026';
  let createdMemberCode = null;

  await step('[Registration] Direct registration without OTP -> 201 Created & Active Member', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Pooja Verma',
      email: newMemberEmail,
      phone: '+91 91234 56789',
      password: newMemberPass,
      confirm_password: newMemberPass
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.otp_required, undefined, 'Must NOT require OTP');
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.name, 'Pooja Verma');
    assert.strictEqual(res.body.user.email, newMemberEmail);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.status, 'Active');
    assert.ok(res.body.user.member_code.startsWith('MEM-'));
    createdMemberCode = res.body.user.member_code;
  });

  // 9. Registration: Duplicate email against members table -> 400 Rejected
  await step('[Registration Duplicate] Re-registering duplicate email -> 400 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Duplicate Person',
      email: newMemberEmail,
      password: newMemberPass,
      confirm_password: newMemberPass
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'An account with this email already exists.');
  });

  // 10. Registration: Duplicate email against users table -> 400 Rejected
  await step('[Registration Duplicate] Registering with existing Librarian email -> 400 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Librarian Clone',
      email: librarianEmail,
      password: 'Password@999',
      confirm_password: 'Password@999'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'An account with this email already exists.');
  });

  // 11. Registration Validations (name, email, password length, mismatch)
  await step('[Registration Validation] Short password (<6 chars) -> 400 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Test Person',
      email: 'shortpass.user@example.com',
      password: '123',
      confirm_password: '123'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await step('[Registration Validation] Password confirmation mismatch -> 400 Rejected', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Test Person',
      email: 'mismatch.user@example.com',
      password: 'Password@123',
      confirm_password: 'DifferentPassword@123'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 12. Login with newly registered member credentials -> 200 OK Direct login
  let memberJwt = null;
  await step('[Login Integration] Newly registered member logs in directly -> 200 OK with JWT', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: newMemberEmail,
      password: newMemberPass
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, newMemberEmail);
    assert.strictEqual(res.body.user.member_code, createdMemberCode);
    memberJwt = res.body.token;
  });

  // 13. Role Routing & Identity Verification on Protected Endpoint
  await step('[Role Routing] Librarian accessing /api/auth/me returns Librarian role', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${librarianJwt}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'Librarian');
    assert.strictEqual(res.body.user.email, librarianEmail);
  });

  await step('[Role Routing] Member accessing /api/auth/me returns Member role & member_code', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${memberJwt}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, newMemberEmail);
    assert.strictEqual(res.body.user.member_code, createdMemberCode);
  });

  // 14. Access protected route without token -> 401 Unauthorized
  await step('[Protected Route] Request without Authorization header -> 401 Unauthorized', async () => {
    const res = await apiRequest('GET', '/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  // 15. Access protected route with invalid/tampered token -> 403 Forbidden
  await step('[Protected Route] Request with forged/tampered JWT -> 403 Forbidden', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': 'Bearer invalid.forged.jwt_token_12345'
    });
    assert.strictEqual(res.status, 403);
  });

  // 16. Verify POST /api/auth/google endpoint is removed (404 Not Found)
  await step('[Google Cleanup] POST /api/auth/google endpoint is completely removed -> 404 Not Found', async () => {
    const res = await apiRequest('POST', '/api/auth/google', {
      id_token: 'any_google_token'
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  cleanupTestMembers();

  console.log('\n========================================================================');
  console.log(`  AUTHENTICATION VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runSecurityMatrix().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
