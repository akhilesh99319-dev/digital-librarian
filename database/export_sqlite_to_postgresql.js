const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'library.db');
const db = new DatabaseSync(dbPath);

function exportToPostgreSQL() {
  const schemaSQL = `
-- ================================================================
-- DIGITAL LIBRARIAN — PRODUCTION DATABASE SCHEMA (PostgreSQL)
-- Database: library_management_system
-- ================================================================

-- --------------------------------------------------------
-- Table structure for table "users"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Librarian',
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "categories"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "books"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  book_code VARCHAR(50) UNIQUE DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  isbn VARCHAR(50) NOT NULL UNIQUE,
  publisher VARCHAR(255) DEFAULT NULL,
  publication_year INTEGER DEFAULT NULL,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  shelf_location VARCHAR(100) DEFAULT NULL,
  cover_image VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "members"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  member_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(191) UNIQUE DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT DEFAULT NULL,
  membership_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "loans"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  loan_code VARCHAR(50) NOT NULL UNIQUE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  return_date DATE DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Issued',
  fine_amount NUMERIC(10,2) DEFAULT 0.00,
  fine_paid SMALLINT DEFAULT 0,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "fines"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS fines (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE ON UPDATE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE ON UPDATE CASCADE,
  days_overdue INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
  payment_date DATE DEFAULT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "admin_approval_requests"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_approval_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  request_token VARCHAR(255) NOT NULL UNIQUE,
  device_info VARCHAR(255) DEFAULT NULL,
  requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER DEFAULT NULL,
  approved_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  rejected_by INTEGER DEFAULT NULL,
  rejected_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- Table structure for table "audit_logs"
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  result VARCHAR(50) NOT NULL,
  details TEXT DEFAULT NULL,
  ip_address VARCHAR(100) DEFAULT NULL,
  timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_members_code ON members(member_code);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_loans_code ON loans(loan_code);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_admin_req_token ON admin_approval_requests(request_token);
`;

  fs.writeFileSync(path.join(__dirname, 'digital_librarian_postgresql_schema.sql'), schemaSQL.trim() + '\n');
  console.log('✅ Generated digital_librarian_postgresql_schema.sql');

  // Generate Import SQL with Baseline Data
  let importSQL = schemaSQL + '\n-- ================================================================\n-- AUTHORITATIVE BASELINE SEED DATA (PostgreSQL)\n-- ================================================================\n\n';

  // 1. Users
  const users = db.prepare('SELECT * FROM users').all();
  if (users.length > 0) {
    importSQL += '-- Data for table users\n';
    importSQL += 'INSERT INTO users (id, name, role, email, password_hash, phone, created_at) VALUES\n';
    const userRows = users.map(u => 
      `(${u.id}, ${escapeSQL(u.name)}, ${escapeSQL(u.role)}, ${escapeSQL(u.email)}, ${escapeSQL(u.password_hash)}, ${escapeSQL(u.phone)}, ${escapeSQL(u.created_at)})`
    ).join(',\n');
    importSQL += userRows + ';\n';
    importSQL += "SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;\n\n";
  }

  // 2. Categories
  const categories = db.prepare('SELECT * FROM categories').all();
  if (categories.length > 0) {
    importSQL += '-- Data for table categories\n';
    importSQL += 'INSERT INTO categories (id, name, description, created_at) VALUES\n';
    const catRows = categories.map(c => 
      `(${c.id}, ${escapeSQL(c.name)}, ${escapeSQL(c.description)}, ${escapeSQL(c.created_at)})`
    ).join(',\n');
    importSQL += catRows + ';\n';
    importSQL += "SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;\n\n";
  }

  // 3. Books
  const books = db.prepare('SELECT * FROM books').all();
  if (books.length > 0) {
    importSQL += '-- Data for table books\n';
    importSQL += 'INSERT INTO books (id, book_code, title, author, category_id, isbn, publisher, publication_year, total_copies, available_copies, shelf_location, cover_image, created_at) VALUES\n';
    const bookRows = books.map(b => 
      `(${b.id}, ${escapeSQL(b.book_code)}, ${escapeSQL(b.title)}, ${escapeSQL(b.author)}, ${b.category_id}, ${escapeSQL(b.isbn)}, ${escapeSQL(b.publisher)}, ${b.publication_year}, ${b.total_copies}, ${b.available_copies}, ${escapeSQL(b.shelf_location)}, ${escapeSQL(b.cover_image)}, ${escapeSQL(b.created_at)})`
    ).join(',\n');
    importSQL += bookRows + ';\n';
    importSQL += "SELECT setval(pg_get_serial_sequence('books', 'id'), coalesce(max(id), 1)) FROM books;\n\n";
  }

  // 4. Members
  const members = db.prepare('SELECT * FROM members').all();
  if (members.length > 0) {
    importSQL += '-- Data for table members\n';
    importSQL += 'INSERT INTO members (id, member_code, full_name, email, password_hash, phone, address, membership_date, status, created_at) VALUES\n';
    const memberRows = members.map(m => 
      `(${m.id}, ${escapeSQL(m.member_code)}, ${escapeSQL(m.full_name)}, ${escapeSQL(m.email)}, ${escapeSQL(m.password_hash)}, ${escapeSQL(m.phone)}, ${escapeSQL(m.address)}, ${escapeSQL(m.membership_date)}, ${escapeSQL(m.status)}, ${escapeSQL(m.created_at)})`
    ).join(',\n');
    importSQL += memberRows + ';\n';
    importSQL += "SELECT setval(pg_get_serial_sequence('members', 'id'), coalesce(max(id), 1)) FROM members;\n\n";
  }

  fs.writeFileSync(path.join(__dirname, 'digital_librarian_postgresql_import.sql'), importSQL.trim() + '\n');
  console.log('✅ Generated digital_librarian_postgresql_import.sql');
}

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/'/g, "''")}'`;
}

exportToPostgreSQL();
