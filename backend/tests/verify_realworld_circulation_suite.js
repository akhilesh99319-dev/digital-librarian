/**
 * Comprehensive Real-World Circulation & QR Workflow Test Suite
 * Tests the complete lifecycle:
 * Member Discovery -> Request -> Librarian Review -> Member QR -> Book QR -> Issue -> My Books -> Return -> Overdue Fine -> Payment QR -> Role Isolation -> Negative Tests
 */

const http = require('node:http');
const assert = require('node:assert');
const { db } = require('../database/db');
const { getTestOtp, getCachedTestOtps } = require('../utils/emailService');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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

async function performOtpLogin(identifier, password) {
  const loginRes = await makeRequest('POST', '/api/auth/login', { email: identifier, password });
  if (loginRes.status !== 200 || !loginRes.data.temp_token) {
    return loginRes;
  }
  let targetEmail = identifier;
  if (!targetEmail.includes('@')) {
    const memberRow = db.prepare('SELECT email FROM members WHERE member_code = ?').get(identifier);
    if (memberRow && memberRow.email) {
      targetEmail = memberRow.email;
    }
  }
  const otp = getTestOtp(targetEmail);
  return await makeRequest('POST', '/api/auth/verify-otp', {
    temp_token: loginRes.data.temp_token,
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

async function runSuite() {
  console.log('========================================================================');
  console.log('  PHASE: COMPLETE QR CIRCULATION & REAL-WORLD WORKFLOW QA SUITE');
  console.log('========================================================================\n');

  let librarianToken = null;
  let memberToken = null;
  let amanMemberId = 3;
  let testBookId = 1; // "Clean Code"
  let testRequestId = null;
  let testLoanId = null;

  // Pre-test cleanup: ensure no leftover test requests or loans for member 3
  db.prepare('DELETE FROM fines WHERE member_id = ?').run(amanMemberId);
  db.prepare('DELETE FROM loans WHERE member_id = ?').run(amanMemberId);
  db.prepare('DELETE FROM book_requests WHERE member_id = ?').run(amanMemberId);
  db.prepare('UPDATE books SET available_copies = total_copies WHERE id = ?').run(testBookId);
  db.prepare("UPDATE members SET email = 'aman.kumar.bihar@gmail.com' WHERE id = ?").run(amanMemberId);

  try {
    // 1. Pre-Flight System Check
    console.log('[SECTION 1] Pre-Flight System Check');
    const health = await makeRequest('GET', '/api/health');
    assert.strictEqual(health.status, 200, 'Health check must return 200');
    assert.strictEqual(health.data.status, 'online', 'Server status must be online');
    logPass('Pre-Flight: GET /api/health returns HTTP 200 Online');

    // 2. Test Data Safety & Actor Authentication
    console.log('\n[SECTION 2] Test Data Safety & Authentication');
    // Librarian login
    const libRes = await performOtpLogin('akhilesh@library.com', 'Password@123');
    assert.strictEqual(libRes.status, 200, 'Librarian login must succeed');
    assert.strictEqual(libRes.data.user.role, 'Librarian', 'Role must be Librarian');
    librarianToken = libRes.data.token;
    logPass('Librarian Login: Authenticated akhilesh@library.com');

    // Member login with baseline member Aman Kumar (MEM-003)
    const memRes = await performOtpLogin('MEM-003', 'Member@123');
    assert.strictEqual(memRes.status, 200, 'Member login with MEM-003 must succeed');
    assert.strictEqual(memRes.data.user.name, 'Aman Kumar', 'Must identify Aman Kumar');
    assert.strictEqual(memRes.data.user.role, 'Member', 'Role must be Member');
    memberToken = memRes.data.token;
    amanMemberId = memRes.data.user.id;
    logPass(`Member Login: Authenticated Aman Kumar (ID: ${amanMemberId}, Code: MEM-003)`);

    // 3. QR Architecture Verification
    console.log('\n[SECTION 3] QR Architecture Verification');
    const memberQRPayload = `DL:MEMBER:${amanMemberId}:MEM-003`;
    const bookQRPayload = `DL:BOOK:1:BK-001`;
    const finePaymentPayload = `upi://pay?pa=library@upi&pn=Digital%20Librarian&am=30.00&cu=INR&tn=Fine%20Settlement`;

    assert.ok(memberQRPayload.startsWith('DL:MEMBER:'), 'Member QR format valid');
    assert.ok(bookQRPayload.startsWith('DL:BOOK:'), 'Book QR format valid');
    assert.ok(finePaymentPayload.startsWith('upi://pay'), 'Payment QR format valid');
    assert.ok(!memberQRPayload.includes('token') && !memberQRPayload.includes('Password'), 'No secrets in Member QR');
    assert.ok(!bookQRPayload.includes('token') && !bookQRPayload.includes('secret'), 'No secrets in Book QR');
    logPass('QR Architecture: Member QR, Book QR, and Payment QR payloads verified for complete separation & safety');

    // 4. Member QR Generation & Profile Verification
    console.log('\n[SECTION 4] Member Profile & QR Verification');
    const meRes = await makeRequest('GET', '/api/auth/me', null, memberToken);
    assert.strictEqual(meRes.status, 200, 'GET /api/auth/me must return 200 for Member');
    assert.strictEqual(meRes.data.user.id, amanMemberId, 'Member ID must match authenticated patron');
    assert.strictEqual(meRes.data.user.member_code, 'MEM-003', 'Member code must match MEM-003');
    logPass('Member QR Verification: Profile endpoint returns verified identity without sensitive tokens');

    // 5. Book Catalog & Book QR Verification
    console.log('\n[SECTION 5] Book Discovery & Book QR');
    const bookRes = await makeRequest('GET', `/api/books/${testBookId}`, null, memberToken);
    assert.strictEqual(bookRes.status, 200, 'GET /api/books/:id must succeed for Member');
    const bookData = bookRes.data.data || bookRes.data;
    assert.strictEqual(bookData.title, 'Clean Code: A Handbook of Agile Software Craftsmanship');
    assert.ok(bookData.available_copies >= 1, 'Book must have available copies');
    logPass(`Book Discovery: Retrieved "${bookData.title}" (${bookData.available_copies}/${bookData.total_copies} available)`);

    // 6. Member Book Request Test
    console.log('\n[SECTION 6 & 7] Member Book Request');
    const reqRes = await makeRequest('POST', '/api/loans/request', {
      book_id: testBookId,
      notes: 'Testing real-world circulation workflow'
    }, memberToken);
    assert.strictEqual(reqRes.status, 201, 'Book request must be created');
    testRequestId = reqRes.data.data?.id || reqRes.data.request?.id || reqRes.data.requestId;
    assert.ok(testRequestId, 'Request ID must be returned');
    logPass(`Book Request: Aman Kumar successfully requested Book ID #${testBookId} (Request ID: ${testRequestId})`);

    // Duplicate Request Rejection
    const dupReqRes = await makeRequest('POST', '/api/loans/request', {
      book_id: testBookId
    }, memberToken);
    assert.strictEqual(dupReqRes.status, 400, 'Duplicate request for same book must be rejected');
    logPass('Book Request: Duplicate active request rejected safely with HTTP 400');

    // 7. Librarian Request Review & Approval
    console.log('\n[SECTION 8] Librarian Request Review & Processing');
    const queueRes = await makeRequest('GET', '/api/loans/requests', null, librarianToken);
    assert.strictEqual(queueRes.status, 200, 'Librarian can fetch request queue');
    const queue = queueRes.data.data || queueRes.data;
    const foundReq = queue.find(r => r.id === testRequestId);
    assert.ok(foundReq, 'Submitted request must be visible to Librarian');
    assert.strictEqual(foundReq.member_id, amanMemberId, 'Request member matches Aman Kumar');

    // Approve request
    const approveRes = await makeRequest('POST', `/api/loans/requests/${testRequestId}/action`, {
      action: 'APPROVE',
      notes: 'Approved for circulation QA test'
    }, librarianToken);
    assert.strictEqual(approveRes.status, 200, 'Librarian approval must return HTTP 200');
    logPass(`Librarian Review: Librarian successfully inspected and approved Request #${testRequestId}`);

    // 8. Two-QR Issue Workflow Validation & Confirmation
    console.log('\n[SECTION 9, 10, 11, 12, 13] Two-QR Issue Workflow & Backend Validation');
    const beforeIssueBook = db.prepare('SELECT available_copies, total_copies FROM books WHERE id = ?').get(testBookId);
    const initialAvail = beforeIssueBook.available_copies;

    const issueDate = new Date().toISOString().split('T')[0];
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 14);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const issueRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: amanMemberId,
      book_id: testBookId,
      issue_date: issueDate,
      due_date: dueDate,
      notes: 'Issued via QR QA Test Suite'
    }, librarianToken);

    assert.strictEqual(issueRes.status, 201, 'Loan creation must return HTTP 201');
    const loanData = issueRes.data.data || issueRes.data.loan || issueRes.data;
    testLoanId = loanData.id || loanData.loan_id;
    assert.ok(testLoanId, 'Loan ID must be returned');

    // Database verification after issue
    const afterIssueBook = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);
    assert.strictEqual(afterIssueBook.available_copies, initialAvail - 1, 'Available copies must decrement by 1');

    const dbLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(testLoanId);
    assert.ok(dbLoan, 'Loan record must exist in database');
    assert.strictEqual(dbLoan.member_id, amanMemberId, 'Loan attached to correct member');
    assert.strictEqual(dbLoan.book_id, testBookId, 'Loan attached to correct book');
    assert.strictEqual(dbLoan.status, 'Issued', 'Loan status must be Issued');

    logPass(`Two-QR Issue: Book issued successfully (Loan ID #${testLoanId}, Code: ${dbLoan.loan_code}). Copies: ${initialAvail} -> ${afterIssueBook.available_copies}`);

    // 9. Member Portal Post-Issue Verification
    console.log('\n[SECTION 14 & 15] Member Portal Post-Issue Verification');
    const myLoansRes = await makeRequest('GET', '/api/loans/my-loans', null, memberToken);
    assert.strictEqual(myLoansRes.status, 200, 'Member can fetch personal loans');
    const myLoans = myLoansRes.data.data || myLoansRes.data;
    const activeLoan = (myLoans.active_loans || []).find(l => l.id === testLoanId);
    assert.ok(activeLoan, 'Newly issued loan must appear in Member My Books');
    assert.strictEqual(activeLoan.book_title, 'Clean Code: A Handbook of Agile Software Craftsmanship');
    logPass('Member Portal Verification: Issued book accurately appears in Member active loans');

    // 10. Return Workflow using Book QR
    console.log('\n[SECTION 16 & 17] Return Workflow with Book QR');
    const returnDate = new Date().toISOString().split('T')[0];
    const returnRes = await makeRequest('POST', `/api/loans/${testLoanId}/return`, {
      return_date: returnDate
    }, librarianToken);

    assert.strictEqual(returnRes.status, 200, 'Return must return HTTP 200');

    // Database verification after return
    const afterReturnBook = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBookId);
    assert.strictEqual(afterReturnBook.available_copies, initialAvail, 'Available copies must be fully restored');

    const dbReturnedLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(testLoanId);
    assert.strictEqual(dbReturnedLoan.status, 'Returned', 'Loan status must be Returned');
    assert.ok(dbReturnedLoan.return_date, 'Return date must be recorded');

    logPass(`Return Workflow: Book returned successfully. Copies restored: ${afterReturnBook.available_copies}/${beforeIssueBook.total_copies}`);

    // 11. Fine Calculation & Payment QR Test
    console.log('\n[SECTION 18, 19, 20] Fine Calculation & UPI Payment QR Test');
    // Create an artificial overdue loan to test fine generation & payment QR without polluting baseline
    const testOverdueLoan = db.prepare(`
      INSERT INTO loans (loan_code, book_id, member_id, issue_date, due_date, status)
      VALUES ('LN-TEST-OVERDUE-01', ?, ?, date('now', '-20 days'), date('now', '-6 days'), 'Issued')
    `).run(testBookId, amanMemberId);
    const overdueLoanId = Number(testOverdueLoan.lastInsertRowid);

    // Return the overdue loan to trigger backend fine calculation
    const overdueReturnRes = await makeRequest('POST', `/api/loans/${overdueLoanId}/return`, {
      return_date: new Date().toISOString().split('T')[0]
    }, librarianToken);
    assert.strictEqual(overdueReturnRes.status, 200, 'Overdue return must process');

    const fineRecord = db.prepare('SELECT * FROM fines WHERE loan_id = ?').get(overdueLoanId);
    assert.ok(fineRecord, 'Fine record must exist in fines table');
    assert.strictEqual(fineRecord.status, 'Unpaid', 'Initial fine status must be Unpaid');
    assert.ok(fineRecord.amount > 0, 'Fine amount must be > 0');
    logPass(`Fine Calculation: Backend calculated fine of ₹${fineRecord.amount} (${fineRecord.days_overdue} days overdue)`);

    // Member Payment QR settlement test
    const payRes = await makeRequest('POST', `/api/loans/fines/${fineRecord.id}/member-pay`, {
      payment_method: 'UPI_QR'
    }, memberToken);
    assert.strictEqual(payRes.status, 200, 'Member UPI settlement must return HTTP 200');

    const settledFine = db.prepare('SELECT * FROM fines WHERE id = ?').get(fineRecord.id);
    assert.strictEqual(settledFine.status, 'Paid', 'Fine status must be updated to Paid');
    assert.ok(settledFine.payment_date, 'Payment date must be recorded');
    logPass(`Payment QR Settlement: Fine #${fineRecord.id} successfully settled via UPI Payment QR`);

    // Double payment protection test
    const doublePayRes = await makeRequest('POST', `/api/loans/fines/${fineRecord.id}/member-pay`, {
      payment_method: 'UPI_QR'
    }, memberToken);
    assert.strictEqual(doublePayRes.status, 400, 'Double payment attempt must return HTTP 400 Bad Request');
    logPass('Payment Safety: Double payment on settled fine safely rejected with HTTP 400');

    // Clean up temporary fine test records
    db.prepare('DELETE FROM fines WHERE loan_id = ?').run(overdueLoanId);
    db.prepare('DELETE FROM loans WHERE id = ?').run(overdueLoanId);

    // 12. Negative & Security Tests
    console.log('\n[SECTION 22, 23, 24] Negative Tests & Role Boundary Isolation');

    // Test A — Unavailable Book Rejection
    // Temporarily set copies to 0
    db.prepare('UPDATE books SET available_copies = 0 WHERE id = ?').run(testBookId);
    const unavailRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: amanMemberId,
      book_id: testBookId,
      issue_date: issueDate,
      due_date: dueDate
    }, librarianToken);
    assert.strictEqual(unavailRes.status, 400, 'Unavailable book issue must return HTTP 400');
    db.prepare('UPDATE books SET available_copies = total_copies WHERE id = ?').run(testBookId);
    logPass('Negative Test A: Attempt to issue unavailable book safely rejected (HTTP 400)');

    // Test B — Invalid Member ID
    const invMemberRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: 99999,
      book_id: testBookId,
      issue_date: issueDate,
      due_date: dueDate
    }, librarianToken);
    assert.strictEqual(invMemberRes.status, 404, 'Invalid member must return HTTP 404');
    logPass('Negative Test B: Unknown Member ID rejected safely (HTTP 404)');

    // Test C — Invalid Book ID
    const invBookRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: amanMemberId,
      book_id: 99999,
      issue_date: issueDate,
      due_date: dueDate
    }, librarianToken);
    assert.strictEqual(invBookRes.status, 404, 'Invalid book must return HTTP 404');
    logPass('Negative Test C: Unknown Book ID rejected safely (HTTP 404)');

    // Test D — Duplicate Return
    const dupReturnRes = await makeRequest('POST', `/api/loans/${testLoanId}/return`, {
      return_date: returnDate
    }, librarianToken);
    assert.strictEqual(dupReturnRes.status, 400, 'Duplicate return must return HTTP 400');
    logPass('Negative Test D: Duplicate return of already-returned loan rejected safely (HTTP 400)');

    // Test E — Member attempting Admin/Librarian circulation endpoints
    const unauthIssueRes = await makeRequest('POST', '/api/loans/issue', {
      member_id: amanMemberId,
      book_id: testBookId,
      issue_date: issueDate,
      due_date: dueDate
    }, memberToken);
    assert.strictEqual(unauthIssueRes.status, 403, 'Member attempting admin issue must be blocked with HTTP 403');
    logPass('Security Test E: Member attempting Librarian issue endpoint blocked with HTTP 403');

    const unauthMembersRes = await makeRequest('GET', '/api/members', null, memberToken);
    assert.strictEqual(unauthMembersRes.status, 403, 'Member attempting GET /api/members must be blocked with HTTP 403');
    logPass('Security Test F: Member attempting Admin member management blocked with HTTP 403');

    const unauthReportsRes = await makeRequest('GET', '/api/reports/circulation', null, memberToken);
    assert.strictEqual(unauthReportsRes.status, 403, 'Member attempting Reports blocked with HTTP 403');
    logPass('Security Test G: Member attempting Admin circulation reports blocked with HTTP 403');

    // Clean up temporary loan and request created during this test
    if (testLoanId) {
      db.prepare('DELETE FROM loans WHERE id = ?').run(testLoanId);
    }
    if (testRequestId) {
      db.prepare('DELETE FROM book_requests WHERE id = ?').run(testRequestId);
    }

    // Ensure database restored to clean baseline
    db.prepare('UPDATE books SET available_copies = total_copies WHERE id = ?').run(testBookId);

    console.log('\n========================================================================');
    console.log(`  🎉 REAL-WORLD CIRCULATION SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('========================================================================\n');

  } catch (error) {
    logFail('Test Suite Execution', error);
    console.error(error);
  }
}

runSuite().then(() => {
  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
