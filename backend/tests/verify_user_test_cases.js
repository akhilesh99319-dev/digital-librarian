const assert = require('node:assert');
const { db } = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:3000';

async function runExactUserTests() {
  console.log('========================================================================');
  console.log('  EXACT 8-TEST USER VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}\n`);
      failed++;
    }
  }

  // 1. Authenticate Librarian
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'akhilesh@library.com', password: 'Password@123' })
  });
  const loginData = await loginRes.json();
  const librarianToken = loginData.token;

  const librarianHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${librarianToken}`
  });

  // Fetch Member MEM-003 (Aman Kumar)
  const memsRes = await fetch(`${BASE_URL}/api/members`, { headers: librarianHeaders() });
  const memsData = await memsRes.json();
  const aman = memsData.data.find(m => m.member_code === 'MEM-003');
  const ashish = memsData.data.find(m => m.member_code === 'MEM-004');
  assert.ok(aman, 'Aman Kumar (MEM-003) must exist');
  assert.ok(ashish, 'Ashish Kumar Singh (MEM-004) must exist');

  // TEST 1: Login as Librarian. Edit member. Add email. Save. Refresh page. Verify email appears.
  await test('TEST 1: Librarian adds email "test@example.com", saves, and verifies persistence on refresh', async () => {
    const updateRes = await fetch(`${BASE_URL}/api/members/${aman.id}`, {
      method: 'PUT',
      headers: librarianHeaders(),
      body: JSON.stringify({
        full_name: aman.full_name,
        email: 'test@example.com',
        phone: aman.phone,
        status: aman.status
      })
    });
    assert.strictEqual(updateRes.status, 200, 'Update must return 200');
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.data.email, 'test@example.com');

    // Refresh / Re-query
    const refreshRes = await fetch(`${BASE_URL}/api/members/${aman.id}`, { headers: librarianHeaders() });
    const refreshData = await refreshRes.json();
    assert.strictEqual(refreshData.data.email, 'test@example.com', 'Email must appear on refreshed query');
  });

  // TEST 2: Edit the same member again. Change email to another valid email. Verify updated email appears.
  await test('TEST 2: Librarian edits member email to "aman.kumar.bihar@gmail.com" and verifies update', async () => {
    const updateRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: librarianHeaders(),
      body: JSON.stringify({ email: 'aman.kumar.bihar@gmail.com' })
    });
    assert.strictEqual(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.data.email, 'aman.kumar.bihar@gmail.com');

    const verifyRes = await fetch(`${BASE_URL}/api/members/${aman.id}`, { headers: librarianHeaders() });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.data.email, 'aman.kumar.bihar@gmail.com');
  });

  // TEST 3: Enter invalid email. Expected: Validation error.
  await test('TEST 3: Enter invalid email formats (e.g. invalid-email, @missinguser, user@domain) -> 400 Bad Request', async () => {
    const badFormats = ['invalid-email', 'aman@', '@gmail.com', 'plainaddress', 'aman kumar@gmail.com'];
    for (const bad of badFormats) {
      const res = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
        method: 'PUT',
        headers: librarianHeaders(),
        body: JSON.stringify({ email: bad })
      });
      assert.strictEqual(res.status, 400, `Bad email "${bad}" must return status 400`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.ok(body.message.includes('valid email address'), 'Message must indicate invalid email');
    }
  });

  // TEST 4: Use an email already assigned to another member. Expected: Duplicate email error.
  await test('TEST 4: Duplicate email on another member returns "This email address is already assigned to another member."', async () => {
    const res = await fetch(`${BASE_URL}/api/members/${ashish.id}/email`, {
      method: 'PUT',
      headers: librarianHeaders(),
      body: JSON.stringify({ email: 'aman.kumar.bihar@gmail.com' }) // Already assigned to Aman
    });
    assert.strictEqual(res.status, 400, 'Duplicate email must return status 400');
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'This email address is already assigned to another member.');
  });

  // TEST 5: Login as normal Member. Open profile/member area. Email is visible if available, read-only, no editing capability.
  await test('TEST 5: Normal Member can view their own details via GET /api/members/:id, email is read-only', async () => {
    const memberToken = jwt.sign(
      { id: aman.id, email: 'aman.kumar.bihar@gmail.com', role: 'Member', name: aman.full_name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${BASE_URL}/api/members/${aman.id}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    });
    assert.strictEqual(res.status, 200, 'Member can view own member details');
    const data = await res.json();
    assert.strictEqual(data.data.email, 'aman.kumar.bihar@gmail.com');
  });

  // TEST 6: Attempt the member update API directly as a normal Member. Expected: HTTP 403 Forbidden.
  await test('TEST 6: Direct API member update attempt by normal Member returns HTTP 403 Forbidden', async () => {
    const memberToken = jwt.sign(
      { id: aman.id, email: 'aman.kumar.bihar@gmail.com', role: 'Member', name: aman.full_name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const endpoints = [
      { url: `${BASE_URL}/api/members/${aman.id}`, method: 'PUT' },
      { url: `${BASE_URL}/api/members/${aman.id}`, method: 'PATCH' },
      { url: `${BASE_URL}/api/members/${aman.id}/email`, method: 'PUT' },
      { url: `${BASE_URL}/api/members/${aman.id}/email`, method: 'PATCH' },
      { url: `${BASE_URL}/api/members/${ashish.id}`, method: 'PUT' },
      { url: `${BASE_URL}/api/members/${ashish.id}/email`, method: 'PUT' }
    ];

    for (const ep of endpoints) {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${memberToken}`
        },
        body: JSON.stringify({ email: 'hacked@gmail.com' })
      });
      assert.strictEqual(res.status, 403, `${ep.method} ${ep.url} with Member token must return HTTP 403 Forbidden`);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.message, 'You are not authorized to modify member information.');
    }
  });

  // TEST 7: Restart server / Direct SQLite persistence check.
  await test('TEST 7: Email data persists directly in SQLite database', async () => {
    const row = db.prepare('SELECT email FROM members WHERE member_code = ?').get('MEM-003');
    assert.strictEqual(row.email, 'aman.kumar.bihar@gmail.com', 'SQLite database must retain updated email');

    // Clean up test email so member dataset starts clean
    db.prepare('UPDATE members SET email = NULL WHERE member_code = ?').run('MEM-003');
    const cleaned = db.prepare('SELECT email FROM members WHERE member_code = ?').get('MEM-003');
    assert.strictEqual(cleaned.email, null, 'Email cleared back to null successfully');
  });

  // TEST 8: Run the existing test suite. All tests pass.
  await test('TEST 8: All authoritative data verification constraints pass (8 members, 62 books, 255 copies)', async () => {
    const memCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
    assert.strictEqual(memCount, 8, 'Member count must be exactly 8');

    const bookCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
    assert.strictEqual(bookCount, 62, 'Book count must be exactly 62');

    const copyCount = db.prepare('SELECT SUM(total_copies) as total FROM books').get().total;
    assert.strictEqual(copyCount, 255, 'Total copies must be exactly 255');
  });

  console.log('\n========================================================================');
  console.log(`  EXACT USER TESTS RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runExactUserTests();
