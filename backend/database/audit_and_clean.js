const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, '../../database/library.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at:', dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

console.log('====================================================');
console.log('  STARTING DIGITAL LIBRARIAN DATA AUDIT & CLEANUP   ');
console.log('====================================================');

// 1. Audit and clean Categories
console.log('\n[1/6] Auditing Categories...');
// Find categories with no books
const unusedCats = db.prepare(`
  SELECT c.id, c.name 
  FROM categories c 
  LEFT JOIN books b ON c.id = b.category_id 
  WHERE b.id IS NULL
`).all();

for (const uc of unusedCats) {
  console.log(`  -> Removing sample/empty category: "${uc.name}" (ID: ${uc.id})`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(uc.id);
}

// 2. Audit and clean Loans & Fines
console.log('\n[2/6] Auditing Circulation & Fine Records...');
const loanCount = db.prepare('SELECT COUNT(*) as count FROM loans').get().count;
const fineCount = db.prepare('SELECT COUNT(*) as count FROM fines').get().count;

console.log(`  -> Found ${loanCount} sample/generated loan records. Removing...`);
db.prepare('DELETE FROM fines').run();
db.prepare('DELETE FROM loans').run();
console.log(`  -> Removed ${fineCount} fine records and ${loanCount} loan records.`);

// 3. Synchronize Book Inventory
console.log('\n[3/6] Synchronizing Book Inventory...');
db.prepare('UPDATE books SET available_copies = total_copies').run();
const books = db.prepare(`
  SELECT b.id, b.book_code, b.title, b.author, c.name as category, b.isbn, b.publisher, b.total_copies, b.available_copies
  FROM books b
  JOIN categories c ON b.category_id = c.id
  ORDER BY b.id ASC
`).all();

console.log(`  -> Total verified books in catalog: ${books.length}`);
books.forEach(b => {
  console.log(`     • [${b.book_code}] "${b.title}" by ${b.author} (${b.category}) | Copies: ${b.available_copies}/${b.total_copies} | Publisher: ${b.publisher}`);
});

// 4. Audit Members
console.log('\n[4/6] Auditing Members (Strict 8 patrons)...');
const members = db.prepare('SELECT id, member_code, full_name, email, phone, status FROM members ORDER BY id ASC').all();
console.log(`  -> Total verified members: ${members.length}`);
const expectedMembers = [
  'Akhilesh Kumar',
  'Chandra Mohan Thakur',
  'Aman Kumar',
  'Ashish Kumar Singh',
  'Sonali Kumari',
  'Sonam Kumari',
  'Manish Kumar',
  'Nishu Kumari'
];

members.forEach(m => {
  const isExpected = expectedMembers.includes(m.full_name);
  console.log(`     • [${m.member_code}] ${m.full_name} (${m.email}) - Status: ${m.status} ${isExpected ? '✓' : '⚠️ UNEXPECTED'}`);
});

// 5. Audit Librarian User
console.log('\n[5/6] Auditing Librarian User Account...');
const users = db.prepare('SELECT id, name, role, email, phone FROM users').all();
users.forEach(u => {
  console.log(`     • ${u.name} | Role: ${u.role} | Email: ${u.email}`);
});

// 6. Final Summary
console.log('\n[6/6] Final Database State Summary:');
const catList = db.prepare('SELECT name FROM categories ORDER BY name ASC').all().map(c => c.name);
const authorList = Array.from(new Set(books.map(b => b.author)));
const publisherList = Array.from(new Set(books.map(b => b.publisher)));

console.log(`  • Books: ${books.length} titles (Total Copies: ${books.reduce((s, b) => s + b.total_copies, 0)})`);
console.log(`  • Members: ${members.length}`);
console.log(`  • Categories (${catList.length}): ${catList.join(', ')}`);
console.log(`  • Authors (${authorList.length}): ${authorList.join(' | ')}`);
console.log(`  • Publishers (${publisherList.length}): ${publisherList.join(' | ')}`);
console.log(`  • Active Loans: 0`);
console.log(`  • Fines: 0`);
console.log('\nAudit and cleanup finished successfully!');
