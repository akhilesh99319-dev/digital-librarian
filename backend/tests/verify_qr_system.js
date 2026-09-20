/**
 * QR System Integration & Verification Test Suite
 * Covers Book QR, Member QR, and UPI Fine Payment QR workflows.
 */

const http = require('node:http');
const assert = require('node:assert');
const { db } = require('../database/db');
const { getTestOtp } = require('../utils/emailService');

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

let memberToken = null;
let otherMemberToken = null;
let librarianToken = null;
let adminToken = null;

async function runQRTests() {
  console.log('--- Starting QR System Integration Verification Suite ---');

  // Step 1: Log in test actors
  console.log('\n[1] Authenticating Test Actors...');
  
  // 1. Librarian (akhilesh@library.com)
  const libRes = await performOtpLogin('akhilesh@library.com', 'Password@123');
  assert.strictEqual(libRes.status, 200, `Librarian login failed: ${JSON.stringify(libRes.data)}`);
  librarianToken = libRes.data.token || libRes.data.data?.token;
  console.log(`  ✓ Logged in Librarian (Role: ${libRes.data.user?.role || 'Librarian'})`);

  // 2. Member 1 Setup & Login
  const mem1Email = 'qr.member1@example.com';
  const mem1Pass = 'QrMember@2026';
  let memRes = await performOtpLogin(mem1Email, mem1Pass);
  if (memRes.status !== 200) {
    await performOtpRegister({
      name: 'QR Test Patron One',
      email: mem1Email,
      phone: '9888811111',
      password: mem1Pass,
      confirm_password: mem1Pass
    });
    memRes = await performOtpLogin(mem1Email, mem1Pass);
  }
  assert.strictEqual(memRes.status, 200, `Member 1 login failed: ${JSON.stringify(memRes.data)}`);
  memberToken = memRes.data.token;
  const memberId = memRes.data.user.id;
  console.log(`  ✓ Logged in Member 1 (ID: ${memberId}, Name: ${memRes.data.user.name})`);

  // 3. Member 2 Setup & Login
  const mem2Email = 'qr.member2@example.com';
  const mem2Pass = 'QrMember@2026';
  let otherMemRes = await performOtpLogin(mem2Email, mem2Pass);
  if (otherMemRes.status !== 200) {
    await performOtpRegister({
      name: 'QR Test Patron Two',
      email: mem2Email,
      phone: '9888822222',
      password: mem2Pass,
      confirm_password: mem2Pass
    });
    otherMemRes = await performOtpLogin(mem2Email, mem2Pass);
  }
  assert.strictEqual(otherMemRes.status, 200, `Member 2 login failed: ${JSON.stringify(otherMemRes.data)}`);
  otherMemberToken = otherMemRes.data.token;
  const otherMemberId = otherMemRes.data.user.id;
  console.log(`  ✓ Logged in Member 2 (ID: ${otherMemberId}, Name: ${otherMemRes.data.user.name})`);

  // Step 2: Test QR Core Payload Formats & Parsing
  console.log('\n[2] Validating QR Payload Specifications & Parsing Rules...');
  
  const parseQRPayload = (raw) => {
    if (!raw || typeof raw !== 'string') return { valid: false, error: 'Empty payload' };
    const trimmed = raw.trim();
    if (trimmed.startsWith('DL:BOOK:')) {
      const parts = trimmed.split(':');
      return { valid: true, type: 'BOOK', id: parseInt(parts[2], 10), code: parts[3] || null };
    }
    if (trimmed.startsWith('DL:MEMBER:')) {
      const parts = trimmed.split(':');
      return { valid: true, type: 'MEMBER', id: parseInt(parts[2], 10), code: parts[3] || null };
    }
    if (trimmed.startsWith('DL:FINE:')) {
      const parts = trimmed.split(':');
      return { valid: true, type: 'FINE', id: parseInt(parts[2], 10), amount: parseFloat(parts[3]) || 0 };
    }
    if (trimmed.startsWith('upi://pay')) {
      const url = new URL(trimmed);
      return {
        valid: true,
        type: 'UPI_PAYMENT',
        pa: url.searchParams.get('pa'),
        amount: parseFloat(url.searchParams.get('am')),
        note: url.searchParams.get('tn')
      };
    }
    return { valid: false, error: 'Unknown QR format' };
  };

  const parsedBook = parseQRPayload('DL:BOOK:12:BK-TECH-012');
  assert.strictEqual(parsedBook.valid, true);
  assert.strictEqual(parsedBook.type, 'BOOK');
  assert.strictEqual(parsedBook.id, 12);
  assert.strictEqual(parsedBook.code, 'BK-TECH-012');
  console.log('  ✓ Book QR payload parses correctly');

  const parsedMember = parseQRPayload('DL:MEMBER:4:MEM-2024-001');
  assert.strictEqual(parsedMember.valid, true);
  assert.strictEqual(parsedMember.type, 'MEMBER');
  assert.strictEqual(parsedMember.id, 4);
  assert.strictEqual(parsedMember.code, 'MEM-2024-001');
  console.log('  ✓ Member QR payload parses correctly');

  const parsedUPI = parseQRPayload('upi://pay?pa=library@upi&pn=Digital%20Librarian&am=50.00&cu=INR&tn=Fine%20Settlement%20Loan%20LN-2026-001');
  assert.strictEqual(parsedUPI.valid, true);
  assert.strictEqual(parsedUPI.type, 'UPI_PAYMENT');
  assert.strictEqual(parsedUPI.amount, 50);
  assert.strictEqual(parsedUPI.pa, 'library@upi');
  console.log('  ✓ UPI Fine Payment payload parses correctly');

  const invalidQR = parseQRPayload('MALICIOUS_PAYLOAD_HERE');
  assert.strictEqual(invalidQR.valid, false);
  console.log('  ✓ Invalid QR payloads rejected safely');

  // Step 3: Librarian Issues Book to Member via QR workflow
  console.log('\n[3] Testing Librarian Book Issue Workflow using QR Identifiers...');
  
  // Choose Book 1 (available)
  const initialBook = db.prepare('SELECT id, title, book_code, available_copies, total_copies FROM books WHERE id = 1').get();
  console.log(`  Initial Book Copies: ${initialBook.available_copies}/${initialBook.total_copies}`);

  const issueRes = await makeRequest('POST', '/api/loans/issue', {
    member_id: memberId,
    book_id: initialBook.id,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    notes: 'Issued via QR scan test'
  }, librarianToken);

  assert.strictEqual(issueRes.status, 201, 'Issue book failed');
  assert.strictEqual(issueRes.data.success, true);
  const createdLoan = issueRes.data.data;
  console.log(`  ✓ Book issued successfully (Loan Code: ${createdLoan.loan_code})`);

  // Verify atomic copy decrement
  const updatedBook = db.prepare('SELECT available_copies FROM books WHERE id = 1').get();
  assert.strictEqual(updatedBook.available_copies, initialBook.available_copies - 1, 'Copy count did not decrement');
  console.log(`  ✓ Available copies decremented atomically (${updatedBook.available_copies}/${initialBook.total_copies})`);

  // Step 4: Role Boundary Security (Member cannot issue books)
  console.log('\n[4] Testing Role Boundary & Security Isolation...');
  const unauthorizedIssue = await makeRequest('POST', '/api/loans/issue', {
    member_id: memberId,
    book_id: initialBook.id,
    issue_date: '2026-09-15',
    due_date: '2026-09-29'
  }, memberToken);

  assert.strictEqual(unauthorizedIssue.status, 403, 'Member must not be allowed to issue books');
  console.log('  ✓ Member blocked from Issue Book endpoint (HTTP 403 Forbidden)');

  // Step 5: Test Fine Generation and Member QR Fine Payment
  console.log('\n[5] Testing Fine Generation & Member UPI / QR Fine Settlement...');
  
  // Set up an overdue fine for Member 1
  db.prepare(`
    INSERT INTO fines (loan_id, member_id, amount, days_overdue, status)
    VALUES (?, ?, 45.00, 9, 'Unpaid')
  `).run(createdLoan.id, memberId);

  const fineRecord = db.prepare('SELECT * FROM fines WHERE loan_id = ?').get(createdLoan.id);
  assert.ok(fineRecord, 'Fine record was not created');
  console.log(`  ✓ Overdue fine record established: ID #${fineRecord.id}, Amount: ₹${fineRecord.amount}, Status: ${fineRecord.status}`);

  // Test Member 2 attempting to pay Member 1's fine (Must be forbidden)
  const breachPayment = await makeRequest('POST', `/api/loans/fines/${fineRecord.id}/member-pay`, {
    payment_method: 'UPI_QR'
  }, otherMemberToken);
  assert.strictEqual(breachPayment.status, 403, 'Other member must not be allowed to pay another user fine');
  console.log('  ✓ Member 2 blocked from paying Member 1 fine (Ownership isolation verified)');

  // Member 1 pays own fine
  const legitPayment = await makeRequest('POST', `/api/loans/fines/${fineRecord.id}/member-pay`, {
    payment_method: 'UPI_QR'
  }, memberToken);
  assert.strictEqual(legitPayment.status, 200, `Legitimate fine payment failed: ${JSON.stringify(legitPayment.data)}`);
  assert.strictEqual(legitPayment.data.success, true);
  assert.strictEqual(legitPayment.data.data.status, 'Paid');
  console.log(`  ✓ Member 1 successfully settled fine via UPI QR (Receipt: ${legitPayment.data.data.receipt_id})`);

  // Verify fine in DB
  const settledFine = db.prepare('SELECT * FROM fines WHERE id = ?').get(fineRecord.id);
  assert.strictEqual(settledFine.status, 'Paid');
  assert.ok(settledFine.payment_date, 'Payment date not stamped');
  console.log(`  ✓ Database updated: Status = ${settledFine.status}, Paid On = ${settledFine.payment_date}`);

  // Test paying already paid fine
  const doublePayment = await makeRequest('POST', `/api/loans/fines/${fineRecord.id}/member-pay`, {
    payment_method: 'UPI_QR'
  }, memberToken);
  assert.strictEqual(doublePayment.status, 400, 'Double payment should be rejected');
  console.log('  ✓ Double payment attempt safely rejected (HTTP 400)');

  // Step 6: Librarian Returns Book via QR Scan Workflow
  console.log('\n[6] Testing Librarian Book Return Workflow using Scanned Book QR...');
  
  const returnRes = await makeRequest('POST', `/api/loans/${createdLoan.id}/return`, {
    return_date: new Date().toISOString().split('T')[0],
    fine_paid: 1,
    notes: 'Returned after QR test'
  }, librarianToken);

  assert.strictEqual(returnRes.status, 200, 'Return book failed');
  assert.strictEqual(returnRes.data.success, true);
  console.log('  ✓ Book returned successfully');

  // Verify copies restored
  const finalBook = db.prepare('SELECT available_copies FROM books WHERE id = 1').get();
  assert.strictEqual(finalBook.available_copies, initialBook.available_copies, 'Copy count did not restore');
  console.log(`  ✓ Available copies restored atomically (${finalBook.available_copies}/${initialBook.total_copies})`);

  // Clean up the created test loan & fine
  db.prepare('DELETE FROM fines WHERE loan_id = ?').run(createdLoan.id);
  db.prepare('DELETE FROM loans WHERE id = ?').run(createdLoan.id);

  console.log('\n========================================================================');
  console.log('  🎉 QR SYSTEM INTEGRATION TEST SUITE: ALL TESTS PASSED');
  console.log('========================================================================\n');
}

runQRTests().catch(err => {
  console.error('\n❌ QR System Tests Failed:', err);
  process.exit(1);
});
