const assert = require('node:assert');
const { db } = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const BASE_URL = 'http://localhost:3000';

async function runFeatureVerification() {
  console.log('========================================================================');
  console.log('  16-POINT COMPLETE FEATURE & SPECIFICATION VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function step(num, title, fn) {
    try {
      await fn();
      console.log(`  [TEST ${String(num).padStart(2, '0')}] ✅ PASS: ${title}`);
      passed++;
    } catch (err) {
      console.error(`  [TEST ${String(num).padStart(2, '0')}] ❌ FAIL: ${title}`);
      console.error(`           Reason: ${err.message}\n`);
      failed++;
    }
  }

  let token = '';

  // 1. Librarian login
  await step(1, 'Librarian login with valid credentials (akhilesh@library.com)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'akhilesh@library.com', password: 'Password@123' })
    });
    assert.strictEqual(res.status, 200, 'Login HTTP status must be 200');
    const data = await res.json();
    assert.ok(data.token, 'Must receive JWT auth token');
    assert.strictEqual(data.user.role, 'Librarian', 'Role must be Librarian');
    token = data.token;
  });

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // 2. Open Members page / API endpoint
  let membersList = [];
  await step(2, 'Open Members page / query GET /api/members', async () => {
    const res = await fetch(`${BASE_URL}/api/members`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200, 'Members endpoint must return 200');
    const body = await res.json();
    assert.ok(body.success, 'Response must be success');
    membersList = body.data;
  });

  // 3. Verify all 8 members are present
  await step(3, 'Verify exactly 8 members are present', async () => {
    assert.strictEqual(membersList.length, 8, `Expected 8 members, got ${membersList.length}`);
  });

  // 4. Verify existing member names and IDs are unchanged
  const expectedMembers = [
    { code: 'MEM-001', name: 'Akhilesh Kumar' },
    { code: 'MEM-002', name: 'Chandra Mohan Thakur' },
    { code: 'MEM-003', name: 'Aman Kumar' },
    { code: 'MEM-004', name: 'Ashish Kumar Singh' },
    { code: 'MEM-005', name: 'Sonali Kumari' },
    { code: 'MEM-006', name: 'Sonam Kumari' },
    { code: 'MEM-007', name: 'Manish Kumar' },
    { code: 'MEM-008', name: 'Nishu Kumari' }
  ];

  await step(4, 'Verify existing member names and IDs (MEM-001 through MEM-008) are unchanged', async () => {
    for (const em of expectedMembers) {
      const found = membersList.find(m => m.member_code === em.code);
      assert.ok(found, `Member with code ${em.code} must exist`);
      assert.strictEqual(found.full_name, em.name, `Member ${em.code} name must be ${em.name}`);
    }
  });

  // 5. Verify email is initially empty/null where no email exists
  await step(5, 'Verify email is initially empty/null (no fake emails seeded)', async () => {
    for (const m of membersList) {
      assert.ok(m.email === null || m.email === '', `Member ${m.member_code} must not have fake seeded email, got: ${m.email}`);
    }
  });

  // 6. Add a Gmail address to one member (e.g. Chandra Mohan Thakur MEM-002)
  const targetMember = membersList.find(m => m.member_code === 'MEM-002');
  const testGmail1 = 'cm.thakur.patna@gmail.com';
  await step(6, 'Add a Gmail address to member MEM-002 via PUT /api/members/:id/email', async () => {
    const res = await fetch(`${BASE_URL}/api/members/${targetMember.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: testGmail1 })
    });
    assert.strictEqual(res.status, 200, 'Adding email must return 200');
    const data = await res.json();
    assert.strictEqual(data.data.email, testGmail1);
  });

  // 7. Save verification
  await step(7, 'Save verification: response confirms email update success', async () => {
    const res = await fetch(`${BASE_URL}/api/members/${targetMember.id}`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.data.email, testGmail1);
  });

  // 8. Refresh the Members page / re-query GET /api/members
  let refreshedList = [];
  await step(8, 'Refresh / Re-fetch Members list (GET /api/members)', async () => {
    const res = await fetch(`${BASE_URL}/api/members`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    refreshedList = body.data;
  });

  // 9. Verify the Gmail persists
  await step(9, 'Verify the saved Gmail persists in the refreshed member list', async () => {
    const mem = refreshedList.find(m => m.member_code === 'MEM-002');
    assert.ok(mem, 'MEM-002 must exist in refreshed list');
    assert.strictEqual(mem.email, testGmail1, 'Refreshed member must retain saved Gmail');
  });

  // 10. Edit the same Gmail
  const testGmail2 = 'cm.thakur.updated2026@gmail.com';
  await step(10, 'Edit the same Gmail address to a new value', async () => {
    const res = await fetch(`${BASE_URL}/api/members/${targetMember.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: testGmail2 })
    });
    assert.strictEqual(res.status, 200, 'Updating email must return 200');
    const data = await res.json();
    assert.strictEqual(data.data.email, testGmail2);
  });

  // 11. Verify the updated value persists
  await step(11, 'Verify the updated Gmail value persists on re-query', async () => {
    const res = await fetch(`${BASE_URL}/api/members/${targetMember.id}`, { headers: authHeaders() });
    const data = await res.json();
    assert.strictEqual(data.data.email, testGmail2, 'Updated email must persist');
  });

  // 12. Verify invalid email is rejected
  await step(12, 'Verify invalid email formats are rejected with 400 Bad Request', async () => {
    const invalidEmails = ['invalid-email', 'cm.thakur@', '@gmail.com', 'plainaddress', 'cm thakur@gmail.com'];
    for (const bad of invalidEmails) {
      const res = await fetch(`${BASE_URL}/api/members/${targetMember.id}/email`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ email: bad })
      });
      assert.strictEqual(res.status, 400, `Bad email "${bad}" must return status 400`);
    }
  });

  // 13. Verify unauthorized/non-Librarian users cannot update member email
  await step(13, 'Verify unauthorized (unauthenticated or non-Librarian) cannot update email', async () => {
    // A) No token (401)
    const unauthRes = await fetch(`${BASE_URL}/api/members/${targetMember.id}/email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unauth@gmail.com' })
    });
    assert.strictEqual(unauthRes.status, 401, 'Request without token must return 401');

    // B) Member role token (403)
    const memberToken = jwt.sign({ id: targetMember.id, email: 'member@library.com', role: 'Member', name: targetMember.full_name }, JWT_SECRET, { expiresIn: '1h' });
    const forbiddenRes = await fetch(`${BASE_URL}/api/members/${targetMember.id}/email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({ email: 'patron@gmail.com' })
    });
    assert.strictEqual(forbiddenRes.status, 403, 'Request with Member role must return 403');
  });

  // 14. Verify member count remains exactly 8
  await step(14, 'Verify member count remains exactly 8 in SQLite database', async () => {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM members').get();
    assert.strictEqual(countRow.count, 8, `Expected exactly 8 members, got ${countRow.count}`);
  });

  // 15. Verify books and circulation data remain unchanged
  await step(15, 'Verify books (62 titles, 255 copies) and circulation baseline remain unchanged', async () => {
    const books = db.prepare('SELECT * FROM books').all();
    assert.strictEqual(books.length, 62, 'Must have exactly 62 book titles');
    const totalCopies = books.reduce((s, b) => s + b.total_copies, 0);
    const availCopies = books.reduce((s, b) => s + b.available_copies, 0);
    assert.strictEqual(totalCopies, 255, 'Total copies must be 255');
    assert.strictEqual(availCopies, 255, 'Available copies must be 255');

    const activeLoans = db.prepare('SELECT COUNT(*) as c FROM loans WHERE return_date IS NULL').get().c;
    assert.strictEqual(activeLoans, 0, 'Active loans count must be 0');

    const unpaidFines = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM fines WHERE status = 'Unpaid'").get().s;
    assert.strictEqual(unpaidFines, 0, 'Pending fines must be 0');
  });

  // 16. Restart server / Direct SQLite persistence check
  await step(16, 'Verify direct SQLite persistence and clear/restore capability', async () => {
    const row = db.prepare('SELECT email FROM members WHERE member_code = ?').get('MEM-002');
    assert.strictEqual(row.email, testGmail2, 'Direct SQLite query must confirm email persisted');

    // Clean up test email so data remains clean
    db.prepare('UPDATE members SET email = NULL WHERE member_code = ?').run('MEM-002');
    const cleaned = db.prepare('SELECT email FROM members WHERE member_code = ?').get('MEM-002');
    assert.strictEqual(cleaned.email, null, 'Cleaned email is null');
  });

  console.log('\n========================================================================');
  console.log(`  16-POINT VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runFeatureVerification();
