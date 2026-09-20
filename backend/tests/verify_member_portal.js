const assert = require('node:assert');
const http = require('node:http');
const { db } = require('../database/db');
const { getTestOtp } = require('../utils/emailService');

console.log('================================================================');
console.log('  DEDICATED MEMBER PORTAL & BOOK REQUEST FLOW VERIFICATION SUITE');
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

function apiRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
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

async function runMemberPortalTests() {
  let memberToken = null;
  let memberUser = null;
  let librarianToken = null;
  let librarianUser = null;
  let testRequestId = null;
  let testBookId = 1;

  // 1. Authenticate Librarian / Admin
  await step('Librarian Login: Authenticates and returns Librarian role', async () => {
    const res = await performOtpLogin('akhilesh@library.com', 'Password@123');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'Librarian');
    librarianToken = res.body.token;
    librarianUser = res.body.user;
  });

  // 2. Register / Authenticate Member
  await step('Member Login / Setup: Authenticates and returns Member role', async () => {
    // Check if test member exists or register one
    const testMemberEmail = 'member.testportal@example.com';
    const testMemberPass = 'MemberPass@2026';

    const loginRes = await performOtpLogin(testMemberEmail, testMemberPass);

    if (loginRes.status === 200) {
      memberToken = loginRes.body.token;
      memberUser = loginRes.body.user;
      assert.strictEqual(memberUser.role, 'Member');
    } else {
      const regRes = await performOtpRegister({
        name: 'Portal Test Patron',
        email: testMemberEmail,
        phone: '9876543210',
        password: testMemberPass,
        confirm_password: testMemberPass
      });
      assert.strictEqual(regRes.status, 201);

      const loginRes2 = await performOtpLogin(testMemberEmail, testMemberPass);
      assert.strictEqual(loginRes2.status, 200);
      memberToken = loginRes2.body.token;
      memberUser = loginRes2.body.user;
      assert.strictEqual(memberUser.role, 'Member');
    }
    assert.ok(memberToken, 'Member JWT token must be generated');
  });

  // 3. Member submits book request
  await step('Member Book Request: Submits request and automatically binds authenticated Member ID', async () => {
    // Pick book #1
    const bookBefore = db.prepare('SELECT * FROM books WHERE id = ?').get(testBookId);
    assert.ok(bookBefore, 'Book 1 must exist');

    const res = await apiRequest('POST', '/api/loans/request', {
      book_id: testBookId,
      notes: 'Automated test request for verified portal flow'
    }, memberToken);

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'Pending');
    assert.strictEqual(res.body.data.member_id, memberUser.id);
    assert.strictEqual(res.body.data.book_id, testBookId);

    testRequestId = res.body.data.id;
    assert.ok(testRequestId, 'Returned request must have an ID');
  });

  // 4. Member views personal requests
  await step('Member My Requests: Retrieves only their own requests', async () => {
    const res = await apiRequest('GET', '/api/loans/my-requests', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find(r => r.id === testRequestId);
    assert.ok(found, 'Created request must be listed in member requests');
    assert.strictEqual(found.status, 'Pending');
    assert.strictEqual(found.book_title, 'Clean Code: A Handbook of Agile Software Craftsmanship');
  });

  // 5. Member views My Books comprehensive endpoint
  await step('Member My Books: Returns personal active loans, history, and requests', async () => {
    const res = await apiRequest('GET', '/api/loans/my-books', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.book_requests);
    assert.ok(res.body.data.metrics);
    assert.strictEqual(typeof res.body.data.metrics.pending_requests_count, 'number');
    assert.ok(res.body.data.metrics.pending_requests_count >= 1);
  });

  // 6. Member Notifications
  await step('Member Notifications: Returns dynamic request pending notification', async () => {
    const res = await apiRequest('GET', '/api/loans/notifications', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const pendingNotif = res.body.data.find(n => n.type === 'request_pending' && n.id.includes(testRequestId));
    assert.ok(pendingNotif, 'Should find request_pending notification');
  });

  // 7. Librarian views pending queue
  await step('Librarian Queue: Lists pending member requests', async () => {
    const res = await apiRequest('GET', '/api/loans/requests?status=Pending', null, librarianToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const item = res.body.data.find(r => r.id === testRequestId);
    assert.ok(item, 'Librarian must see the member request in queue');
    assert.strictEqual(item.member_name, memberUser.name);
  });

  // 8. Librarian Approves Request
  await step('Librarian Action APPROVE: Transitions request status to Approved', async () => {
    const res = await apiRequest('POST', `/api/loans/requests/${testRequestId}/action`, {
      action: 'APPROVE'
    }, librarianToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const dbRow = db.prepare('SELECT status FROM book_requests WHERE id = ?').get(testRequestId);
    assert.strictEqual(dbRow.status, 'Approved');
  });

  // 9. Member checks Approved notification
  await step('Member Notifications: Shows approved request alert', async () => {
    const res = await apiRequest('GET', '/api/loans/notifications', null, memberToken);
    assert.strictEqual(res.status, 200);
    const approvedNotif = res.body.data.find(n => n.type === 'request_approved' && n.id.includes(testRequestId));
    assert.ok(approvedNotif, 'Should find request_approved notification');
  });

  // 10. Librarian Issues Request
  await step('Librarian Action ISSUE: Atomically creates loan and decrements book copy count', async () => {
    const bookBefore = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);

    const res = await apiRequest('POST', `/api/loans/requests/${testRequestId}/action`, {
      action: 'ISSUE'
    }, librarianToken);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data && res.body.data.loan_code);

    const bookAfter = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);
    assert.strictEqual(bookAfter.available_copies, bookBefore.available_copies - 1);

    const reqRow = db.prepare('SELECT status FROM book_requests WHERE id = ?').get(testRequestId);
    assert.strictEqual(reqRow.status, 'Issued');
  });

  // 11. Security & Role Isolation: Member cannot access administrative routes
  await step('Security: Member attempting GET /api/members is blocked with HTTP 403', async () => {
    const res = await apiRequest('GET', '/api/members', null, memberToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await step('Security: Member attempting POST /api/books is blocked with HTTP 403', async () => {
    const res = await apiRequest('POST', '/api/books', {
      title: 'Hacked Book',
      author: 'Attacker',
      category_id: 1,
      total_copies: 10
    }, memberToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await step('Security: Member attempting POST /api/loans/issue (admin direct issue) is blocked with HTTP 403', async () => {
    const res = await apiRequest('POST', '/api/loans/issue', {
      book_id: testBookId,
      member_id: memberUser.id,
      due_date: '2026-10-01'
    }, memberToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await step('Security: Member attempting GET /api/reports/circulation is blocked with HTTP 403', async () => {
    const res = await apiRequest('GET', '/api/reports/circulation', null, memberToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await step('Security: Member attempting to access another member profile is blocked with HTTP 403', async () => {
    const anotherMemberId = memberUser.id === 1 ? 2 : 1;
    const res = await apiRequest('GET', `/api/members/${anotherMemberId}`, null, memberToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await step('Security: Member accessing own profile /api/members/:id succeeds with HTTP 200', async () => {
    const res = await apiRequest('GET', `/api/members/${memberUser.id}`, null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, memberUser.id);
  });

  // 12. Cleanup test request & created loan, restore book copy count
  await step('Cleanup & Authoritative Baseline Integrity Check', async () => {
    // Delete created loan from action
    db.prepare('DELETE FROM loans WHERE notes LIKE ?').run('%Automated test request%');
    db.prepare('DELETE FROM book_requests WHERE id = ?').run(testRequestId);
    db.prepare('DELETE FROM members WHERE email = ?').run('member.testportal@example.com');
    db.prepare('UPDATE books SET available_copies = total_copies WHERE id = ?').run(testBookId);

    const bookStats = db.prepare('SELECT COUNT(*) as c, SUM(total_copies) as tc FROM books').get();
    const memCount = db.prepare('SELECT COUNT(*) as c FROM members').get().c;

    assert.strictEqual(bookStats.c, 62, 'Must maintain 62 book titles');
    assert.strictEqual(bookStats.tc, 255, 'Must maintain 255 total copies');
    assert.strictEqual(memCount, 8, 'Must maintain 8 baseline members');
  });

  console.log('\n================================================================');
  console.log(`  RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

// Start tests
runMemberPortalTests().catch(err => {
  console.error('Test execution error:', err);
  process.exitCode = 1;
});
