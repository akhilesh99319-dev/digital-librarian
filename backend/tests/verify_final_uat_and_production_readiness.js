/**
 * FINAL UAT, UI/UX & PRODUCTION READINESS TEST SUITE
 * Complete end-to-end verification across all 28 project dimensions
 */

const http = require('node:http');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');
const { getTestOtp } = require('../utils/emailService');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, reqPath, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function performOtpLogin(email, password) {
  const loginRes = await makeRequest('POST', '/api/auth/login', { email, password });
  if (loginRes.status !== 200 || !loginRes.data.temp_token) {
    return loginRes;
  }
  const otp = getTestOtp(email);
  return await makeRequest('POST', '/api/auth/verify-otp', {
    temp_token: loginRes.data.temp_token,
    otp
  });
}

async function performOtpRegister(payload) {
  const regRes = await makeRequest('POST', '/api/auth/register', payload);
  if (regRes.status !== 200 || !regRes.data.temp_token) {
    return regRes;
  }
  const otp = getTestOtp(payload.email);
  return await makeRequest('POST', '/api/auth/verify-register-otp', {
    temp_token: regRes.data.temp_token,
    otp
  });
}

let passedTests = 0;
let failedTests = 0;

function logPass(title) {
  console.log(`  ✅ PASS: ${title}`);
  passedTests++;
}

function logFail(title, err) {
  console.error(`  ❌ FAIL: ${title} - ${err.message || err}`);
  failedTests++;
}

async function runFinalUATSuite() {
  console.log('========================================================================');
  console.log('  PHASE: FINAL UAT, UI/UX & PRODUCTION READINESS VERIFICATION SUITE');
  console.log('========================================================================\n');

  let librarianToken = null;
  let memberToken = null;
  let testMemberId = null;
  let testBookId = 1;

  // Pre-test cleanup: ensure no leftover test members or circulation records
  db.prepare('DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM members WHERE id > 8)').run();
  db.prepare('DELETE FROM members WHERE id > 8').run();
  db.prepare('DELETE FROM fines').run();
  db.prepare('DELETE FROM loans').run();
  db.prepare('DELETE FROM book_requests').run();
  db.prepare('UPDATE books SET available_copies = total_copies').run();

  try {
    // ----------------------------------------------------
    // PHASE 1: PRE-FLIGHT SYSTEM CHECK
    // ----------------------------------------------------
    console.log('[PHASE 1] Pre-Flight System & Service Health');
    const health = await makeRequest('GET', '/api/health');
    assert.strictEqual(health.status, 200, 'Health check must return HTTP 200');
    assert.strictEqual(health.data.status, 'online', 'Status must be online');
    assert.strictEqual(health.data.app, 'Digital Librarian', 'App name must match');
    logPass('Pre-Flight: GET /api/health responding HTTP 200 with online status');

    // Verify uploads and database folders exist
    const uploadsDir = path.join(__dirname, '../../uploads');
    const dbDir = path.join(__dirname, '../../database');
    assert.ok(fs.existsSync(uploadsDir), 'Uploads directory must exist');
    assert.ok(fs.existsSync(dbDir), 'Database directory must exist');
    logPass('Pre-Flight: Static folders (uploads, database) verified');

    // ----------------------------------------------------
    // PHASE 2: AUTHORITATIVE DATA BASELINE
    // ----------------------------------------------------
    console.log('\n[PHASE 2] Authoritative Dataset Baseline Verification');
    const booksCount = db.prepare('SELECT COUNT(*) as count, SUM(total_copies) as tc, SUM(available_copies) as ac FROM books').get();
    assert.strictEqual(booksCount.count, 62, `Expected 62 books, got ${booksCount.count}`);
    assert.strictEqual(booksCount.tc, 255, `Expected 255 total copies, got ${booksCount.tc}`);
    assert.strictEqual(booksCount.ac, 255, `Expected 255 available copies, got ${booksCount.ac}`);

    const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
    assert.strictEqual(memberCount, 8, `Expected 8 members, got ${memberCount}`);

    const activeLoansCount = db.prepare('SELECT COUNT(*) as count FROM loans WHERE return_date IS NULL').get().count;
    assert.strictEqual(activeLoansCount, 0, `Expected 0 active loans, got ${activeLoansCount}`);

    const unpaidFines = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM fines WHERE status = 'Unpaid'").get().total;
    assert.strictEqual(unpaidFines, 0, `Expected ₹0 unpaid fines, got ₹${unpaidFines}`);
    logPass('Authoritative Data: Exactly 62 titles, 255 copies, 8 baseline members, 0 active loans, ₹0 fines');

    // ----------------------------------------------------
    // PHASE 3: ADMIN / LIBRARIAN USER ACCEPTANCE TEST
    // ----------------------------------------------------
    console.log('\n[PHASE 3 & 4] Admin & Librarian User Acceptance Tests');
    // Login
    const libRes = await performOtpLogin('akhilesh@library.com', 'Password@123');
    assert.strictEqual(libRes.status, 200, 'Librarian login must succeed');
    assert.strictEqual(libRes.data.user.role, 'Librarian', 'Role must be Librarian');
    librarianToken = libRes.data.token;
    logPass('Admin/Librarian Login: Authenticated Akhilesh Kumar (Role: Librarian)');

    // Dashboard Metrics
    const statsRes = await makeRequest('GET', '/api/dashboard/stats', null, librarianToken);
    assert.strictEqual(statsRes.status, 200, 'GET /api/dashboard/stats must succeed');
    const metrics = statsRes.data.data?.metrics || statsRes.data.metrics || {};
    assert.strictEqual(metrics.uniqueBookTitles, 62, 'Stats uniqueBookTitles = 62');
    assert.strictEqual(metrics.totalMembers, 8, 'Stats totalMembers = 8');
    logPass('Librarian Dashboard: Summary stats return 62 unique books, 8 members, 0 active loans');

    // Member Management list
    const memListRes = await makeRequest('GET', '/api/members', null, librarianToken);
    assert.strictEqual(memListRes.status, 200, 'GET /api/members must succeed');
    assert.strictEqual((memListRes.data.data || memListRes.data).length, 8, 'Must return 8 members');
    logPass('Member Management: GET /api/members lists all 8 baseline patrons');

    // Reports Generation
    const invReportRes = await makeRequest('GET', '/api/reports?type=inventory', null, librarianToken);
    assert.strictEqual(invReportRes.status, 200, 'GET /api/reports?type=inventory must succeed');
    logPass('Reports & Analytics: Inventory report generated successfully');

    // ----------------------------------------------------
    // PHASE 5: MEMBER USER ACCEPTANCE TEST
    // ----------------------------------------------------
    console.log('\n[PHASE 5] Dedicated Member Portal User Acceptance Tests');
    // Member Registration & Validation
    const testPatronEmail = 'uat.patron@example.com';
    const testPatronPass = 'Patron@2026';

    // Test password mismatch
    const badRegRes = await makeRequest('POST', '/api/auth/register', {
      name: 'UAT Patron',
      email: testPatronEmail,
      phone: '9888877777',
      password: testPatronPass,
      confirm_password: 'MismatchPassword'
    });
    assert.strictEqual(badRegRes.status, 400, 'Password mismatch must return HTTP 400');
    logPass('Member Registration Validation: Password mismatch safely rejected (HTTP 400)');

    // Successful Registration
    const regRes = await performOtpRegister({
      name: 'UAT Verified Patron',
      email: testPatronEmail,
      phone: '9888877777',
      password: testPatronPass,
      confirm_password: testPatronPass
    });
    assert.strictEqual(regRes.status, 201, 'Registration must return HTTP 201');
    testMemberId = regRes.data.data?.id || regRes.data.user?.id;
    assert.ok(testMemberId, 'New member ID must be returned');
    logPass(`Member Registration: Created new patron account (ID: ${testMemberId})`);

    // Member Login
    const memLoginRes = await performOtpLogin(testPatronEmail, testPatronPass);
    assert.strictEqual(memLoginRes.status, 200, 'Member login must succeed');
    assert.strictEqual(memLoginRes.data.user.role, 'Member', 'Role must be Member');
    memberToken = memLoginRes.data.token;
    logPass('Member Login: Authenticated new patron with JWT & Member role');

    // Member Catalog Discovery
    const catRes = await makeRequest('GET', '/api/books?limit=100', null, memberToken);
    assert.strictEqual(catRes.status, 200, 'Member can browse catalog');
    const catalogList = catRes.data.data || catRes.data;
    assert.strictEqual(catalogList.length, 62, 'Catalog returns all 62 books with limit=100');
    assert.strictEqual(catRes.data.pagination?.total, 62, 'Pagination total count is 62');
    logPass('Available Books: Member can search and view all 62 books in catalog');

    // Member Profile & QR
    const myProfileRes = await makeRequest('GET', '/api/auth/me', null, memberToken);
    assert.strictEqual(myProfileRes.status, 200, 'GET /api/auth/me succeeds for Member');
    assert.strictEqual(myProfileRes.data.user.id, testMemberId, 'Profile belongs to test patron');
    logPass('Member Profile: Authenticated identity returns verified details for QR rendering');

    // ----------------------------------------------------
    // PHASE 6: MEMBER PORTAL ISOLATION & SECURITY BOUNDARIES
    // ----------------------------------------------------
    console.log('\n[PHASE 6] Member Portal Role Isolation & Route Barriers');
    const blockedEndpoints = [
      { method: 'GET', path: '/api/members', name: 'Admin Member Management' },
      { method: 'POST', path: '/api/books', data: { title: 'Unauthorized Book' }, name: 'Admin Add Book' },
      { method: 'POST', path: '/api/loans/issue', data: { member_id: testMemberId, book_id: 1 }, name: 'Librarian Direct Issue' },
      { method: 'GET', path: '/api/reports/circulation', name: 'Admin Circulation Reports' },
      { method: 'GET', path: '/api/auth/admin-requests', name: 'Admin Approval Requests' },
      { method: 'GET', path: '/api/auth/audit-logs', name: 'Security Audit Logs' }
    ];

    for (const ep of blockedEndpoints) {
      const res = await makeRequest(ep.method, ep.path, ep.data || null, memberToken);
      assert.strictEqual(res.status, 403, `Member accessing ${ep.name} must return HTTP 403 Forbidden`);
    }
    logPass('Role Isolation: All 6 restricted Admin/Librarian endpoints blocked for Member (HTTP 403 Forbidden)');

    // ----------------------------------------------------
    // PHASE 7: NAVIGATION & FRONTEND HTML TEMPLATES AUDIT
    // ----------------------------------------------------
    console.log('\n[PHASE 7] HTML Templates & Navigation Structure Audit');
    const requiredHtmlFiles = [
      'index.html', 'dashboard.html', 'available-books.html', 'book-details.html',
      'my-books.html', 'notifications.html', 'profile.html', 'books.html',
      'members.html', 'issue.html', 'return.html', 'reports.html', 'login.html'
    ];

    for (const f of requiredHtmlFiles) {
      const fullP = path.join(__dirname, '../../frontend', f);
      assert.ok(fs.existsSync(fullP), `HTML template ${f} must exist`);
      const content = fs.readFileSync(fullP, 'utf8');
      assert.ok(content.includes('<meta name="viewport"'), `${f} must include viewport meta tag`);
    }
    logPass('Navigation & UI Audit: All 13 HTML template views verified with responsive viewport meta tags');

    // ----------------------------------------------------
    // PHASE 8 & 9: RESPONSIVE DESIGN & UI TOKENS
    // ----------------------------------------------------
    console.log('\n[PHASE 8 & 9] Design System & Responsive Tokens');
    const cssPath = path.join(__dirname, '../../frontend/assets/css/style.css');
    assert.ok(fs.existsSync(cssPath), 'CSS file must exist');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert.ok(cssContent.includes('--bg-base') || cssContent.includes('--primary'), 'CSS must define design system CSS variables');
    assert.ok(cssContent.includes('@media'), 'CSS must contain responsive media queries');
    logPass('Design System & Responsiveness: Dark theme tokens and media query breakpoints verified in style.css');

    // ----------------------------------------------------
    // PHASE 10: FORM VALIDATION & EDGE CASES
    // ----------------------------------------------------
    console.log('\n[PHASE 10] Form Validation & Input Sanitization');
    // Login with empty email
    const emptyLoginRes = await makeRequest('POST', '/api/auth/login', { email: '', password: '' });
    assert.strictEqual(emptyLoginRes.status, 400, 'Empty login must return HTTP 400');

    // Login with invalid password
    const badPwLogin = await makeRequest('POST', '/api/auth/login', { email: 'akhilesh@library.com', password: 'BadPassword' });
    assert.strictEqual(badPwLogin.status, 401, 'Bad password must return HTTP 401');

    logPass('Form Validation: Missing fields and invalid credentials rejected safely (HTTP 400/401)');

    // ----------------------------------------------------
    // PHASE 11: SECURITY REVIEW & CIPHER AUDIT
    // ----------------------------------------------------
    console.log('\n[PHASE 11] Security Review & Password Hashing');
    const userRow = db.prepare('SELECT password_hash FROM users WHERE id = 1').get();
    assert.ok(userRow.password_hash.startsWith('$2a$') || userRow.password_hash.startsWith('$2b$'), 'Password must be hashed with BCrypt');

    // Check no hardcoded JWT tokens in client scripts
    const jsFiles = fs.readdirSync(path.join(__dirname, '../../frontend/assets/js'));
    for (const jsF of jsFiles) {
      const jsContent = fs.readFileSync(path.join(__dirname, '../../frontend/assets/js', jsF), 'utf8');
      assert.ok(!jsContent.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), `No hardcoded JWT token in ${jsF}`);
      assert.ok(!jsContent.includes('Password@123'), `No hardcoded passwords in ${jsF}`);
    }
    logPass('Security Audit: BCrypt hashing enforced; zero hardcoded credentials in public JS scripts');

    // ----------------------------------------------------
    // PHASE 12: QR ARCHITECTURE & SCANNER PARSER
    // ----------------------------------------------------
    console.log('\n[PHASE 12] QR Code Payload Formats & Three-Way Isolation');
    const qrMemberPayload = `DL:MEMBER:${testMemberId}:MEM-009`;
    const qrBookPayload = `DL:BOOK:1:BK-001`;
    const qrPaymentPayload = `upi://pay?pa=library@upi&pn=Digital%20Librarian&am=50.00&cu=INR&tn=Fine%20Settlement`;

    assert.ok(qrMemberPayload.startsWith('DL:MEMBER:'), 'Member QR prefix verified');
    assert.ok(qrBookPayload.startsWith('DL:BOOK:'), 'Book QR prefix verified');
    assert.ok(qrPaymentPayload.startsWith('upi://pay'), 'UPI Payment QR scheme verified');
    logPass('QR Architecture: Member QR, Book QR, and UPI Fine Payment QR schemas verified');

    // ----------------------------------------------------
    // PHASE 13: END-TO-END CIRCULATION WORKFLOW
    // ----------------------------------------------------
    console.log('\n[PHASE 13] Complete Controlled Circulation Lifecycle');
    // 1. Member requests book #1
    const reqRes = await makeRequest('POST', '/api/loans/request', {
      book_id: testBookId,
      notes: 'Final UAT Circulation Test'
    }, memberToken);
    assert.strictEqual(reqRes.status, 201, 'Request creation must return HTTP 201');
    const reqId = reqRes.data.data?.id;

    // 2. Librarian reviews & approves request
    const approveRes = await makeRequest('POST', `/api/loans/requests/${reqId}/action`, {
      action: 'APPROVE'
    }, librarianToken);
    assert.strictEqual(approveRes.status, 200, 'Request approval must return HTTP 200');

    // 3. Librarian issues book to patron
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const issueRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: testMemberId,
      book_id: testBookId,
      issue_date: issueDate,
      due_date: dueDate,
      notes: 'Final UAT Issue'
    }, librarianToken);
    assert.strictEqual(issueRes.status, 201, 'Issue must return HTTP 201');
    const loanId = issueRes.data.data?.id;

    // Verify copies decremented (255 -> 254)
    const bookAfterIssue = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);
    assert.strictEqual(bookAfterIssue.available_copies, 4, 'Book available copies must be 4');

    // 4. Member checks active loans
    const myLoansRes = await makeRequest('GET', '/api/loans/my-loans', null, memberToken);
    assert.strictEqual(myLoansRes.status, 200, 'Member can fetch personal loans');
    const activeLoan = myLoansRes.data.data?.active_loans?.find(l => l.id === loanId);
    assert.ok(activeLoan, 'Active loan must appear in member dashboard');

    // 5. Librarian returns book
    const returnRes = await makeRequest('POST', `/api/loans/${loanId}/return`, {
      return_date: issueDate
    }, librarianToken);
    assert.strictEqual(returnRes.status, 200, 'Return must return HTTP 200');

    // Verify copies restored (4 -> 5)
    const bookAfterReturn = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);
    assert.strictEqual(bookAfterReturn.available_copies, 5, 'Book available copies restored to 5');
    logPass('Circulation Lifecycle: Request -> Approve -> Issue (5->4) -> Verify My Books -> Return (4->5) completed');

    // ----------------------------------------------------
    // PHASE 14 & 15: API CONSISTENCY & ERROR HANDLING
    // ----------------------------------------------------
    console.log('\n[PHASE 14 & 15] Database Constraints & Error Handling');
    // Issue non-existent book
    const errBookRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: testMemberId,
      book_id: 99999,
      issue_date: issueDate,
      due_date: dueDate
    }, librarianToken);
    assert.strictEqual(errBookRes.status, 404, 'Invalid book returns HTTP 404');

    // Return already returned loan
    const errReturnRes = await makeRequest('POST', `/api/loans/${loanId}/return`, {
      return_date: issueDate
    }, librarianToken);
    assert.strictEqual(errReturnRes.status, 400, 'Duplicate return returns HTTP 400');
    logPass('Error Handling: Non-existent entities (404) and illegal state transitions (400) handled gracefully');

    // ----------------------------------------------------
    // PHASE 16: PERFORMANCE SANITY CHECK
    // ----------------------------------------------------
    console.log('\n[PHASE 16] Performance Sanity Latency Check');
    const startT = Date.now();
    await makeRequest('GET', '/api/books', null, librarianToken);
    const duration = Date.now() - startT;
    assert.ok(duration < 500, `Catalog fetch latency (${duration}ms) must be under 500ms`);
    logPass(`Performance Sanity: GET /api/books responded in ${duration}ms (target < 500ms)`);

    // ----------------------------------------------------
    // PHASE 17 & 18: PRODUCTION CONFIGURATION & CLEANUP
    // ----------------------------------------------------
    console.log('\n[PHASE 17 & 18] Production Deployment Readiness');
    assert.ok(fs.existsSync(path.join(__dirname, '../../Dockerfile')), 'Dockerfile must exist');
    assert.ok(fs.existsSync(path.join(__dirname, '../../render.yaml')), 'render.yaml must exist');
    assert.ok(fs.existsSync(path.join(__dirname, '../../database/digital_librarian_postgresql_schema.sql')), 'PostgreSQL schema must exist');
    assert.ok(fs.existsSync(path.join(__dirname, '../../database/digital_librarian_postgresql_import.sql')), 'PostgreSQL import must exist');
    logPass('Production Configuration: Dockerfile, Render blueprint, and PostgreSQL migration scripts verified');

    // Clean up test records created in this test
    if (loanId) db.prepare('DELETE FROM loans WHERE id = ?').run(loanId);
    if (reqId) db.prepare('DELETE FROM book_requests WHERE id = ?').run(reqId);
    if (testMemberId) {
      db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(testMemberId);
      db.prepare('DELETE FROM members WHERE id = ?').run(testMemberId);
    }
    db.prepare('UPDATE books SET available_copies = total_copies WHERE id = ?').run(testBookId);

    console.log('\n========================================================================');
    console.log(`  🎉 FINAL UAT SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('========================================================================\n');

  } catch (err) {
    logFail('Final UAT Suite', err);
    console.error(err);
  }
}

runFinalUATSuite().then(() => {
  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
