const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('  50-BOOK DATASET & ISBN-13 FINAL VALIDATION SUITE');
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

function validateISBN13(isbnStr) {
  const clean = isbnStr.replace(/[^0-9]/g, '');
  if (clean.length !== 13) return { valid: false, clean, reason: `Length is ${clean.length}, expected 13` };
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const calcCheck = (10 - (sum % 10)) % 10;
  const actualCheck = parseInt(clean[12], 10);
  
  return {
    valid: calcCheck === actualCheck,
    clean,
    calcCheck,
    actualCheck
  };
}

const datasetPath = path.join(__dirname, '../../50_books_final_dataset.json');
assert.ok(fs.existsSync(datasetPath), `File 50_books_final_dataset.json must exist at ${datasetPath}`);

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// 1. Exactly 50 records
check('Dataset: Exactly 50 records present', () => {
  assert.strictEqual(dataset.length, 50, `Expected 50 records, got ${dataset.length}`);
});

// 2. No missing required fields
check('Dataset: Required fields present and non-empty for all 50 records', () => {
  dataset.forEach((book, idx) => {
    assert.ok(book.title && book.title.trim().length > 0, `Record #${idx + 1} missing title`);
    assert.ok(book.author && book.author.trim().length > 0, `Record #${idx + 1} missing author`);
    assert.ok(book.category && book.category.trim().length > 0, `Record #${idx + 1} missing category`);
    assert.ok(book.isbn && book.isbn.trim().length > 0, `Record #${idx + 1} missing isbn`);
    assert.strictEqual(book.total_copies, 4, `Record #${idx + 1} total_copies must be 4`);
    assert.strictEqual(book.available_copies, 4, `Record #${idx + 1} available_copies must be 4`);
    assert.ok(book.shelf_location && book.shelf_location.trim().length > 0, `Record #${idx + 1} missing shelf_location`);
  });
});

// 3. ISBN-13 Check Digit & Format validation
check('Dataset: All 50 ISBN-13 check digits are mathematically valid', () => {
  dataset.forEach((book, idx) => {
    const res = validateISBN13(book.isbn);
    assert.strictEqual(res.valid, true, `Record #${idx + 1} "${book.title}" invalid ISBN-13 (${book.isbn}): calculated ${res.calcCheck}, got ${res.actualCheck}`);
    assert.strictEqual(res.clean.length, 13, `Record #${idx + 1} "${book.title}" ISBN must have 13 digits`);
  });
});

// 4. Dataset Internal ISBN Uniqueness
check('Dataset: All 50 ISBNs are distinct (no duplicate ISBNs in dataset)', () => {
  const isbns = dataset.map(b => b.isbn.replace(/[^0-9]/g, ''));
  const uniqueIsbns = new Set(isbns);
  assert.strictEqual(uniqueIsbns.size, 50, `Expected 50 unique ISBNs, got ${uniqueIsbns.size}`);
});

// 5. Category Mapping Correctness
check('Dataset: Category mapping adheres to specification (including History reuse)', () => {
  const expectedCategories = new Set([
    'Fiction', 'History', 'Adventure', 'Science Fiction', 'Horror',
    'Drama', 'Mystery', "Children's", 'Fantasy', 'Classic', 'Philosophy'
  ]);

  dataset.forEach((book, idx) => {
    assert.ok(expectedCategories.has(book.category), `Record #${idx + 1} "${book.title}" has unknown category "${book.category}"`);
  });

  const tale = dataset.find(b => b.title === 'A Tale of Two Cities');
  assert.ok(tale, '"A Tale of Two Cities" must exist');
  assert.strictEqual(tale.category, 'History', '"A Tale of Two Cities" must be in "History" category');

  const war = dataset.find(b => b.title === 'War and Peace');
  assert.ok(war, '"War and Peace" must exist');
  assert.strictEqual(war.category, 'History', '"War and Peace" must be in "History" category');
});

// 6. Database Verification: All 50 dataset books are present in database
check('Database Verification: All 50 dataset books exist in database with correct metadata', () => {
  const { db } = require('../database/db');

  const allBooks = db.prepare(`
    SELECT b.*, c.name as category_name
    FROM books b
    JOIN categories c ON b.category_id = c.id
    ORDER BY b.id ASC
  `).all();
  assert.strictEqual(allBooks.length, 62, `Expected 62 total books in DB, found ${allBooks.length}`);

  const dbIsbnMap = new Map();
  for (const b of allBooks) {
    dbIsbnMap.set(b.isbn.replace(/[^0-9]/g, ''), b);
  }

  dataset.forEach((book, idx) => {
    const cleanIsbn = book.isbn.replace(/[^0-9]/g, '');
    const found = dbIsbnMap.get(cleanIsbn);
    assert.ok(found, `Record #${idx + 1} "${book.title}" (ISBN: ${book.isbn}) must exist in database`);
    assert.strictEqual(found.title.toLowerCase().trim(), book.title.toLowerCase().trim(), `Title mismatch for ISBN ${book.isbn}`);
    assert.strictEqual(found.author.toLowerCase().trim(), book.author.toLowerCase().trim(), `Author mismatch for ISBN ${book.isbn}`);
    assert.strictEqual(found.category_name, book.category, `Category mismatch for ISBN ${book.isbn}`);
    assert.strictEqual(found.total_copies, 4, `Total copies must be 4 for ISBN ${book.isbn}`);
    assert.strictEqual(found.available_copies, 4, `Available copies must be 4 for ISBN ${book.isbn}`);
  });
});

// 7. Database Integrity & Category Completeness
check('Database Integrity: 16 categories, 255 total copies, 0 FK violations, and integrity OK', () => {
  const { db } = require('../database/db');

  const booksCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  const catsCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  const totalCopies = db.prepare('SELECT SUM(total_copies) as total FROM books').get().total;
  const availCopies = db.prepare('SELECT SUM(available_copies) as avail FROM books').get().avail;

  assert.strictEqual(booksCount, 62, `Database books count must be 62, got ${booksCount}`);
  assert.strictEqual(catsCount, 16, `Database categories count must be 16, got ${catsCount}`);
  assert.strictEqual(totalCopies, 255, `Database total copies must be 255, got ${totalCopies}`);
  assert.strictEqual(availCopies, 255, `Database available copies must be 255, got ${availCopies}`);

  const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
  assert.strictEqual(fkCheck.length, 0, `Expected 0 foreign key violations, found ${fkCheck.length}`);

  const integrity = db.prepare('PRAGMA integrity_check;').get();
  assert.strictEqual(integrity.integrity_check, 'ok', `Integrity check failed: ${integrity.integrity_check}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('✅ ALL DATASET & ISBN VALIDATION CHECKS PASSED PERFECTLY!\n');
}
