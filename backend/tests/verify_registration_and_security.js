const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { db } = require('../database/db');
const { getTestOtp } = require('../utils/emailService');

console.log('================================================================');
console.log('  USER REGISTRATION & SECURITY VERIFICATION SUITE');
console.log('================================================================\n');

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

async function performOtpLogin(email, password) {
  const loginRes = await apiRequest('POST', '/api/auth/login', { email, password });
  if (loginRes.status !== 200 || !loginRes.body.temp_token) {
    return loginRes;
  }
  const otp = getTestOtp(email);
  return await apiRequest('POST', '/api/auth/verify-otp', {
    temp_token: loginRes.body.temp_token,
    otp
  });
}

async function performOtpRegister(payload) {
  const regRes = await apiRequest('POST', '/api/auth/register', payload);
  if (regRes.status !== 200 || !regRes.body.temp_token) {
    return regRes;
  }
  const otp = getTestOtp(payload.email);
  return await apiRequest('POST', '/api/auth/verify-register-otp', {
    temp_token: regRes.body.temp_token,
    otp
  });
}

async function runAllTests() {
  const testRegEmail = 'test.newuser@example.com';
  const testRegPassword = 'SecureUser@2026';

  // 1. Missing name validation
  await step('Registration: Missing name returns HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: '',
      email: 'noname@example.com',
      password: testRegPassword
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('Full name is required'));
  });

  // 2. Invalid email validation
  await step('Registration: Invalid email format returns HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Test Person',
      email: 'invalid-email-address',
      password: testRegPassword
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('valid email'));
  });

  // 3. Short password validation
  await step('Registration: Short password (<6 chars) returns HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Test Person',
      email: 'shortpass@example.com',
      password: '123'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('at least 6 characters'));
  });

  // 4. Password mismatch validation
  await step('Registration: Password mismatch returns HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Test Person',
      email: 'mismatch@example.com',
      password: 'Password@123',
      confirm_password: 'DifferentPassword@123'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('match'));
  });

  // 5. Successful registration
  let createdUserId = null;
  await step('Registration: Valid payload creates account with HTTP 201', async () => {
    const res = await performOtpRegister({
      name: 'Rohit Sharma',
      email: testRegEmail,
      phone: '+91 98765 11111',
      password: testRegPassword,
      confirm_password: testRegPassword
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.name, 'Rohit Sharma');
    assert.strictEqual(res.body.user.email, testRegEmail);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.status, 'Active');
    assert.ok(res.body.user.member_code.startsWith('MEM-'));
    // Security check: no passwords or hashes returned
    assert.strictEqual(res.body.user.password, undefined);
    assert.strictEqual(res.body.user.password_hash, undefined);
    assert.strictEqual(res.body.password, undefined);
    assert.strictEqual(res.body.password_hash, undefined);

    createdUserId = res.body.user.id;
  });

  // 6. Duplicate email protection against members table
  await step('Registration: Duplicate email against members table returns safe HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Duplicate Person',
      email: testRegEmail,
      password: 'Password@456'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'An account with this email already exists.');
  });

  // 7. Duplicate email protection against users table (e.g. librarian account)
  await step('Registration: Duplicate email against users table returns safe HTTP 400', async () => {
    const res = await apiRequest('POST', '/api/auth/register', {
      name: 'Imposter User',
      email: 'akhilesh@library.com',
      password: 'Password@456'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'An account with this email already exists.');
  });

  // 8. Role Security: Attempting to register as Admin or Librarian is forced to Member
  await step('Role Security: Passing privileged role (Admin/Librarian) is forced to Member', async () => {
    const res = await performOtpRegister({
      name: 'Sneaky User',
      email: 'sneaky.admin@example.com',
      password: testRegPassword,
      role: 'Admin'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.role, 'Member');

    // Verify directly in database
    const dbRow = db.prepare('SELECT * FROM members WHERE email = ?').get('sneaky.admin@example.com');
    assert.ok(dbRow, 'Member record must exist in members table');

    const adminCheck = db.prepare('SELECT * FROM users WHERE email = ?').get('sneaky.admin@example.com');
    assert.strictEqual(adminCheck, undefined, 'Must NOT exist in users/admin table');
  });

  // 9. Password security: bcrypt hash stored in database, not plaintext
  await step('Password Security: Password is stored as a valid bcrypt hash, never plaintext', async () => {
    const member = db.prepare('SELECT * FROM members WHERE email = ?').get(testRegEmail);
    assert.ok(member, 'Member must exist in database');
    assert.ok(member.password_hash, 'Password hash must not be empty');
    assert.notStrictEqual(member.password_hash, testRegPassword, 'Password must not be plaintext');
    assert.ok(member.password_hash.startsWith('$2a$') || member.password_hash.startsWith('$2b$'), 'Must be a bcrypt hash');
    const matches = bcrypt.compareSync(testRegPassword, member.password_hash);
    assert.strictEqual(matches, true, 'bcrypt compare must succeed');
  });

  // 10. Login integration: Newly registered member can log in and receives JWT with role Member
  let memberToken = null;
  await step('Login Integration: Newly registered member can log in via /api/auth/login', async () => {
    const res = await performOtpLogin(testRegEmail, testRegPassword);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, testRegEmail);
    memberToken = res.body.token;
  });

  // 11. Invalid login for member fails
  await step('Login Integration: Invalid password for registered member returns HTTP 401', async () => {
    const res = await apiRequest('POST', '/api/auth/login', {
      email: testRegEmail,
      password: 'WrongPassword'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // 12. Authenticated endpoint: GET /api/auth/me returns registered member details
  await step('Auth Endpoint: GET /api/auth/me returns Member details for new user', async () => {
    const res = await apiRequest('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${memberToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'Member');
    assert.strictEqual(res.body.user.email, testRegEmail);
  });

  // 13. Regression Check: Existing Librarian login still works perfectly
  await step('Regression: Librarian login with akhilesh@library.com still works', async () => {
    const res = await performOtpLogin('akhilesh@library.com', 'Password@123');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'Librarian');
  });

  // 14. Static Security Check: Frontend files do not contain visible dev credentials or autofill
  await step('Production Security Check: No dev credentials or autofill in frontend files', async () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '../../frontend/login.html'), 'utf8');
    const authJs = fs.readFileSync(path.join(__dirname, '../../frontend/assets/js/auth.js'), 'utf8');

    assert.ok(!loginHtml.includes('Development Login Credentials'), 'login.html must not contain Development Login Credentials');
    assert.ok(!loginHtml.includes('Auto-fill Credentials'), 'login.html must not contain Auto-fill Credentials');
    assert.ok(!loginHtml.includes('quickFillBtn'), 'login.html must not contain quickFillBtn');
    assert.ok(!loginHtml.includes('Password@123'), 'login.html must not expose Password@123');

    assert.ok(!authJs.includes('quickFillBtn'), 'auth.js must not contain quickFillBtn');
    assert.ok(!authJs.includes('Password@123'), 'auth.js must not contain Password@123');
    assert.ok(!authJs.includes('akhilesh@library.com'), 'auth.js must not contain hardcoded demo email');
  });

  // 15. Member Redirect Target & Dashboard Verification (Phase 13.2)
  await step('Member Redirect Verification: Target is /dashboard.html and serves HTTP 200', async () => {
    const authJs = fs.readFileSync(path.join(__dirname, '../../frontend/assets/js/auth.js'), 'utf8');
    const commonJs = fs.readFileSync(path.join(__dirname, '../../frontend/assets/js/common.js'), 'utf8');

    assert.ok(!authJs.includes('member-portal.html'), 'auth.js must not reference member-portal.html');
    assert.ok(!commonJs.includes('member-portal.html'), 'common.js must not reference member-portal.html');
    assert.ok(authJs.includes('/dashboard.html'), 'auth.js must redirect Member to /dashboard.html');
    assert.ok(commonJs.includes('/dashboard.html'), 'common.js must route Member to /dashboard.html');

    const dashboardPath = path.join(__dirname, '../../frontend/dashboard.html');
    assert.ok(fs.existsSync(dashboardPath), 'frontend/dashboard.html must exist');

    const myBooksPath = path.join(__dirname, '../../frontend/my-books.html');
    assert.ok(fs.existsSync(myBooksPath), 'frontend/my-books.html must exist');

    const dashRes = await apiRequest('GET', '/dashboard.html');
    assert.strictEqual(dashRes.status, 200, 'Express server must serve /dashboard.html with HTTP 200');

    const myBooksRes = await apiRequest('GET', '/my-books.html');
    assert.strictEqual(myBooksRes.status, 200, 'Express server must serve /my-books.html with HTTP 200');

    const portal404Res = await apiRequest('GET', '/member-portal.html');
    assert.strictEqual(portal404Res.status, 404, '/member-portal.html must return HTTP 404');
  });

  // 16. Book API Security: Member cannot create/update/delete books; can read catalog
  await step('Book API Security: Member write operations blocked (403), Read operations allowed (200)', async () => {
    // Member login
    const memLoginRes = await performOtpLogin(testRegEmail, testRegPassword);
    assert.strictEqual(memLoginRes.status, 200);
    const memberToken = memLoginRes.body.token;
    const memberHeaders = { 'Authorization': `Bearer ${memberToken}` };

    // Member GET /api/books -> 200
    const getRes = await apiRequest('GET', '/api/books?limit=100', null, memberHeaders);
    assert.strictEqual(getRes.status, 200);
    assert.ok(Array.isArray(getRes.body.data));
    assert.strictEqual(getRes.body.data.length, 62);
    assert.strictEqual(getRes.body.pagination.total, 62);

    // Member POST /api/books -> 403
    const postRes = await apiRequest('POST', '/api/books', {
      title: 'Hacked Book',
      author: 'Attacker',
      category_id: 1,
      isbn: '978-9999999999'
    }, memberHeaders);
    assert.strictEqual(postRes.status, 403, 'Member POST /api/books must return 403 Forbidden');

    // Member PUT /api/books/1 -> 403
    const putRes = await apiRequest('PUT', '/api/books/1', {
      title: 'Hacked Title'
    }, memberHeaders);
    assert.strictEqual(putRes.status, 403, 'Member PUT /api/books/1 must return 403 Forbidden');

    // Member DELETE /api/books/1 -> 403
    const delRes = await apiRequest('DELETE', '/api/books/1', null, memberHeaders);
    assert.strictEqual(delRes.status, 403, 'Member DELETE /api/books/1 must return 403 Forbidden');

    // Unauthenticated POST /api/books -> 401
    const unauthPost = await apiRequest('POST', '/api/books', {
      title: 'Unauth Book',
      author: 'Ghost',
      category_id: 1,
      isbn: '978-8888888888'
    });
    assert.strictEqual(unauthPost.status, 401, 'Unauthenticated POST /api/books must return 401 Unauthorized');
  });

  // 16. Clean up test members created during test
  await step('Database Cleanup: Remove test-created members and verify baseline integrity', async () => {
    db.exec(`
      DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM members WHERE id > 8);
      DELETE FROM members WHERE id > 8;
    `);

    const countRow = db.prepare('SELECT COUNT(*) as count FROM members').get();
    assert.strictEqual(Number(countRow.count), 8, 'Member count must be exactly 8 seeded members');
  });

  console.log('\n================================================================');
  console.log(`  REGISTRATION & SECURITY SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exitCode = 1;
});
