const assert = require('node:assert');
const { db } = require('../database/db');

console.log('================================================================');
console.log('  AUTHORITATIVE DATASET & SPECIFICATION VERIFICATION SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function check(title, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ FAIL: ${title}`);
    console.error(`     Reason: ${e.message}`);
    failed++;
  }
}

// 1. Books (62 titles, 255 total copies, 255 available copies)
check('Books: Exactly 62 unique titles, 255 total copies, 255 available copies', () => {
  const books = db.prepare('SELECT * FROM books ORDER BY id ASC').all();
  assert.strictEqual(books.length, 62, `Expected 62 books, found ${books.length}`);

  const totalCopies = books.reduce((s, b) => s + b.total_copies, 0);
  assert.strictEqual(totalCopies, 255, `Expected 255 total copies, found ${totalCopies}`);

  const availCopies = books.reduce((s, b) => s + b.available_copies, 0);
  assert.strictEqual(availCopies, 255, `Expected 255 available copies, found ${availCopies}`);

  const expectedBooks = [
    { title: 'Clean Code: A Handbook of Agile Software Craftsmanship', copies: 5 },
    { title: 'Introduction to Algorithms (CLRS)', copies: 4 },
    { title: 'Design Patterns: Elements of Reusable Object-Oriented Software', copies: 4 },
    { title: 'The Pragmatic Programmer: Your Journey To Mastery', copies: 6 },
    { title: 'A Brief History of Time', copies: 5 },
    { title: 'Cosmos', copies: 3 },
    { title: 'Linear Algebra and Its Applications', copies: 4 },
    { title: 'Sapiens: A Brief History of Humankind', copies: 5 },
    { title: 'Steve Jobs', copies: 4 },
    { title: 'To Kill a Mockingbird', copies: 6 },
    { title: '1984', copies: 5 },
    { title: 'The Innovators: How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution', copies: 4 }
  ];

  for (const eb of expectedBooks) {
    const found = books.find(b => b.title === eb.title);
    assert.ok(found, `Book "${eb.title}" must exist in catalog`);
    assert.strictEqual(found.total_copies, eb.copies, `Book "${eb.title}" total copies must be ${eb.copies}, got ${found.total_copies}`);
    assert.strictEqual(found.available_copies, eb.copies, `Book "${eb.title}" available copies must be ${eb.copies}, got ${found.available_copies}`);
  }
});

// 2. Members (8 members)
check('Members: Exactly 8 specified members with exact codes', () => {
  const members = db.prepare('SELECT * FROM members ORDER BY id ASC').all();
  assert.strictEqual(members.length, 8, `Expected 8 members, found ${members.length}`);

  const expectedMembers = [
    { name: 'Akhilesh Kumar', code: 'MEM-001' },
    { name: 'Chandra Mohan Thakur', code: 'MEM-002' },
    { name: 'Aman Kumar', code: 'MEM-003' },
    { name: 'Ashish Kumar Singh', code: 'MEM-004' },
    { name: 'Sonali Kumari', code: 'MEM-005' },
    { name: 'Sonam Kumari', code: 'MEM-006' },
    { name: 'Manish Kumar', code: 'MEM-007' },
    { name: 'Nishu Kumari', code: 'MEM-008' }
  ];

  for (const em of expectedMembers) {
    const found = members.find(m => m.full_name === em.name);
    assert.ok(found, `Member "${em.name}" must exist`);
    assert.strictEqual(found.member_code, em.code, `Member "${em.name}" code must be ${em.code}, got ${found.member_code}`);
  }
});

// 3. Categories (16 categories)
check('Categories: Exactly 16 specified categories', () => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
  assert.strictEqual(categories.length, 16, `Expected 16 categories, found ${categories.length}`);

  const expectedCategories = [
    'Computer Science',
    'Technology',
    'Science',
    'Mathematics',
    'Fiction',
    'History',
    'Biography',
    'Adventure',
    'Science Fiction',
    'Horror',
    'Drama',
    'Mystery',
    "Children's",
    'Fantasy',
    'Classic',
    'Philosophy'
  ];

  const catNames = categories.map(c => c.name);
  for (const ec of expectedCategories) {
    assert.ok(catNames.includes(ec), `Category "${ec}" must exist`);
  }
});

// 4. Authors
check('Authors: Specified baseline authors present', () => {
  const books = db.prepare('SELECT author FROM books').all();
  const authors = Array.from(new Set(books.map(b => b.author)));
  assert.ok(authors.length >= 11, `Expected at least 11 authors, found ${authors.length}`);

  const expectedAuthors = [
    'Robert C. Martin',
    'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest',
    'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
    'David Thomas, Andrew Hunt',
    'Stephen Hawking',
    'Carl Sagan',
    'Gilbert Strang',
    'Yuval Noah Harari',
    'Walter Isaacson',
    'Harper Lee',
    'George Orwell'
  ];

  for (const ea of expectedAuthors) {
    assert.ok(authors.includes(ea), `Author "${ea}" must exist`);
  }
});

// 5. Publishers
check('Publishers: Specified baseline publishers present', () => {
  const books = db.prepare('SELECT publisher FROM books').all();
  const publishers = Array.from(new Set(books.map(b => b.publisher)));
  assert.ok(publishers.length >= 11, `Expected at least 11 publishers, found ${publishers.length}`);

  const expectedPublishers = [
    'Prentice Hall',
    'MIT Press',
    'Addison-Wesley',
    'Addison-Wesley Professional',
    'Bantam Books',
    'Ballantine Books',
    'Cengage Learning',
    'Harper',
    'Simon & Schuster',
    'Harper Perennial Modern Classics',
    'Signet Classic'
  ];

  for (const ep of expectedPublishers) {
    assert.ok(publishers.includes(ep), `Publisher "${ep}" must exist`);
  }
});

// 6. Librarian User
check('Librarian: Akhilesh Kumar, akhilesh@library.com, Role: Librarian', () => {
  const users = db.prepare('SELECT * FROM users').all();
  assert.strictEqual(users.length, 1, 'Expected 1 user account');
  const user = users[0];
  assert.strictEqual(user.name, 'Akhilesh Kumar');
  assert.strictEqual(user.email, 'akhilesh@library.com');
  assert.strictEqual(user.role, 'Librarian');
});

// 7. Baseline Transactions & Fines
check('Baseline Circulation: 0 active loans, 0 overdue books, ₹0.00 pending fines', () => {
  const loansCount = db.prepare('SELECT COUNT(*) as count FROM loans WHERE return_date IS NULL').get().count;
  assert.strictEqual(loansCount, 0, 'Active loans count must be 0 at baseline');

  const overdueCount = db.prepare("SELECT COUNT(*) as count FROM loans WHERE return_date IS NULL AND due_date < date('now')").get().count;
  assert.strictEqual(overdueCount, 0, 'Overdue loans count must be 0 at baseline');

  const finesSum = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM fines WHERE status = 'Unpaid'").get().total;
  assert.strictEqual(finesSum, 0, 'Pending fines must be 0.00 at baseline');
});

console.log('\n================================================================');
console.log(`  AUTHORITATIVE VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
