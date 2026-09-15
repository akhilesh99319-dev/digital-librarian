const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

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

const NEW_CATEGORIES = [
  { name: 'Adventure', description: 'Adventure novels, thrilling journeys and expeditions' },
  { name: 'Science Fiction', description: 'Sci-Fi, time travel, futuristic and speculative fiction' },
  { name: 'Horror', description: 'Gothic horror, psychological terror and suspense' },
  { name: 'Drama', description: 'Plays, theatrical works and dramatic literature' },
  { name: 'Mystery', description: 'Detective stories, crime fiction and mystery classics' },
  { name: "Children's", description: "Children's literature, fairy tales and fables" },
  { name: 'Fantasy', description: 'Fantasy literature, magical worlds and epic adventures' },
  { name: 'Classic', description: 'Timeless literary masterpieces and philosophical classics' },
  { name: 'Philosophy', description: 'Ancient and modern philosophical treatises and ethics' }
];

async function runImport(options = { dryRun: false }) {
  console.log('================================================================');
  console.log('  PHASE 14.3: CATEGORY SEEDING & 50-BOOK IDEMPOTENT IMPORT');
  console.log('================================================================\n');

  const dbPath = path.join(__dirname, '../../database/library.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at: ${dbPath}`);
  }

  // 1. Create Timestamped Backup
  const backupDir = path.join(__dirname, '../../database/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `library_backup_phase14_3_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  
  const backupStats = fs.statSync(backupPath);
  if (!backupStats || backupStats.size === 0) {
    throw new Error(`Backup failed: created backup file is empty at ${backupPath}`);
  }
  console.log(`[1/7] ✅ Created safe database backup: ${path.basename(backupPath)} (${backupStats.size} bytes)`);

  // Open SQLite database with foreign keys enabled
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  // 2. Pre-Import Baseline
  console.log('\n[2/7] Recording Pre-Import Database Baseline...');
  const baselineBooks = db.prepare('SELECT * FROM books ORDER BY id ASC').all();
  const baselineCategories = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
  const baselineMembers = db.prepare('SELECT * FROM members ORDER BY id ASC').all();
  const baselineLoans = db.prepare('SELECT * FROM loans WHERE return_date IS NULL').all();
  const baselineFines = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM fines WHERE status = 'Unpaid'").get();

  const preStats = {
    booksCount: baselineBooks.length,
    totalCopies: baselineBooks.reduce((s, b) => s + b.total_copies, 0),
    availableCopies: baselineBooks.reduce((s, b) => s + b.available_copies, 0),
    categoriesCount: baselineCategories.length,
    membersCount: baselineMembers.length,
    activeLoansCount: baselineLoans.length,
    unpaidFines: baselineFines.total
  };

  console.log(`  • Books: ${preStats.booksCount}`);
  console.log(`  • Total Copies: ${preStats.totalCopies}`);
  console.log(`  • Available Copies: ${preStats.availableCopies}`);
  console.log(`  • Categories: ${preStats.categoriesCount}`);
  console.log(`  • Members: ${preStats.membersCount}`);
  console.log(`  • Active Loans: ${preStats.activeLoansCount}`);

  // 3. Load & Validate Dataset
  console.log('\n[3/7] Validating 50_books_final_dataset.json...');
  const datasetPath = path.join(__dirname, '../../50_books_final_dataset.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset file not found at: ${datasetPath}`);
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  if (!Array.isArray(dataset) || dataset.length !== 50) {
    throw new Error(`Dataset must contain exactly 50 records, got ${dataset ? dataset.length : 0}`);
  }

  const isbnsSeen = new Set();
  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    if (!item.title || !item.author || !item.category || !item.isbn) {
      throw new Error(`Record #${i + 1} has missing required fields`);
    }
    const val = validateISBN13(item.isbn);
    if (!val.valid) {
      throw new Error(`Record #${i + 1} "${item.title}" has invalid ISBN-13: ${val.reason}`);
    }
    if (isbnsSeen.has(val.clean)) {
      throw new Error(`Record #${i + 1} duplicate ISBN ${val.clean} in dataset`);
    }
    isbnsSeen.add(val.clean);
  }
  console.log(`  ✅ Dataset validated: 50 records, 50 valid unique ISBN-13 values.`);

  // 4. Atomic Import Transaction
  console.log('\n[4/7] Executing Category Seeding & Book Import Transaction...');
  db.exec('BEGIN TRANSACTION;');

  const importSummary = {
    datasetRecords: dataset.length,
    categoriesBefore: preStats.categoriesCount,
    categoriesCreated: 0,
    categoriesReused: 0,
    categoriesAfter: 0,
    booksInserted: 0,
    booksSkipped: 0,
    duplicatesPrevented: 0,
    conflicts: 0,
    failed: 0
  };

  try {
    // 4.1 Seed Categories
    const categoryMap = {};
    const existingCats = db.prepare('SELECT id, name FROM categories').all();
    for (const c of existingCats) {
      categoryMap[c.name.toLowerCase()] = c.id;
    }

    const insertCatStmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    for (const cat of NEW_CATEGORIES) {
      const lower = cat.name.toLowerCase();
      if (categoryMap[lower]) {
        importSummary.categoriesReused++;
      } else {
        const res = insertCatStmt.run(cat.name, cat.description);
        categoryMap[lower] = Number(res.lastInsertRowid);
        importSummary.categoriesCreated++;
      }
    }

    // Explicitly verify 'history' category is reused
    if (!categoryMap['history']) {
      throw new Error('Critical: "History" category missing from category map');
    }

    // 4.2 Seed Books
    const existingBooksMap = new Map();
    const currentDbBooks = db.prepare('SELECT id, book_code, title, author, isbn FROM books').all();
    for (const b of currentDbBooks) {
      existingBooksMap.set(b.isbn.replace(/[^0-9]/g, ''), b);
    }

    const insertBookStmt = db.prepare(`
      INSERT INTO books (
        book_code, title, author, category_id, isbn, publisher,
        publication_year, total_copies, available_copies, shelf_location, cover_image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < dataset.length; i++) {
      const b = dataset[i];
      const cleanIsbn = b.isbn.replace(/[^0-9]/g, '');
      const existing = existingBooksMap.get(cleanIsbn);

      if (existing) {
        if (existing.title.toLowerCase().trim() === b.title.toLowerCase().trim()) {
          importSummary.booksSkipped++;
          console.log(`  -> Skipped already imported book: "${b.title}" (ISBN: ${b.isbn})`);
          continue;
        } else {
          throw new Error(`Conflict: ISBN ${b.isbn} already in DB with different title "${existing.title}" vs "${b.title}"`);
        }
      }

      // Check title duplicate conflict
      const titleMatch = currentDbBooks.find(eb => eb.title.toLowerCase().trim() === b.title.toLowerCase().trim());
      if (titleMatch) {
        throw new Error(`Conflict: Title "${b.title}" already exists in DB with different ISBN "${titleMatch.isbn}"`);
      }

      // Resolve Category ID
      const catId = categoryMap[b.category.toLowerCase()];
      if (!catId) {
        throw new Error(`Category "${b.category}" could not be resolved to an ID`);
      }

      // Generate Book Code (BK-1013 .. BK-1062)
      const maxIdRow = db.prepare('SELECT MAX(id) as max_id FROM books').get();
      const currentMax = maxIdRow?.max_id || 0;
      const nextId = currentMax + 1;
      const bookCode = `BK-${1000 + nextId}`;

      insertBookStmt.run(
        bookCode,
        b.title.trim(),
        b.author.trim(),
        catId,
        b.isbn.trim(),
        b.publisher ? b.publisher.trim() : null,
        b.publication_year ? parseInt(b.publication_year) : null,
        b.total_copies || 4,
        b.available_copies || 4,
        b.shelf_location ? b.shelf_location.trim() : null,
        b.cover_image || ''
      );

      importSummary.booksInserted++;
    }

    // 4.3 Database Integrity and Foreign Key Checks
    const fkErrors = db.prepare('PRAGMA foreign_key_check;').all();
    if (fkErrors && fkErrors.length > 0) {
      throw new Error(`Foreign key integrity check failed: ${JSON.stringify(fkErrors)}`);
    }

    const integrityRow = db.prepare('PRAGMA integrity_check;').get();
    if (!integrityRow || integrityRow.integrity_check !== 'ok') {
      throw new Error(`SQLite database integrity check failed: ${JSON.stringify(integrityRow)}`);
    }

    // 4.4 Verify Final Counts
    const postCategoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const postBooksCount = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
    const postTotalCopies = db.prepare('SELECT SUM(total_copies) as total FROM books').get().total;
    const postAvailCopies = db.prepare('SELECT SUM(available_copies) as avail FROM books').get().avail;

    const expectedBooks = preStats.booksCount + importSummary.booksInserted;
    const expectedCategories = preStats.categoriesCount + importSummary.categoriesCreated;
    const expectedTotalCopies = preStats.totalCopies + (importSummary.booksInserted * 4);

    if (postBooksCount !== expectedBooks) {
      throw new Error(`Books count mismatch: expected ${expectedBooks}, got ${postBooksCount}`);
    }
    if (postCategoriesCount !== expectedCategories) {
      throw new Error(`Categories count mismatch: expected ${expectedCategories}, got ${postCategoriesCount}`);
    }
    if (postTotalCopies !== expectedTotalCopies) {
      throw new Error(`Total copies mismatch: expected ${expectedTotalCopies}, got ${postTotalCopies}`);
    }

    db.exec('COMMIT;');
    console.log('  ✅ Transaction committed successfully!');

    importSummary.categoriesAfter = postCategoriesCount;
    importSummary.booksAfter = postBooksCount;
    importSummary.totalCopiesAfter = postTotalCopies;
    importSummary.availableCopiesAfter = postAvailCopies;

  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('❌ Error during import, transaction rolled back:', err.message);
    throw err;
  }

  // 5. Post-Import Audit
  console.log('\n[5/7] Post-Import Verification & Catalog Audit...');
  const allBooks = db.prepare(`
    SELECT b.id, b.book_code, b.title, b.author, c.name as category, b.isbn, b.publisher, b.publication_year, b.total_copies, b.available_copies, b.shelf_location
    FROM books b
    JOIN categories c ON b.category_id = c.id
    ORDER BY b.id ASC
  `).all();

  console.log(`  • Final Books in DB: ${allBooks.length} (Expected: 62)`);
  console.log(`  • Final Categories in DB: ${importSummary.categoriesAfter} (Expected: 16)`);
  console.log(`  • Final Total Copies: ${importSummary.totalCopiesAfter} (Expected: 255)`);
  console.log(`  • Final Available Copies: ${importSummary.availableCopiesAfter} (Expected: 255)`);

  // Verify all 50 dataset ISBNs exist
  const dbIsbns = new Set(allBooks.map(b => b.isbn.replace(/[^0-9]/g, '')));
  for (const item of dataset) {
    const clean = item.isbn.replace(/[^0-9]/g, '');
    if (!dbIsbns.has(clean)) {
      throw new Error(`Verification failure: Dataset ISBN ${item.isbn} (${item.title}) not found in DB!`);
    }
  }
  console.log('  ✅ 50/50 dataset ISBNs verified present in database.');

  // Verify Book Codes uniqueness
  const bookCodes = allBooks.map(b => b.book_code);
  const uniqueCodes = new Set(bookCodes);
  if (uniqueCodes.size !== allBooks.length) {
    throw new Error(`Book code collision detected! Total: ${allBooks.length}, Unique: ${uniqueCodes.size}`);
  }
  console.log(`  ✅ All ${allBooks.length} book codes are strictly unique (from ${bookCodes[0]} to ${bookCodes[bookCodes.length - 1]}).`);

  // 6. Safe Issue / Return Verification Test
  console.log('\n[6/7] Performing Safe Live Issue/Return Verification on Imported Book...');
  const testBook = allBooks.find(b => b.title === 'Pride and Prejudice');
  const testMember = db.prepare('SELECT id, member_code, full_name FROM members ORDER BY id ASC LIMIT 1').get();
  
  if (!testBook || !testMember) {
    throw new Error('Test book or member not found for issue/return test');
  }

  const initialBookAvail = testBook.available_copies;
  console.log(`  • Selected Test Book: [${testBook.book_code}] "${testBook.title}" (Available: ${initialBookAvail})`);
  console.log(`  • Selected Test Member: [${testMember.member_code}] ${testMember.full_name}`);

  // 6.1 Issue
  const loanCode = `LN-TEST-${Date.now()}`;
  db.prepare(`
    INSERT INTO loans (loan_code, book_id, member_id, issue_date, due_date, status, notes)
    VALUES (?, ?, ?, date('now'), date('now', '+14 days'), 'Issued', 'Phase 14.3 Temporary Verification Loan')
  `).run(loanCode, testBook.id, testMember.id);

  db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(testBook.id);
  const afterIssueAvail = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBook.id).available_copies;
  console.log(`  • After Issue: Available copies = ${afterIssueAvail} (Expected: ${initialBookAvail - 1})`);
  if (afterIssueAvail !== initialBookAvail - 1) {
    throw new Error(`Issue verification failed: copies were not decremented properly`);
  }

  // 6.2 Return
  db.prepare(`
    UPDATE loans SET status = 'Returned', return_date = date('now') WHERE loan_code = ?
  `).run(loanCode);
  db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(testBook.id);
  const afterReturnAvail = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(testBook.id).available_copies;
  console.log(`  • After Return: Available copies = ${afterReturnAvail} (Expected: ${initialBookAvail})`);
  if (afterReturnAvail !== initialBookAvail) {
    throw new Error(`Return verification failed: copies were not restored properly`);
  }

  // 6.3 Cleanup test loan record
  db.prepare('DELETE FROM loans WHERE loan_code = ?').run(loanCode);
  console.log('  ✅ Safe issue/return cycle verified and cleaned up completely.');

  // 7. Final Integrity
  console.log('\n[7/7] Final Database Integrity Check:');
  const finalFk = db.prepare('PRAGMA foreign_key_check;').all();
  const finalIntegrity = db.prepare('PRAGMA integrity_check;').get();
  console.log(`  • Foreign Key Violations: ${finalFk.length}`);
  console.log(`  • PRAGMA integrity_check: ${finalIntegrity.integrity_check}`);

  return {
    success: true,
    backupFile: path.basename(backupPath),
    preStats,
    importSummary,
    finalStats: {
      books: allBooks.length,
      categories: importSummary.categoriesAfter,
      totalCopies: importSummary.totalCopiesAfter,
      availableCopies: importSummary.availableCopiesAfter,
      members: preStats.membersCount,
      activeLoans: 0
    }
  };
}

if (require.main === module) {
  runImport().then(res => {
    console.log('\n================================================================');
    console.log('  PHASE 14.3 COMPLETE: IMPORT SUCCESSFUL');
    console.log('================================================================');
  }).catch(err => {
    console.error('\n❌ PHASE 14.3 FATAL ERROR:', err);
    process.exit(1);
  });
}

module.exports = { runImport };
