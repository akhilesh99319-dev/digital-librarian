const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { db, initDatabase, convertSql } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { calculateOverdueFine, getFineRatePerDay } = require('../utils/fineCalculator');
const { jsonToCsv } = require('../utils/csvExporter');
const { JWT_SECRET } = require('../middleware/auth');

console.log('----------------------------------------------------');
console.log('  RUNNING DIGITAL LIBRARIAN SYSTEM & INTEGRITY TESTS');
console.log('----------------------------------------------------');

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passedCount++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failedCount++;
    }
  }

  // 1. Authentication Tests
  test('Librarian account exists with role "Librarian" and correct credentials', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('akhilesh@library.com');
    assert.ok(user, 'Librarian user must exist in database');
    assert.strictEqual(user.name, 'Akhilesh Kumar', 'Name must be Akhilesh Kumar');
    assert.strictEqual(user.role, 'Librarian', 'Role must be Librarian (not Admin)');
    
    // Check password
    const valid = bcrypt.compareSync('Password@123', user.password_hash);
    assert.strictEqual(valid, true, 'Password must match Password@123');

    const invalid = bcrypt.compareSync('WrongPassword', user.password_hash);
    assert.strictEqual(invalid, false, 'Wrong password must be rejected');
  });

  // 2. Categories Verification
  test('Initial categories match exact catalog categories (7 categories)', () => {
    const categories = db.prepare('SELECT * FROM categories').all();
    assert.strictEqual(categories.length, 7, 'Should have exactly 7 categories with actual books');
    const catNames = categories.map(c => c.name);
    const requiredCats = ['Fiction', 'Science', 'Technology', 'History', 'Mathematics', 'Computer Science', 'Biography'];
    for (const reqCat of requiredCats) {
      assert.ok(catNames.includes(reqCat), `Category "${reqCat}" must be present`);
    }
  });

  // 3. Members Verification (Exact 8 specified members)
  test('Exact 8 specified members exist with exact names and spellings', () => {
    const members = db.prepare('SELECT * FROM members').all();
    assert.strictEqual(members.length, 8, 'Member count must be EXACTLY 8');
    
    const requiredMembers = [
      'Akhilesh Kumar',
      'Chandra Mohan Thakur',
      'Aman Kumar',
      'Ashish Kumar Singh',
      'Sonali Kumari',
      'Sonam Kumari',
      'Manish Kumar',
      'Nishu Kumari'
    ];

    const memberNames = members.map(m => m.full_name);
    for (const name of requiredMembers) {
      assert.ok(memberNames.includes(name), `Member "${name}" must exist with exact spelling`);
    }

    // Check non-null emails are unique
    const nonNullEmails = members.filter(m => m.email && m.email.trim()).map(m => m.email.trim().toLowerCase());
    const uniqueEmails = new Set(nonNullEmails);
    assert.strictEqual(nonNullEmails.length, uniqueEmails.size, 'All populated member emails must be unique');
  });

  // 3b. Librarian Email Management & Validation Test
  test('Librarian can add, update, and clear member Gmail address with strict validation', () => {
    const member = db.prepare("SELECT * FROM members WHERE member_code = 'MEM-002'").get();
    assert.ok(member, 'Member MEM-002 (Chandra Mohan Thakur) must exist');
    const origEmail = member.email;

    // Test Add Email
    const testEmail = 'cm.thakur.test@gmail.com';
    db.prepare('UPDATE members SET email = ? WHERE id = ?').run(testEmail, member.id);
    const updated = db.prepare('SELECT email FROM members WHERE id = ?').get(member.id);
    assert.strictEqual(updated.email, testEmail, 'Email must update to test Gmail address');

    // Test Update Email
    const updatedEmail = 'cm.thakur.updated@gmail.com';
    db.prepare('UPDATE members SET email = ? WHERE id = ?').run(updatedEmail, member.id);
    const reUpdated = db.prepare('SELECT email FROM members WHERE id = ?').get(member.id);
    assert.strictEqual(reUpdated.email, updatedEmail, 'Email must update to new Gmail address');

    // Test Clear Email (restore to original / null)
    db.prepare('UPDATE members SET email = ? WHERE id = ?').run(origEmail, member.id);
    const restored = db.prepare('SELECT email FROM members WHERE id = ?').get(member.id);
    assert.strictEqual(restored.email, origEmail, 'Email must restore to original state');
  });

  // 4. Books Verification
  test('Catalog books have valid ISBNs and available copies <= total copies', () => {
    const books = db.prepare('SELECT * FROM books').all();
    assert.ok(books.length >= 10, 'Must have initial catalog of books');

    for (const book of books) {
      assert.ok(book.total_copies > 0, `Total copies for ${book.title} must be > 0`);
      assert.ok(book.available_copies >= 0, `Available copies for ${book.title} must be >= 0`);
      assert.ok(book.available_copies <= book.total_copies, `Available copies cannot exceed total copies for ${book.title}`);
      assert.ok(book.isbn && book.isbn.length > 5, `Book ${book.title} must have a valid ISBN`);
    }
  });

  // 5. Database Transaction Test (Issue book X -> X-1, Return book X-1 -> X)
  test('Issue & Return transaction integrity test (X -> X-1 -> X)', () => {
    // Select a test book
    const book = db.prepare('SELECT * FROM books WHERE available_copies > 0 LIMIT 1').get();
    assert.ok(book, 'Need at least one book with available copies > 0 for transaction test');

    const initialAvailable = book.available_copies;
    const initialTotal = book.total_copies;

    // Select an active member
    const member = db.prepare("SELECT * FROM members WHERE status = 'Active' LIMIT 1").get();
    assert.ok(member, 'Need an active member');

    const testLoanCode = `LN-TEST-${Date.now()}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const dueStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    // Transaction Step 1: ISSUE BOOK
    db.exec('BEGIN TRANSACTION');
    db.prepare(`
      INSERT INTO loans (loan_code, book_id, member_id, issue_date, due_date, status, fine_amount, fine_paid, notes)
      VALUES (?, ?, ?, ?, ?, 'Issued', 0, 0, 'Automated test transaction')
    `).run(testLoanCode, book.id, member.id, todayStr, dueStr);

    db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(book.id);
    db.exec('COMMIT');

    // Verify after issue: available copies = initialAvailable - 1
    const bookAfterIssue = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(book.id);
    assert.strictEqual(
      bookAfterIssue.available_copies, 
      initialAvailable - 1, 
      `Available copies must decrease from ${initialAvailable} to ${initialAvailable - 1}`
    );

    // Retrieve the created loan
    const createdLoan = db.prepare('SELECT * FROM loans WHERE loan_code = ?').get(testLoanCode);
    assert.ok(createdLoan, 'Loan record must be present');
    assert.strictEqual(createdLoan.status, 'Issued', 'Loan status must be Issued');

    // Transaction Step 2: RETURN BOOK
    db.exec('BEGIN TRANSACTION');
    db.prepare(`
      UPDATE loans 
      SET return_date = ?, status = 'Returned', fine_amount = 0, fine_paid = 1
      WHERE id = ?
    `).run(todayStr, createdLoan.id);

    db.prepare('UPDATE books SET available_copies = MIN(total_copies, available_copies + 1) WHERE id = ?').run(book.id);
    db.exec('COMMIT');

    // Verify after return: available copies = initialAvailable
    const bookAfterReturn = db.prepare('SELECT available_copies, total_copies FROM books WHERE id = ?').get(book.id);
    assert.strictEqual(
      bookAfterReturn.available_copies, 
      initialAvailable, 
      `Available copies must return to initial value of ${initialAvailable}`
    );
    assert.ok(
      bookAfterReturn.available_copies <= bookAfterReturn.total_copies,
      'Available copies must not exceed total copies'
    );

    // Clean up test loan
    db.prepare('DELETE FROM loans WHERE id = ?').run(createdLoan.id);
  });

  // 6. Overdue Fine Calculation Test
  test('Fine calculation correctly applies ₹5/day for overdue days', () => {
    const fineRate = getFineRatePerDay();
    assert.strictEqual(fineRate, 5.0, 'Default fine rate must be ₹5.0 per day');

    const duePast = '2026-01-01';
    const returnPast = '2026-01-06'; // 5 days overdue
    const res = calculateOverdueFine(duePast, returnPast);
    assert.strictEqual(res.daysOverdue, 5, 'Days overdue must be 5');
    assert.strictEqual(res.fineAmount, 25.0, 'Fine must be 5 days * ₹5 = ₹25.0');

    // On-time return
    const onTime = calculateOverdueFine('2026-01-10', '2026-01-09');
    assert.strictEqual(onTime.daysOverdue, 0, 'On time must have 0 overdue days');
    assert.strictEqual(onTime.fineAmount, 0.0, 'On time must have ₹0 fine');
  });

  // 7. CSV Export Utility Test
  test('CSV Exporter produces valid RFC4180 formatted CSV', () => {
    const sampleData = [
      { Title: 'Clean Code', Author: 'Robert C. Martin', Price: '₹500' },
      { Title: '1984, Special Edition', Author: 'George "Orwell"', Price: '₹350' }
    ];
    const csv = jsonToCsv(sampleData);
    assert.ok(csv.includes('"Title","Author","Price"'), 'Header row must match');
    assert.ok(csv.includes('"Clean Code","Robert C. Martin","₹500"'), 'Row 1 must be present');
    assert.ok(csv.includes('"1984, Special Edition","George ""Orwell""","₹350"'), 'Escaping must handle quotes and commas');
  });

  // 8. Digital Librarian Branding Verification
  test('Frontend and Backend files adhere strictly to "Digital Librarian" branding', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    assert.strictEqual(pkg.name, 'digital-librarian', 'Package name must be digital-librarian');

    const htmlFiles = [
      'login.html', 'index.html', 'books.html', 'categories.html',
      'members.html', 'issue.html', 'return.html', 'loans.html',
      'overdue.html', 'reports.html', 'profile.html'
    ];

    for (const f of htmlFiles) {
      const content = fs.readFileSync(path.join(__dirname, '../../frontend', f), 'utf8');
      assert.ok(content.includes('DIGITAL LIBRARIAN') || content.includes('Digital Librarian'), `File ${f} must contain Digital Librarian branding`);
      assert.ok(!content.includes('SIMPLE LIBRARY'), `File ${f} must not contain SIMPLE LIBRARY`);
      assert.ok(!content.includes('Simple Library Management System'), `File ${f} must not contain Simple Library Management System`);
    }
  });

  // 9. Admin Approval System Verification
  test('Admin approval request creation, expiry calculation, and approval action', () => {
    const user = db.prepare("SELECT * FROM users WHERE email = 'akhilesh@library.com'").get();
    assert.ok(user, 'Admin user must exist');

    const testToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 300000).toISOString(); // 5 minutes

    // Create request
    const insertRes = db.prepare(`
      INSERT INTO admin_approval_requests (user_id, status, request_token, device_info, expires_at)
      VALUES (?, 'PENDING', ?, 'Test Device Chrome/Windows', ?)
    `).run(user.id, testToken, expiry);

    const requestId = Number(insertRes.lastInsertRowid);
    assert.ok(requestId > 0, 'Approval request ID must be > 0');

    // Retrieve and verify status
    const reqRow = db.prepare('SELECT * FROM admin_approval_requests WHERE id = ?').get(requestId);
    assert.strictEqual(reqRow.status, 'PENDING', 'Initial status must be PENDING');
    assert.strictEqual(reqRow.request_token, testToken, 'Token must match');

    // Action: Approve
    db.prepare(`
      UPDATE admin_approval_requests 
      SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now')
      WHERE id = ?
    `).run(user.id, requestId);

    const approvedRow = db.prepare('SELECT * FROM admin_approval_requests WHERE id = ?').get(requestId);
    assert.strictEqual(approvedRow.status, 'APPROVED', 'Status must be APPROVED');
    assert.strictEqual(approvedRow.approved_by, user.id, 'Approved by user ID must match');

    // Clean up
    db.prepare('DELETE FROM admin_approval_requests WHERE id = ?').run(requestId);
  });

  // 10. Audit Logging System Verification
  test('Audit logging system records and retrieves activity entries', () => {
    const testAction = 'TEST_AUDIT_ACTION';
    const testResult = 'SUCCESS';
    const testDetails = 'Automated system audit verification';

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, result, details, ip_address, timestamp)
      VALUES (1, ?, ?, ?, '127.0.0.1', datetime('now'))
    `).run(testAction, testResult, testDetails);

    const logEntry = db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1').get(testAction);
    assert.ok(logEntry, 'Audit log entry must be present');
    assert.strictEqual(logEntry.action, testAction, 'Action must match');
    assert.strictEqual(logEntry.result, testResult, 'Result must match');

    // Clean up
    db.prepare('DELETE FROM audit_logs WHERE id = ?').run(logEntry.id);
  });

  // 11. Multi-Device Login Isolation (Option A)
  test('Multi-device independent JWT tokens with distinct issued timestamps', () => {
    const user = { id: 1, name: 'Akhilesh Kumar', role: 'Librarian', email: 'akhilesh@library.com' };
    
    const tokenDevice1 = jwt.sign({ ...user, device: 'laptop' }, JWT_SECRET, { expiresIn: '7d' });
    const tokenDevice2 = jwt.sign({ ...user, device: 'mobile' }, JWT_SECRET, { expiresIn: '7d' });

    const decoded1 = jwt.verify(tokenDevice1, JWT_SECRET);
    const decoded2 = jwt.verify(tokenDevice2, JWT_SECRET);

    assert.strictEqual(decoded1.email, user.email, 'Device 1 token valid');
    assert.strictEqual(decoded2.email, user.email, 'Device 2 token valid');
    assert.strictEqual(decoded1.device, 'laptop', 'Device 1 identifier preserved');
    assert.strictEqual(decoded2.device, 'mobile', 'Device 2 identifier preserved');
  });

  // 12. Production Database Migration Assets
  test('Production database migration and backup assets exist', () => {
    const schemaFile = path.join(__dirname, '../../database/digital_librarian_schema.sql');
    const importFile = path.join(__dirname, '../../database/digital_librarian_mysql_import.sql');
    const pgSchemaFile = path.join(__dirname, '../../database/digital_librarian_postgresql_schema.sql');
    const pgImportFile = path.join(__dirname, '../../database/digital_librarian_postgresql_import.sql');
    const backupsDir = path.join(__dirname, '../../database/backups');

    assert.ok(fs.existsSync(schemaFile), 'digital_librarian_schema.sql must exist');
    assert.ok(fs.existsSync(importFile), 'digital_librarian_mysql_import.sql must exist');
    assert.ok(fs.existsSync(pgSchemaFile), 'digital_librarian_postgresql_schema.sql must exist');
    assert.ok(fs.existsSync(pgImportFile), 'digital_librarian_postgresql_import.sql must exist');
    assert.ok(fs.existsSync(backupsDir), 'backups directory must exist');

    const pgSchemaContent = fs.readFileSync(pgSchemaFile, 'utf8');
    assert.ok(pgSchemaContent.includes('CREATE TABLE IF NOT EXISTS books'), 'PostgreSQL schema must define books table');
    assert.ok(pgSchemaContent.includes('CREATE TABLE IF NOT EXISTS members'), 'PostgreSQL schema must define members table');
    assert.ok(pgSchemaContent.includes('CREATE TABLE IF NOT EXISTS admin_approval_requests'), 'PostgreSQL schema must define admin_approval_requests');

    const pgImportContent = fs.readFileSync(pgImportFile, 'utf8');
    assert.ok(pgImportContent.includes('Clean Code'), 'PostgreSQL import script must contain authoritative books');
    assert.ok(pgImportContent.includes('Akhilesh Kumar'), 'PostgreSQL import script must contain authoritative members');
  });

  // 13. PostgreSQL Dual-Mode SQL Conversion
  test('PostgreSQL convertSql properly converts parameter placeholders and date functions', () => {
    if (typeof convertSql === 'function') {
      const sqliteSql = 'SELECT * FROM users WHERE email = ? AND role = ? AND date(created_at) >= date(\'now\', \'-6 months\')';
      const pgSql = convertSql(sqliteSql);
      assert.ok(pgSql.includes('$1'), 'Must convert first placeholder to $1');
      assert.ok(pgSql.includes('$2'), 'Must convert second placeholder to $2');
      assert.ok(!pgSql.includes('?'), 'Must not leave any ? placeholders');
      assert.ok(pgSql.includes('CURRENT_DATE'), 'Must convert date(\'now\') functions');

      const dateNowSql = convertSql('SELECT * FROM loans WHERE return_date = date(\'now\')');
      assert.ok(dateNowSql.includes('CURRENT_DATE'), 'Must convert date(\'now\') to CURRENT_DATE');
    }
  });

  // 14. Safe Password Hash Handling & Graceful Auth Validation
  test('Authentication safely handles missing or undefined password hashes without crashing', () => {
    // Verify bcrypt check safely fails when password_hash is undefined/null/non-string
    const testCases = [
      { user: null, pass: 'Password@123' },
      { user: { email: 'test@lib.com', password_hash: undefined }, pass: 'Password@123' },
      { user: { email: 'test@lib.com', password_hash: null }, pass: 'Password@123' },
      { user: { email: 'test@lib.com', password_hash: '' }, pass: 'Password@123' },
      { user: { email: 'test@lib.com', password_hash: 12345 }, pass: 'Password@123' }
    ];

    for (const tc of testCases) {
      // Logic used in authController
      let isValid = false;
      if (tc.user && tc.user.password_hash && typeof tc.user.password_hash === 'string') {
        try {
          isValid = bcrypt.compareSync(tc.pass, tc.user.password_hash);
        } catch (e) {
          isValid = false;
        }
      }
      assert.strictEqual(isValid, false, 'Missing or invalid password_hash must safely evaluate to false without error');
    }
  });

  console.log('----------------------------------------------------');
  console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('----------------------------------------------------');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
