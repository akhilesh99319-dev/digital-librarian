const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const isPostgres = !!process.env.DATABASE_URL;

function convertSql(sql) {
  let index = 1;
  let pgSql = sql.replace(/\?/g, () => `$${index++}`);
  // Replace common SQLite date functions with PostgreSQL equivalents
  pgSql = pgSql.replace(/strftime\('%Y-%m',\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM')");
  pgSql = pgSql.replace(/date\('now',\s*'-6 months'\)/gi, "(CURRENT_DATE - INTERVAL '6 months')");
  pgSql = pgSql.replace(/date\('now'\)/gi, "CURRENT_DATE");
  pgSql = pgSql.replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP");
  // Automatically ensure subqueries in FROM clause have aliases in PostgreSQL
  pgSql = pgSql.replace(/FROM\s*\(([\s\S]+?)\)\s*$/i, (match, inner) => {
    return `FROM (${inner}) AS count_subquery`;
  });
  return pgSql;
}

let db;
let initDatabase;

if (isPostgres) {
  // PostgreSQL Mode for Production on Render
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  // Dual-mode database interface
  db = {
    isPostgres: true,
    pool,
    convertSql,
    async query(sql, params = []) {
      const pgSql = convertSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows;
    },
    async exec(sql) {
      const trimmed = (sql || '').trim().toUpperCase();
      if (trimmed === 'BEGIN' || trimmed === 'BEGIN TRANSACTION' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
        return; // Autocommit per-query mode against connection pool
      }
      await pool.query(sql);
    },
    prepare(sql) {
      const pgSql = convertSql(sql);
      return {
        async get(...params) {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          const res = await pool.query(pgSql, flatParams);
          return res.rows[0] || null;
        },
        async all(...params) {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          const res = await pool.query(pgSql, flatParams);
          return res.rows;
        },
        async run(...params) {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          let runSql = pgSql;
          if (/^\s*INSERT\s+INTO\s+/i.test(runSql) && !/RETURNING\s+/i.test(runSql)) {
            runSql = `${runSql} RETURNING id`;
          }
          const res = await pool.query(runSql, flatParams);
          return {
            changes: res.rowCount,
            lastInsertRowid: res.rows[0] ? res.rows[0].id : null
          };
        }
      };
    }
  };

  initDatabase = async function() {
    console.log('Connecting to Production PostgreSQL Database...');
    const schemaFile = path.join(__dirname, '../../database/digital_librarian_postgresql_schema.sql');
    if (fs.existsSync(schemaFile)) {
      const schemaSql = fs.readFileSync(schemaFile, 'utf8');
      await pool.query(schemaSql);
    }

    // Ensure book_requests table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_requests (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE ON UPDATE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE ON UPDATE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        notes TEXT DEFAULT NULL,
        request_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_by INTEGER DEFAULT NULL,
        processed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_book_requests_member ON book_requests(member_id);
      CREATE INDEX IF NOT EXISTS idx_book_requests_book ON book_requests(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_requests_status ON book_requests(status);

      CREATE TABLE IF NOT EXISTS auth_otps (
        id SERIAL PRIMARY KEY,
        identifier VARCHAR(191) DEFAULT NULL,
        email VARCHAR(191) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        otp_type VARCHAR(50) NOT NULL,
        metadata TEXT DEFAULT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        resend_count INTEGER NOT NULL DEFAULT 0,
        last_sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON auth_otps(email);
      CREATE INDEX IF NOT EXISTS idx_auth_otps_type ON auth_otps(otp_type);

      -- Safe column additions for Google Auth and Email verification in PostgreSQL
      ALTER TABLE members ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
      ALTER TABLE members ADD COLUMN IF NOT EXISTS google_email VARCHAR(191) DEFAULT NULL;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email VARCHAR(191) DEFAULT NULL;
    `);

    // Check if seeded with authoritative catalog (only seed if table is completely empty)
    const bookCheck = await pool.query('SELECT COUNT(*) as count FROM books');
    if (parseInt(bookCheck.rows[0].count, 10) === 0) {
      console.log('Seeding PostgreSQL authoritative baseline records...');
      const importFile = path.join(__dirname, '../../database/digital_librarian_postgresql_import.sql');
      if (fs.existsSync(importFile)) {
        const importSql = fs.readFileSync(importFile, 'utf8');
        await pool.query(importSql);
      }
    }

    // Ensure seeded librarian account has valid password_hash and authoritative email without overwriting custom passwords
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Password@123', salt);

    const existingByEmail = await pool.query("SELECT id, email, password_hash FROM users WHERE LOWER(email) = 'akhilesh@library.com'");
    if (existingByEmail.rows.length > 0) {
      const u = existingByEmail.rows[0];
      if (!u.password_hash || typeof u.password_hash !== 'string' || u.password_hash.trim() === '') {
        console.log('Initializing missing password hash for akhilesh@library.com...');
        await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, u.id]);
      }
    } else {
      // Check if user id = 1 or librarian role exists with another email
      const fallbackUser = await pool.query("SELECT id, email, password_hash FROM users WHERE id = 1 OR LOWER(role) = 'librarian' ORDER BY id ASC LIMIT 1");
      if (fallbackUser.rows.length > 0) {
        const u = fallbackUser.rows[0];
        const updatePass = (!u.password_hash || typeof u.password_hash !== 'string' || u.password_hash.trim() === '') ? hash : u.password_hash;
        console.log('Restoring authoritative email akhilesh@library.com for user id ' + u.id + '...');
        await pool.query("UPDATE users SET email = 'akhilesh@library.com', role = 'Librarian', password_hash = $1 WHERE id = $2", [updatePass, u.id]);
      } else {
        console.log('Inserting authoritative librarian account akhilesh@library.com...');
        await pool.query("INSERT INTO users (id, name, role, email, password_hash, phone) VALUES (1, 'Akhilesh Kumar', 'Librarian', 'akhilesh@library.com', $1, '+91 98765 43210') ON CONFLICT (id) DO NOTHING", [hash]);
      }
    }

    // Ensure member password hashes are initialized
    const defaultMemberPass = 'Member@123';
    const memberSalt = bcrypt.genSaltSync(10);
    const memberPassHash = bcrypt.hashSync(defaultMemberPass, memberSalt);
    await pool.query("UPDATE members SET password_hash = $1 WHERE password_hash IS NULL", [memberPassHash]);

    console.log('PostgreSQL database initialized and verified.');
  };
} else {
  // SQLite Mode for Local Development & Offline Testing
  const { DatabaseSync } = require('node:sqlite');

  const dbDirectory = path.join(__dirname, '../../database');
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }

  const dbPath = process.env.DB_PATH 
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.join(dbDirectory, 'library.db');

  const sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');

  db = sqliteDb;
  db.isPostgres = false;

  initDatabase = function() {
    // Create tables if they do not exist
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Librarian',
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_code TEXT UNIQUE,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        isbn TEXT UNIQUE NOT NULL,
        publisher TEXT,
        publication_year INTEGER,
        total_copies INTEGER NOT NULL DEFAULT 1,
        available_copies INTEGER NOT NULL DEFAULT 1,
        shelf_location TEXT,
        cover_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_code TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        phone TEXT NOT NULL,
        address TEXT,
        membership_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_code TEXT UNIQUE NOT NULL,
        book_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        return_date DATE,
        status TEXT NOT NULL DEFAULT 'Issued',
        fine_amount REAL DEFAULT 0.0,
        fine_paid INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS fines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        days_overdue INTEGER NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'Unpaid',
        payment_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_approval_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        request_token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by INTEGER,
        approved_at DATETIME,
        rejected_by INTEGER,
        rejected_at DATETIME,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        result TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS book_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        notes TEXT,
        request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_by INTEGER,
        processed_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS auth_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        otp_type TEXT NOT NULL,
        metadata TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        resend_count INTEGER NOT NULL DEFAULT 0,
        last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration 1: password_hash in members
    try {
      const memCols = sqliteDb.prepare('PRAGMA table_info(members)').all();
      const hasPass = memCols.some(c => c.name === 'password_hash');
      if (!hasPass) {
        sqliteDb.exec('ALTER TABLE members ADD COLUMN password_hash TEXT;');
      }
      const hasEmailVerified = memCols.some(c => c.name === 'email_verified_at');
      if (!hasEmailVerified) {
        sqliteDb.exec('ALTER TABLE members ADD COLUMN email_verified_at DATETIME;');
      }
      const hasGoogleId = memCols.some(c => c.name === 'google_id');
      if (!hasGoogleId) {
        sqliteDb.exec('ALTER TABLE members ADD COLUMN google_id TEXT;');
      }
      const hasGoogleEmail = memCols.some(c => c.name === 'google_email');
      if (!hasGoogleEmail) {
        sqliteDb.exec('ALTER TABLE members ADD COLUMN google_email TEXT;');
      }
    } catch (migErr) {
      console.error('Member columns migration notice:', migErr.message);
    }

    // Migration for users table (Google Auth & Email verification)
    try {
      const userCols = sqliteDb.prepare('PRAGMA table_info(users)').all();
      const hasEmailVerified = userCols.some(c => c.name === 'email_verified_at');
      if (!hasEmailVerified) {
        sqliteDb.exec('ALTER TABLE users ADD COLUMN email_verified_at DATETIME;');
        sqliteDb.exec("UPDATE users SET email_verified_at = datetime('now') WHERE email_verified_at IS NULL;");
      }
      const hasGoogleId = userCols.some(c => c.name === 'google_id');
      if (!hasGoogleId) {
        sqliteDb.exec('ALTER TABLE users ADD COLUMN google_id TEXT;');
      }
      const hasGoogleEmail = userCols.some(c => c.name === 'google_email');
      if (!hasGoogleEmail) {
        sqliteDb.exec('ALTER TABLE users ADD COLUMN google_email TEXT;');
      }
    } catch (migErr) {
      console.error('User columns migration notice:', migErr.message);
    }

    // Migration 2: nullable email in members
    try {
      const memCols = sqliteDb.prepare('PRAGMA table_info(members)').all();
      const emailCol = memCols.find(c => c.name === 'email');
      if (emailCol && emailCol.notnull === 1) {
        sqliteDb.exec('PRAGMA foreign_keys = OFF;');
        sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS members_nullable_email (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_code TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT,
            phone TEXT NOT NULL,
            address TEXT,
            membership_date DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'Active',
            email_verified_at DATETIME,
            google_id TEXT,
            google_email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO members_nullable_email (id, member_code, full_name, email, password_hash, phone, address, membership_date, status, created_at)
          SELECT id, member_code, full_name, email, password_hash, phone, address, membership_date, status, created_at FROM members;
          DROP TABLE members;
          ALTER TABLE members_nullable_email RENAME TO members;
        `);
        sqliteDb.exec('PRAGMA foreign_keys = ON;');
      }
    } catch (migErr) {
      console.error('Email nullable migration notice:', migErr.message);
    }

    seedInitialData(sqliteDb);
  };
}

function seedInitialData(targetDb) {
  const userCount = targetDb.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    const defaultMemberPass = 'Member@123';
    const memberSalt = bcrypt.genSaltSync(10);
    const memberPassHash = bcrypt.hashSync(defaultMemberPass, memberSalt);
    targetDb.prepare('UPDATE members SET password_hash = ? WHERE password_hash IS NULL').run(memberPassHash);
    return;
  }

  console.log('Seeding initial Digital Librarian database records...');

  const defaultPassword = 'Password@123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  const insertUser = targetDb.prepare(`
    INSERT INTO users (name, role, email, password_hash, phone)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run('Akhilesh Kumar', 'Librarian', 'akhilesh@library.com', passwordHash, '+91 98765 43210');

  const initialCategories = [
    { name: 'Computer Science', description: 'Programming, Software Engineering, AI, Databases and Networks' },
    { name: 'Technology', description: 'Modern technology trends, electronics, robotics and emerging tech' },
    { name: 'Science', description: 'Physics, Chemistry, Biology, Astronomy, and Earth Sciences' },
    { name: 'Mathematics', description: 'Calculus, Linear Algebra, Statistics, and Discrete Mathematics' },
    { name: 'Fiction', description: 'Novels, classic literature, sci-fi and modern fiction' },
    { name: 'History', description: 'World history, ancient civilizations, and modern historical events' },
    { name: 'Biography', description: 'Memoirs and biographies of eminent personalities' }
  ];

  const insertCategory = targetDb.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  const catMap = {};
  for (const cat of initialCategories) {
    const res = insertCategory.run(cat.name, cat.description);
    catMap[cat.name] = Number(res.lastInsertRowid);
  }

  const initialBooks = [
    { book_code: 'BK-1001', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Computer Science', isbn: '978-0132350884', publisher: 'Prentice Hall', publication_year: 2008, total_copies: 5, available_copies: 5, shelf_location: 'CS-A1-01', cover_image: '' },
    { book_code: 'BK-1002', title: 'Introduction to Algorithms (CLRS)', author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest', category: 'Computer Science', isbn: '978-0262033848', publisher: 'MIT Press', publication_year: 2009, total_copies: 4, available_copies: 4, shelf_location: 'CS-A1-02', cover_image: '' },
    { book_code: 'BK-1003', title: 'Design Patterns: Elements of Reusable Object-Oriented Software', author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides', category: 'Computer Science', isbn: '978-0201633610', publisher: 'Addison-Wesley', publication_year: 1994, total_copies: 4, available_copies: 4, shelf_location: 'CS-A1-03', cover_image: '' },
    { book_code: 'BK-1004', title: 'The Pragmatic Programmer: Your Journey To Mastery', author: 'David Thomas, Andrew Hunt', category: 'Computer Science', isbn: '978-0135957059', publisher: 'Addison-Wesley Professional', publication_year: 2019, total_copies: 6, available_copies: 6, shelf_location: 'CS-A2-01', cover_image: '' },
    { book_code: 'BK-1005', title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Science', isbn: '978-0553380163', publisher: 'Bantam Books', publication_year: 1998, total_copies: 5, available_copies: 5, shelf_location: 'SC-B1-01', cover_image: '' },
    { book_code: 'BK-1006', title: 'Cosmos', author: 'Carl Sagan', category: 'Science', isbn: '978-0345539434', publisher: 'Ballantine Books', publication_year: 1980, total_copies: 3, available_copies: 3, shelf_location: 'SC-B1-02', cover_image: '' },
    { book_code: 'BK-1007', title: 'Linear Algebra and Its Applications', author: 'Gilbert Strang', category: 'Mathematics', isbn: '978-0030105678', publisher: 'Cengage Learning', publication_year: 2005, total_copies: 4, available_copies: 4, shelf_location: 'MT-C1-01', cover_image: '' },
    { book_code: 'BK-1008', title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', category: 'History', isbn: '978-0062316097', publisher: 'Harper', publication_year: 2014, total_copies: 5, available_copies: 5, shelf_location: 'HS-D1-01', cover_image: '' },
    { book_code: 'BK-1009', title: 'Steve Jobs', author: 'Walter Isaacson', category: 'Biography', isbn: '978-1451648539', publisher: 'Simon & Schuster', publication_year: 2011, total_copies: 4, available_copies: 4, shelf_location: 'BG-E1-01', cover_image: '' },
    { book_code: 'BK-1010', title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Fiction', isbn: '978-0061120084', publisher: 'Harper Perennial Modern Classics', publication_year: 1960, total_copies: 6, available_copies: 6, shelf_location: 'FC-F1-01', cover_image: '' },
    { book_code: 'BK-1011', title: '1984', author: 'George Orwell', category: 'Fiction', isbn: '978-0451524935', publisher: 'Signet Classic', publication_year: 1949, total_copies: 5, available_copies: 5, shelf_location: 'FC-F1-02', cover_image: '' },
    { book_code: 'BK-1012', title: 'The Innovators: How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution', author: 'Walter Isaacson', category: 'Technology', isbn: '978-1476708690', publisher: 'Simon & Schuster', publication_year: 2014, total_copies: 4, available_copies: 4, shelf_location: 'TC-A2-02', cover_image: '' }
  ];

  const insertBook = targetDb.prepare(`
    INSERT INTO books (
      book_code, title, author, category_id, isbn, publisher, 
      publication_year, total_copies, available_copies, shelf_location, cover_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of initialBooks) {
    const categoryId = catMap[b.category] || 1;
    insertBook.run(
      b.book_code, b.title, b.author, categoryId, b.isbn, b.publisher,
      b.publication_year, b.total_copies, b.available_copies, b.shelf_location, b.cover_image
    );
  }

  const defaultMemberPass = 'Member@123';
  const memberSalt = bcrypt.genSaltSync(10);
  const memberPassHash = bcrypt.hashSync(defaultMemberPass, memberSalt);

  const initialMembers = [
    { member_code: 'MEM-001', full_name: 'Akhilesh Kumar', email: null, phone: '+91 98350 11223', address: 'Boring Road, Patna, Bihar', membership_date: '2025-01-10', status: 'Active' },
    { member_code: 'MEM-002', full_name: 'Chandra Mohan Thakur', email: null, phone: '+91 94311 22334', address: 'Harmu Colony, Ranchi, Jharkhand', membership_date: '2025-01-20', status: 'Active' },
    { member_code: 'MEM-003', full_name: 'Aman Kumar', email: null, phone: '+91 98711 33445', address: 'Lajpat Nagar, New Delhi', membership_date: '2025-02-05', status: 'Active' },
    { member_code: 'MEM-004', full_name: 'Ashish Kumar Singh', email: null, phone: '+91 99344 44556', address: 'Assi Ghat Road, Varanasi, UP', membership_date: '2025-02-15', status: 'Active' },
    { member_code: 'MEM-005', full_name: 'Sonali Kumari', email: null, phone: '+91 97488 55667', address: 'Salt Lake Sector 5, Kolkata, WB', membership_date: '2025-03-01', status: 'Active' },
    { member_code: 'MEM-006', full_name: 'Sonam Kumari', email: null, phone: '+91 98800 66778', address: 'Indiranagar 100ft Rd, Bengaluru, Karnataka', membership_date: '2025-03-12', status: 'Active' },
    { member_code: 'MEM-007', full_name: 'Manish Kumar', email: null, phone: '+91 96233 77889', address: 'Kothrud, Pune, Maharashtra', membership_date: '2025-03-22', status: 'Active' },
    { member_code: 'MEM-008', full_name: 'Nishu Kumari', email: null, phone: '+91 95544 88990', address: 'Gomti Nagar, Lucknow, UP', membership_date: '2025-04-02', status: 'Active' }
  ];

  const insertMember = targetDb.prepare(`
    INSERT INTO members (member_code, full_name, email, password_hash, phone, address, membership_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of initialMembers) {
    insertMember.run(m.member_code, m.full_name, m.email, memberPassHash, m.phone, m.address, m.membership_date, m.status);
  }

  console.log('Database initialized successfully with verified records (12 books, 8 members, 7 categories, 0 fake loans).');
}

module.exports = {
  db,
  initDatabase,
  isPostgres,
  convertSql
};
