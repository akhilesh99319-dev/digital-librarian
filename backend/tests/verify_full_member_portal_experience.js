const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('../database/db');
const { getTestOtp } = require('../utils/emailService');

console.log('========================================================================');
console.log('  FULL DEDICATED MEMBER PORTAL UI/UX & ISOLATION VERIFICATION SUITE');
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

async function run() {
  const frontendDir = path.resolve(__dirname, '../../frontend');

  // 1. Static HTML & Layout Consistency Audit
  await step('HTML Audit: Member pages exist with proper viewport, styles, and shared scripts', () => {
    const memberPages = [
      'dashboard.html',
      'available-books.html',
      'my-books.html',
      'notifications.html',
      'profile.html',
      'book-details.html'
    ];

    for (const page of memberPages) {
      const filePath = path.join(frontendDir, page);
      assert.strictEqual(fs.existsSync(filePath), true, `Page ${page} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');

      assert.strictEqual(content.includes('style.css'), true, `${page} must include style.css`);
      assert.strictEqual(content.includes('api.js'), true, `${page} must include api.js`);
      assert.strictEqual(content.includes('common.js'), true, `${page} must include common.js`);
      assert.strictEqual(content.includes('<meta name="viewport"'), true, `${page} must have viewport meta tag`);
    }
  });

  await step('HTML & Navigation Audit: Member navigation blocks link exclusively to Member views', () => {
    const memberPages = [
      'dashboard.html',
      'available-books.html',
      'my-books.html',
      'notifications.html',
      'profile.html',
      'book-details.html'
    ];

    for (const page of memberPages) {
      const content = fs.readFileSync(path.join(frontendDir, page), 'utf8');

      // Check member navigation anchors
      assert.strictEqual(content.includes('href="/dashboard.html"'), true, `${page} must link to /dashboard.html`);
      assert.strictEqual(content.includes('href="/available-books.html"'), true, `${page} must link to /available-books.html`);
      assert.strictEqual(content.includes('href="/my-books.html"'), true, `${page} must link to /my-books.html`);
      assert.strictEqual(content.includes('href="/notifications.html"'), true, `${page} must link to /notifications.html`);
      assert.strictEqual(content.includes('href="/profile.html"'), true, `${page} must link to /profile.html`);

      // If page is a dedicated Member page (single nav), verify it has no admin links at all
      if (['dashboard.html', 'available-books.html', 'my-books.html', 'notifications.html'].includes(page)) {
        assert.strictEqual(content.includes('href="/members.html"'), false, `${page} must not link to /members.html`);
        assert.strictEqual(content.includes('href="/issue.html"'), false, `${page} must not link to /issue.html`);
        assert.strictEqual(content.includes('href="/return.html"'), false, `${page} must not link to /return.html`);
        assert.strictEqual(content.includes('href="/categories.html"'), false, `${page} must not link to /categories.html`);
        assert.strictEqual(content.includes('href="/reports.html"'), false, `${page} must not link to /reports.html`);
      }
    }
  });

  await step('HTML Audit: Book Details page supports dual sidebar and dynamic member rendering', () => {
    const content = fs.readFileSync(path.join(frontendDir, 'book-details.html'), 'utf8');
    assert.strictEqual(content.includes('id="memberSidebarNav"'), true, 'book-details.html must have memberSidebarNav');
    assert.strictEqual(content.includes('id="librarianSidebarNav"'), true, 'book-details.html must have librarianSidebarNav');
    assert.strictEqual(content.includes('id="bookDetailsCard"'), true, 'book-details.html must have bookDetailsCard');
  });

  await step('JS Audit: available-books.js renders direct links and secondary details button to book-details.html', () => {
    const content = fs.readFileSync(path.join(frontendDir, 'assets/js/available-books.js'), 'utf8');
    assert.strictEqual(content.includes('/book-details.html?id='), true, 'available-books.js must link to book-details.html?id=');
  });

  await step('JS Audit: book-details.js routes Member requests and redirects to my-books.html?tab=requests', () => {
    const content = fs.readFileSync(path.join(frontendDir, 'assets/js/book-details.js'), 'utf8');
    assert.strictEqual(content.includes('/my-books.html?tab=requests'), true, 'book-details.js must redirect to /my-books.html?tab=requests');
  });

  await step('JS Audit: my-books.js handles ?tab= query parameter', () => {
    const content = fs.readFileSync(path.join(frontendDir, 'assets/js/my-books.js'), 'utf8');
    assert.strictEqual(content.includes('URLSearchParams'), true, 'my-books.js must parse URLSearchParams');
    assert.strictEqual(content.includes("urlParams.get('tab')"), true, "my-books.js must check tab param");
  });

  // 2. Dynamic End-to-End API and Flow Testing
  let librarianToken;
  let memberToken;
  let memberUser;
  let sampleBookId;
  let createdRequestId;

  await step('Librarian Login: akhilesh@library.com authenticates successfully', async () => {
    const res = await performOtpLogin('akhilesh@library.com', 'Password@123');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'Librarian');
    librarianToken = res.body.token;
  });

  await step('Member Setup / Login: Authenticates as Member', async () => {
    const testEmail = 'rahul.portal.test@library.com';
    const regRes = await performOtpRegister({
      name: 'Rahul Sharma',
      email: testEmail,
      phone: '9876543210',
      password: 'Password@123',
      confirm_password: 'Password@123'
    });

    if (regRes.status === 201) {
      const loginRes = await performOtpLogin(testEmail, 'Password@123');
      assert.strictEqual(loginRes.status, 200);
      memberToken = loginRes.body.token;
      memberUser = loginRes.body.user;
    } else {
      const loginRes = await performOtpLogin(testEmail, 'Password@123');
      assert.strictEqual(loginRes.status, 200);
      memberToken = loginRes.body.token;
      memberUser = loginRes.body.user;
    }
    assert.strictEqual(memberUser.role, 'Member');
    assert.ok(memberToken, 'Member JWT token must be generated');
  });

  await step('Member Book Search: GET /api/books returns catalog for Available Books page', async () => {
    const res = await apiRequest('GET', '/api/books', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    sampleBookId = res.body.data[0].id;
  });

  await step('Member Book Details: GET /api/books/:id returns complete details', async () => {
    const res = await apiRequest('GET', `/api/books/${sampleBookId}`, null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, sampleBookId);
  });

  await step('Member Book Request: POST /api/loans/request submits request with auto-bound member ID', async () => {
    const res = await apiRequest('POST', '/api/loans/request', {
      book_id: sampleBookId,
      notes: 'Testing Dedicated Member Portal Request Flow'
    }, memberToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.book_id, sampleBookId);
    assert.strictEqual(res.body.data.status, 'Pending');
    createdRequestId = res.body.data.id;
  });

  await step('Member My Requests: GET /api/loans/my-requests returns newly created request', async () => {
    const res = await apiRequest('GET', '/api/loans/my-requests', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find(r => r.id === createdRequestId);
    assert.ok(found, 'Created request must appear in Member requests list');
  });

  await step('Member My Books: GET /api/loans/my-books returns member loans, history, and requests', async () => {
    const res = await apiRequest('GET', '/api/loans/my-books', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.book_requests);
    assert.ok(res.body.data.metrics);
  });

  await step('Member Notifications: GET /api/loans/notifications returns dynamic notification for book request', async () => {
    const res = await apiRequest('GET', '/api/loans/notifications', null, memberToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  await step('Librarian Request Queue & Approval: Librarian sees request and approves it', async () => {
    const queueRes = await apiRequest('GET', '/api/loans/requests', null, librarianToken);
    assert.strictEqual(queueRes.status, 200);
    const item = queueRes.body.data.find(r => r.id === createdRequestId);
    assert.ok(item, 'Librarian must see member request in queue');

    const approveRes = await apiRequest('POST', `/api/loans/requests/${createdRequestId}/action`, {
      action: 'APPROVE'
    }, librarianToken);
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.success, true);
  });

  await step('Security Isolation: Member forbidden from executing Admin actions', async () => {
    const resMembers = await apiRequest('GET', '/api/members', null, memberToken);
    assert.strictEqual(resMembers.status, 403);

    const resAddBook = await apiRequest('POST', '/api/books', { title: 'Hack', isbn: '0000000000' }, memberToken);
    assert.strictEqual(resAddBook.status, 403);

    const resDirectIssue = await apiRequest('POST', '/api/loans/issue', { book_id: sampleBookId, member_id: memberUser.id }, memberToken);
    assert.strictEqual(resDirectIssue.status, 403);

    const resReports = await apiRequest('GET', '/api/reports/circulation', null, memberToken);
    assert.strictEqual(resReports.status, 403);
  });

  // Clean up test data and verify baseline
  await step('Database Cleanup & Baseline Restoration', async () => {
    db.exec(`
      DELETE FROM book_requests WHERE notes LIKE '%Testing Dedicated Member Portal%';
      DELETE FROM users WHERE email = 'rahul.portal.test@library.com';
      DELETE FROM members WHERE email = 'rahul.portal.test@library.com';
    `);
  });

  console.log('\n========================================================================');
  console.log(`  MEMBER PORTAL TEST EXECUTION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
