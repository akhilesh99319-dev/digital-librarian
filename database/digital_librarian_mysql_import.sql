-- ================================================================
-- DIGITAL LIBRARIAN — PRODUCTION DATABASE SCHEMA (MySQL / MariaDB)
-- Database: library_management_system
-- ================================================================

CREATE DATABASE IF NOT EXISTS `library_management_system` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `library_management_system`;

-- --------------------------------------------------------
-- Table structure for table `users`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'Librarian',
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `categories`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `books`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_code` VARCHAR(50) UNIQUE DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `author` VARCHAR(255) NOT NULL,
  `category_id` INT NOT NULL,
  `isbn` VARCHAR(50) NOT NULL UNIQUE,
  `publisher` VARCHAR(255) DEFAULT NULL,
  `publication_year` INT DEFAULT NULL,
  `total_copies` INT NOT NULL DEFAULT 1,
  `available_copies` INT NOT NULL DEFAULT 1,
  `shelf_location` VARCHAR(100) DEFAULT NULL,
  `cover_image` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_books_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `members`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_code` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) UNIQUE DEFAULT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `address` TEXT DEFAULT NULL,
  `membership_date` DATE NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `loans`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `loans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loan_code` VARCHAR(50) NOT NULL UNIQUE,
  `book_id` INT NOT NULL,
  `member_id` INT NOT NULL,
  `issue_date` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `return_date` DATE DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Issued',
  `fine_amount` DECIMAL(10,2) DEFAULT 0.00,
  `fine_paid` TINYINT(1) DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_loans_book` FOREIGN KEY (`book_id`) REFERENCES `books` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_loans_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `fines`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loan_id` INT NOT NULL,
  `member_id` INT NOT NULL,
  `days_overdue` INT NOT NULL DEFAULT 0,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
  `payment_date` DATE DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_fines_loan` FOREIGN KEY (`loan_id`) REFERENCES `loans` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_fines_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `admin_approval_requests`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_approval_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  `request_token` VARCHAR(255) NOT NULL UNIQUE,
  `device_info` VARCHAR(255) DEFAULT NULL,
  `requested_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `approved_by` INT DEFAULT NULL,
  `approved_at` DATETIME DEFAULT NULL,
  `rejected_by` INT DEFAULT NULL,
  `rejected_at` DATETIME DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_approval_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for table `audit_logs`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `result` VARCHAR(50) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- AUTHORITATIVE BASELINE SEED DATA
-- ================================================================

-- Dumping data for table `users`
INSERT INTO `users` (`id`, `name`, `role`, `email`, `password_hash`, `phone`, `created_at`) VALUES
(1, 'Akhilesh Kumar', 'Librarian', 'akhilesh@library.com', '$2a$10$U8tRjX3gT8du40N8exqlmun954Yg.fzWDWLXunTyqsnNTRnu7hnsO', '+91 9931964443', '2026-08-25 17:28:39');

-- Dumping data for table `categories`
INSERT INTO `categories` (`id`, `name`, `description`, `created_at`) VALUES
(1, 'Computer Science', 'Programming, Software Engineering, AI, Databases and Networks', '2026-08-25 17:28:39'),
(2, 'Technology', 'Modern technology trends, electronics, robotics and emerging tech', '2026-08-25 17:28:39'),
(3, 'Science', 'Physics, Chemistry, Biology, Astronomy, and Earth Sciences', '2026-08-25 17:28:39'),
(4, 'Mathematics', 'Calculus, Linear Algebra, Statistics, and Discrete Mathematics', '2026-08-25 17:28:39'),
(5, 'Fiction', 'Novels, classic literature, sci-fi and modern fiction', '2026-08-25 17:28:39'),
(6, 'History', 'World history, ancient civilizations, and modern historical events', '2026-08-25 17:28:39'),
(7, 'Biography', 'Memoirs and biographies of eminent personalities', '2026-08-25 17:28:39');

-- Dumping data for table `books`
INSERT INTO `books` (`id`, `book_code`, `title`, `author`, `category_id`, `isbn`, `publisher`, `publication_year`, `total_copies`, `available_copies`, `shelf_location`, `cover_image`, `created_at`) VALUES
(1, 'BK-1001', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 1, '978-0132350884', 'Prentice Hall', 2008, 5, 5, 'CS-A1-01', '', '2026-08-25 17:28:39'),
(2, 'BK-1002', 'Introduction to Algorithms (CLRS)', 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest', 1, '978-0262033848', 'MIT Press', 2009, 4, 4, 'CS-A1-02', '', '2026-08-25 17:28:39'),
(3, 'BK-1003', 'Design Patterns: Elements of Reusable Object-Oriented Software', 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides', 1, '978-0201633610', 'Addison-Wesley', 1994, 4, 4, 'CS-A1-03', '', '2026-08-25 17:28:39'),
(4, 'BK-1004', 'The Pragmatic Programmer: Your Journey To Mastery', 'David Thomas, Andrew Hunt', 1, '978-0135957059', 'Addison-Wesley Professional', 2019, 6, 6, 'CS-A2-01', '', '2026-08-25 17:28:39'),
(5, 'BK-1005', 'A Brief History of Time', 'Stephen Hawking', 3, '978-0553380163', 'Bantam Books', 1998, 5, 5, 'SC-B1-01', '', '2026-08-25 17:28:39'),
(6, 'BK-1006', 'Cosmos', 'Carl Sagan', 3, '978-0345539434', 'Ballantine Books', 1980, 3, 3, 'SC-B1-02', '', '2026-08-25 17:28:39'),
(7, 'BK-1007', 'Linear Algebra and Its Applications', 'Gilbert Strang', 4, '978-0030105678', 'Cengage Learning', 2005, 4, 4, 'MT-C1-01', '', '2026-08-25 17:28:39'),
(8, 'BK-1008', 'Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 6, '978-0062316097', 'Harper', 2014, 5, 5, 'HS-D1-01', '', '2026-08-25 17:28:39'),
(9, 'BK-1009', 'Steve Jobs', 'Walter Isaacson', 7, '978-1451648539', 'Simon & Schuster', 2011, 4, 4, 'BG-E1-01', '', '2026-08-25 17:28:39'),
(10, 'BK-1010', 'To Kill a Mockingbird', 'Harper Lee', 5, '978-0061120084', 'Harper Perennial Modern Classics', 1960, 6, 6, 'FC-F1-01', '', '2026-08-25 17:28:39'),
(11, 'BK-1011', '1984', 'George Orwell', 5, '978-0451524935', 'Signet Classic', 1949, 5, 5, 'FC-F1-02', '', '2026-08-25 17:28:39'),
(12, 'BK-1012', 'The Innovators: How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution', 'Walter Isaacson', 2, '978-1476708690', 'Simon & Schuster', 2014, 4, 4, 'TC-A2-02', '', '2026-08-25 17:28:39');

-- Dumping data for table `members`
INSERT INTO `members` (`id`, `member_code`, `full_name`, `email`, `password_hash`, `phone`, `address`, `membership_date`, `status`, `created_at`) VALUES
(1, 'MEM-001', 'Akhilesh Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9931964443', 'Sitamarhi, Bihar', '2025-01-10', 'Active', '2026-08-25 17:28:39'),
(2, 'MEM-002', 'Chandra Mohan Thakur', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9973458244', 'Harmu Colony, Ranchi, Jharkhand', '2025-01-20', 'Active', '2026-08-25 17:28:39'),
(3, 'MEM-003', 'Aman Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9798229184', NULL, '2025-02-05', 'Active', '2026-08-25 17:28:39'),
(4, 'MEM-004', 'Ashish Kumar Singh', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9304232905', 'Madhubani, Bihar', '2025-02-15', 'Active', '2026-08-25 17:28:39'),
(5, 'MEM-005', 'Sonali Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 8051561554', 'Salt Lake Sector 5, Kolkata, WB', '2025-03-01', 'Active', '2026-08-25 17:28:39'),
(6, 'MEM-006', 'Sonam Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9234784808', 'Madhubani, Bihar', '2025-03-12', 'Active', '2026-08-25 17:28:39'),
(7, 'MEM-007', 'Manish Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 7061172817', 'Begusarai, Bihar', '2025-03-22', 'Active', '2026-08-25 17:28:39'),
(8, 'MEM-008', 'Nishu Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 95544 88990', 'Gomti Nagar, Lucknow, UP', '2025-04-02', 'Active', '2026-08-25 17:28:39');
