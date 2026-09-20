const assert = require('node:assert');

const BASE_URL = 'http://localhost:3000';

async function runE2ETests() {
  console.log('====================================================');
  console.log('  STARTING COMPREHENSIVE END-TO-END HTTP API TESTS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;
  let authToken = '';

  async function testStep(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Details: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await testStep('Server Health Check GET /api/health', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'online');
  });

  // 2. Static HTML files served
  await testStep('Frontend HTML pages and CSS assets serve correctly', async () => {
    const pages = [
      '/login.html', '/index.html', '/books.html', '/categories.html',
      '/members.html', '/issue.html', '/return.html', '/loans.html',
      '/overdue.html', '/reports.html', '/profile.html', '/assets/css/style.css'
    ];
    for (const p of pages) {
      const res = await fetch(`${BASE_URL}${p}`);
      assert.strictEqual(res.status, 200, `Page ${p} must return 200`);
    }
  });

  // 3. Login with invalid password
  await testStep('Auth: Rejects invalid password', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'akhilesh@library.com', password: 'BadPassword' })
    });
    assert.strictEqual(res.status, 401);
  });

  // 4. Login with valid credentials
  await testStep('Auth: Login with akhilesh@library.com returns JWT & Librarian profile', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'akhilesh@library.com', password: 'Password@123' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    if (data.otp_required && data.temp_token) {
      const { getTestOtp } = require('../utils/emailService');
      const otp = getTestOtp('akhilesh@library.com');
      const vRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_token: data.temp_token, otp })
      });
      const vData = await vRes.json();
      assert.ok(vData.token, 'Token must be returned');
      assert.strictEqual(vData.user.name, 'Akhilesh Kumar');
      assert.strictEqual(vData.user.role, 'Librarian');
      authToken = vData.token;
    } else {
      assert.ok(data.token, 'Token must be returned');
      assert.strictEqual(data.user.name, 'Akhilesh Kumar');
      assert.strictEqual(data.user.role, 'Librarian');
      authToken = data.token;
    }
  });

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  });

  // 5. Get current profile
  await testStep('Auth: GET /api/auth/me returns current librarian', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.email, 'akhilesh@library.com');
    assert.strictEqual(data.user.role, 'Librarian');
  });

  // 6. Admin Approval & Audit Logs Workflow Tests
  await testStep('Auth: Admin approval request creation, polling, approval, and audit logs', async () => {
    // A. Request Admin Login
    const reqRes = await fetch(`${BASE_URL}/api/auth/admin-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'akhilesh@library.com',
        password: 'Password@123',
        device_info: 'Secondary Admin iPad / Safari'
      })
    });
    assert.strictEqual(reqRes.status, 200);
    const reqData = await reqRes.json();
    assert.strictEqual(reqData.success, true);
    assert.strictEqual(reqData.approval_required, true);
    assert.ok(reqData.request_token, 'Request token must be returned');
    const requestToken = reqData.request_token;
    const requestId = reqData.request_id;

    // B. Poll status (should be PENDING)
    const pollRes = await fetch(`${BASE_URL}/api/auth/admin-request/${requestToken}`);
    assert.strictEqual(pollRes.status, 200);
    const pollData = await pollRes.json();
    assert.strictEqual(pollData.status, 'PENDING');

    // C. Active Admin views pending requests
    const listReqsRes = await fetch(`${BASE_URL}/api/auth/admin-requests`, { headers: authHeaders() });
    assert.strictEqual(listReqsRes.status, 200);
    const listReqsData = await listReqsRes.json();
    assert.ok(listReqsData.data.some(r => r.id === requestId), 'Created request must appear in pending list');

    // D. Active Admin Approves the request
    const actionRes = await fetch(`${BASE_URL}/api/auth/admin-request/${requestId}/action`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'APPROVE' })
    });
    assert.strictEqual(actionRes.status, 200);

    // E. Poll status again (should now be APPROVED and return JWT)
    const approvedPollRes = await fetch(`${BASE_URL}/api/auth/admin-request/${requestToken}`);
    assert.strictEqual(approvedPollRes.status, 200);
    const approvedPollData = await approvedPollRes.json();
    assert.strictEqual(approvedPollData.status, 'APPROVED');
    assert.ok(approvedPollData.token, 'JWT Token must be granted upon approval');

    // F. Verify Audit Logs
    const auditRes = await fetch(`${BASE_URL}/api/auth/audit-logs`, { headers: authHeaders() });
    assert.strictEqual(auditRes.status, 200);
    const auditData = await auditRes.json();
    assert.ok(Array.isArray(auditData.data), 'Audit logs must return array');
    assert.ok(auditData.data.length > 0, 'Audit logs must contain logged events');
  });

  // 7. Dashboard stats
  await testStep('Dashboard: GET /api/dashboard/stats returns metrics and charts', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`, { headers: authHeaders() });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.data.metrics.totalBooks > 0, 'Total books count must be > 0');
    assert.ok(data.data.metrics.totalMembers >= 8, 'Total members count must be >= 8');
    assert.ok(Array.isArray(data.data.charts.categories), 'Category breakdown must be an array');
    assert.ok(Array.isArray(data.data.charts.monthlyActivity), 'Monthly activity must be an array');
  });

  // 8. Categories CRUD
  let createdCatId = null;
  await testStep('Categories: CRUD Operations', async () => {
    // List
    const listRes = await fetch(`${BASE_URL}/api/categories`, { headers: authHeaders() });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.data.length >= 7, 'Categories count should be at least 7');

    // Create
    const createRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Robotics & Automation', description: 'Robotics hardware and autonomous systems' })
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    createdCatId = createData.data.id;

    // Update
    const updateRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Robotics & AI', description: 'Robotics and artificial intelligence' })
    });
    assert.strictEqual(updateRes.status, 200);

    // Delete
    const delRes = await fetch(`${BASE_URL}/api/categories/${createdCatId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    assert.strictEqual(delRes.status, 200);
  });

  // 9. Members CRUD
  let createdMemId = null;
  await testStep('Members: CRUD Operations & Loan history query', async () => {
    // List
    const listRes = await fetch(`${BASE_URL}/api/members?search=Sonali`, { headers: authHeaders() });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.data.length >= 1);
    assert.strictEqual(listData.data[0].full_name, 'Sonali Kumari');

    // Create
    const createRes = await fetch(`${BASE_URL}/api/members`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        full_name: 'Vikramaditya Roy',
        email: 'vikram.roy@example.com',
        phone: '+91 98123 45678',
        address: 'Boring Canal Road, Patna',
        membership_date: '2026-01-01',
        status: 'Active'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    createdMemId = createData.data.id;

    // Get Details
    const getRes = await fetch(`${BASE_URL}/api/members/${createdMemId}`, { headers: authHeaders() });
    assert.strictEqual(getRes.status, 200);

    // Delete
    const delRes = await fetch(`${BASE_URL}/api/members/${createdMemId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    assert.strictEqual(delRes.status, 200);
  });

  // 9b. Librarian Member Gmail Management & Security Verification
  await testStep('Librarian Member Email Management & Security Verification', async () => {
    // 1. Fetch member MEM-003 (Aman Kumar)
    const memRes = await fetch(`${BASE_URL}/api/members?search=Aman`, { headers: authHeaders() });
    const memData = await memRes.json();
    const aman = memData.data.find(m => m.member_code === 'MEM-003');
    assert.ok(aman, 'Member MEM-003 (Aman Kumar) must exist');

    // 2. Add real Gmail address
    const testGmail = 'aman.kumar.patna@gmail.com';
    const addEmailRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: testGmail })
    });
    assert.strictEqual(addEmailRes.status, 200, 'Librarian can add member Gmail');
    const addEmailData = await addEmailRes.json();
    assert.strictEqual(addEmailData.data.email, testGmail);

    // 3. Verify persistence via GET /api/members/:id
    const verifyRes = await fetch(`${BASE_URL}/api/members/${aman.id}`, { headers: authHeaders() });
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.data.email, testGmail, 'Gmail address persists on member details query');

    // 4. Update existing Gmail address
    const updatedGmail = 'aman.k.patna.updated@gmail.com';
    const updateEmailRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: updatedGmail })
    });
    assert.strictEqual(updateEmailRes.status, 200, 'Librarian can update member Gmail');
    const updateEmailData = await updateEmailRes.json();
    assert.strictEqual(updateEmailData.data.email, updatedGmail);

    // 5. Invalid email validation (bad format)
    const invalidFormats = ['notanemail', 'aman@', 'aman@domain', '@gmail.com', 'aman kumar@gmail.com'];
    for (const badEmail of invalidFormats) {
      const badRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ email: badEmail })
      });
      assert.strictEqual(badRes.status, 400, `Invalid email "${badEmail}" must be rejected with 400`);
    }

    // 6. Duplicate email prevention across different members
    const memRes2 = await fetch(`${BASE_URL}/api/members?search=Ashish`, { headers: authHeaders() });
    const memData2 = await memRes2.json();
    const ashish = memData2.data.find(m => m.member_code === 'MEM-004');
    assert.ok(ashish, 'Member MEM-004 (Ashish Kumar Singh) must exist');

    const dupRes = await fetch(`${BASE_URL}/api/members/${ashish.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: updatedGmail }) // duplicate of Aman's email
    });
    assert.strictEqual(dupRes.status, 400, 'Duplicate email across different members must be rejected');

    // 7. Security: Unauthenticated request rejected (401)
    const unauthRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unauth@gmail.com' })
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be rejected with 401');

    // 8. Security: Non-Librarian / Patron role rejected (403)
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const memberToken = jwt.sign({ id: aman.id, email: 'member@library.com', role: 'Member', name: aman.full_name }, JWT_SECRET, { expiresIn: '1h' });
    const nonLibrarianRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      },
      body: JSON.stringify({ email: 'hacked@gmail.com' })
    });
    assert.strictEqual(nonLibrarianRes.status, 403, 'Non-Librarian role must be rejected with 403 Forbidden');

    // 9. Clear email back to null
    const clearRes = await fetch(`${BASE_URL}/api/members/${aman.id}/email`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ email: '' })
    });
    assert.strictEqual(clearRes.status, 200, 'Librarian can clear member email');
    const clearData = await clearRes.json();
    assert.strictEqual(clearData.data.email, null, 'Cleared email must be null');
  });

  // 10. Books CRUD & Issue / Return Transaction Verification
  await testStep('Circulation & Book Transaction: Issue (X -> X-1) and Return (X-1 -> X)', async () => {
    // 1. Add a dedicated test book
    const uniqueIsbn = `978-${Date.now().toString().slice(-10)}`;
    const bookRes = await fetch(`${BASE_URL}/api/books`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'The Art of Computer Systems Design',
        author: 'Dennis Ritchie',
        category_id: 1, // Computer Science
        isbn: uniqueIsbn,
        publisher: 'Bell Labs Press',
        publication_year: 2024,
        total_copies: 3,
        shelf_location: 'TEST-SHELF-01'
      })
    });
    assert.strictEqual(bookRes.status, 201);
    const bookData = await bookRes.json();
    const testBook = bookData.data;
    assert.strictEqual(testBook.available_copies, 3, 'Initial available copies must be 3');

    // 2. Fetch an active member (e.g. Akhilesh Kumar MEM-001)
    const memRes = await fetch(`${BASE_URL}/api/members?search=Akhilesh`, { headers: authHeaders() });
    const memData = await memRes.json();
    const testMember = memData.data[0];
    assert.ok(testMember, 'Test member must exist');

    // 3. ISSUE BOOK
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const issueRes = await fetch(`${BASE_URL}/api/loans/issue`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        book_id: testBook.id,
        member_id: testMember.id,
        issue_date: today,
        due_date: due,
        notes: 'End-to-end checkout verification'
      })
    });
    assert.strictEqual(issueRes.status, 201);
    const issueData = await issueRes.json();
    const createdLoanId = issueData.data.id;
    assert.ok(createdLoanId, 'Created loan ID must be returned');

    // 4. Verify book available copies decremented to 2
    const checkBook1 = await fetch(`${BASE_URL}/api/books/${testBook.id}`, { headers: authHeaders() });
    const checkData1 = await checkBook1.json();
    assert.strictEqual(checkData1.data.available_copies, 2, 'Available copies must decrement from 3 to 2');

    // 5. RETURN BOOK
    const returnRes = await fetch(`${BASE_URL}/api/loans/${createdLoanId}/return`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        return_date: today,
        fine_paid: 0,
        notes: 'Returned in pristine condition'
      })
    });
    assert.strictEqual(returnRes.status, 200);

    // 6. Verify book available copies restored to 3
    const checkBook2 = await fetch(`${BASE_URL}/api/books/${testBook.id}`, { headers: authHeaders() });
    const checkData2 = await checkBook2.json();
    assert.strictEqual(checkData2.data.available_copies, 3, 'Available copies must restore to 3');

    // 7. Clean up test book
    const delBookRes = await fetch(`${BASE_URL}/api/books/${testBook.id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    assert.strictEqual(delBookRes.status, 200);
  });

  // 11. Reports & CSV Export
  await testStep('Reports & CSV Streaming for all types', async () => {
    const reportTypes = ['inventory', 'members', 'active-loans', 'returned-books', 'overdue', 'fines'];
    for (const t of reportTypes) {
      // JSON report
      const rRes = await fetch(`${BASE_URL}/api/reports?type=${t}`, { headers: authHeaders() });
      assert.strictEqual(rRes.status, 200, `Report type ${t} must return 200`);
      const rData = await rRes.json();
      assert.ok(Array.isArray(rData.data), `Data for ${t} must be array`);

      // CSV report
      const csvRes = await fetch(`${BASE_URL}/api/reports?type=${t}&format=csv`, { headers: authHeaders() });
      assert.strictEqual(csvRes.status, 200, `CSV for ${t} must return 200`);
      const csvText = await csvRes.text();
      assert.ok(csvText.length > 0, `CSV text for ${t} must not be empty`);
    }
  });

  console.log('====================================================');
  console.log(`  E2E HTTP TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests();
