const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'library.db');
const db = new DatabaseSync(dbPath);

// Generate MySQL/MariaDB SQL dump
function exportToMySQL() {
  const schemaSQL = `
-- ================================================================
-- DIGITAL LIBRARIAN — PRODUCTION DATABASE SCHEMA (MySQL / MariaDB)
-- Database: library_management_system
-- ================================================================

CREATE DATABASE IF NOT EXISTS \`library_management_system\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`library_management_system\`;

-- --------------------------------------------------------
-- Table structure for table \`users\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(150) NOT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'Librarian',
  \`email\` VARCHAR(191) NOT NULL UNIQUE,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`phone\` VARCHAR(50) DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`categories\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`categories\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(100) NOT NULL UNIQUE,
  \`description\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`books\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`books\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`book_code\` VARCHAR(50) UNIQUE DEFAULT NULL,
  \`title\` VARCHAR(255) NOT NULL,
  \`author\` VARCHAR(255) NOT NULL,
  \`category_id\` INT NOT NULL,
  \`isbn\` VARCHAR(50) NOT NULL UNIQUE,
  \`publisher\` VARCHAR(255) DEFAULT NULL,
  \`publication_year\` INT DEFAULT NULL,
  \`total_copies\` INT NOT NULL DEFAULT 1,
  \`available_copies\` INT NOT NULL DEFAULT 1,
  \`shelf_location\` VARCHAR(100) DEFAULT NULL,
  \`cover_image\` VARCHAR(255) DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_books_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`members\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`members\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`member_code\` VARCHAR(50) NOT NULL UNIQUE,
  \`full_name\` VARCHAR(150) NOT NULL,
  \`email\` VARCHAR(191) UNIQUE DEFAULT NULL,
  \`password_hash\` VARCHAR(255) DEFAULT NULL,
  \`phone\` VARCHAR(50) NOT NULL,
  \`address\` TEXT DEFAULT NULL,
  \`membership_date\` DATE NOT NULL,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'Active',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`loans\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`loans\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`loan_code\` VARCHAR(50) NOT NULL UNIQUE,
  \`book_id\` INT NOT NULL,
  \`member_id\` INT NOT NULL,
  \`issue_date\` DATE NOT NULL,
  \`due_date\` DATE NOT NULL,
  \`return_date\` DATE DEFAULT NULL,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'Issued',
  \`fine_amount\` DECIMAL(10,2) DEFAULT 0.00,
  \`fine_paid\` TINYINT(1) DEFAULT 0,
  \`notes\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_loans_book\` FOREIGN KEY (\`book_id\`) REFERENCES \`books\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT \`fk_loans_member\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`fines\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`fines\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`loan_id\` INT NOT NULL,
  \`member_id\` INT NOT NULL,
  \`days_overdue\` INT NOT NULL DEFAULT 0,
  \`amount\` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
  \`payment_date\` DATE DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_fines_loan\` FOREIGN KEY (\`loan_id\`) REFERENCES \`loans\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`fk_fines_member\` FOREIGN KEY (\`member_id\`) REFERENCES \`members\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`admin_approval_requests\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`admin_approval_requests\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  \`request_token\` VARCHAR(255) NOT NULL UNIQUE,
  \`device_info\` VARCHAR(255) DEFAULT NULL,
  \`requested_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  \`approved_by\` INT DEFAULT NULL,
  \`approved_at\` DATETIME DEFAULT NULL,
  \`rejected_by\` INT DEFAULT NULL,
  \`rejected_at\` DATETIME DEFAULT NULL,
  \`expires_at\` DATETIME NOT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`fk_approval_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table \`audit_logs\`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`audit_logs\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT DEFAULT NULL,
  \`action\` VARCHAR(100) NOT NULL,
  \`result\` VARCHAR(50) NOT NULL,
  \`details\` TEXT DEFAULT NULL,
  \`ip_address\` VARCHAR(100) DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

  // Write Schema SQL
  fs.writeFileSync(path.join(__dirname, 'digital_librarian_schema.sql'), schemaSQL.trim() + '\n');
  console.log('✅ Generated digital_librarian_schema.sql');

  // Now generate complete Import SQL with Seed Data
  let importSQL = schemaSQL + '\n-- ================================================================\n-- AUTHORITATIVE BASELINE SEED DATA\n-- ================================================================\n\n';

  // 1. Users
  const users = db.prepare('SELECT * FROM users').all();
  if (users.length > 0) {
    importSQL += '-- Dumping data for table `users`\n';
    importSQL += 'INSERT INTO `users` (`id`, `name`, `role`, `email`, `password_hash`, `phone`, `created_at`) VALUES\n';
    const userRows = users.map(u => 
      `(${u.id}, ${escapeSQL(u.name)}, ${escapeSQL(u.role)}, ${escapeSQL(u.email)}, ${escapeSQL(u.password_hash)}, ${escapeSQL(u.phone)}, ${escapeSQL(u.created_at)})`
    ).join(',\n');
    importSQL += userRows + ';\n\n';
  }

  // 2. Categories
  const categories = db.prepare('SELECT * FROM categories').all();
  if (categories.length > 0) {
    importSQL += '-- Dumping data for table `categories`\n';
    importSQL += 'INSERT INTO `categories` (`id`, `name`, `description`, `created_at`) VALUES\n';
    const catRows = categories.map(c => 
      `(${c.id}, ${escapeSQL(c.name)}, ${escapeSQL(c.description)}, ${escapeSQL(c.created_at)})`
    ).join(',\n');
    importSQL += catRows + ';\n\n';
  }

  // 3. Books
  const books = db.prepare('SELECT * FROM books').all();
  if (books.length > 0) {
    importSQL += '-- Dumping data for table `books`\n';
    importSQL += 'INSERT INTO `books` (`id`, `book_code`, `title`, `author`, `category_id`, `isbn`, `publisher`, `publication_year`, `total_copies`, `available_copies`, `shelf_location`, `cover_image`, `created_at`) VALUES\n';
    const bookRows = books.map(b => 
      `(${b.id}, ${escapeSQL(b.book_code)}, ${escapeSQL(b.title)}, ${escapeSQL(b.author)}, ${b.category_id}, ${escapeSQL(b.isbn)}, ${escapeSQL(b.publisher)}, ${b.publication_year}, ${b.total_copies}, ${b.available_copies}, ${escapeSQL(b.shelf_location)}, ${escapeSQL(b.cover_image)}, ${escapeSQL(b.created_at)})`
    ).join(',\n');
    importSQL += bookRows + ';\n\n';
  }

  // 4. Members
  const members = db.prepare('SELECT * FROM members').all();
  if (members.length > 0) {
    importSQL += '-- Dumping data for table `members`\n';
    importSQL += 'INSERT INTO `members` (`id`, `member_code`, `full_name`, `email`, `password_hash`, `phone`, `address`, `membership_date`, `status`, `created_at`) VALUES\n';
    const memberRows = members.map(m => 
      `(${m.id}, ${escapeSQL(m.member_code)}, ${escapeSQL(m.full_name)}, ${escapeSQL(m.email)}, ${escapeSQL(m.password_hash)}, ${escapeSQL(m.phone)}, ${escapeSQL(m.address)}, ${escapeSQL(m.membership_date)}, ${escapeSQL(m.status)}, ${escapeSQL(m.created_at)})`
    ).join(',\n');
    importSQL += memberRows + ';\n\n';
  }

  fs.writeFileSync(path.join(__dirname, 'digital_librarian_mysql_import.sql'), importSQL.trim() + '\n');
  console.log('✅ Generated digital_librarian_mysql_import.sql');
}

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// Backup SQLite DB
function backupSQLite() {
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `library_backup_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupFile);
  console.log(`✅ SQLite Database backed up to: ${backupFile}`);
}

backupSQLite();
exportToMySQL();
