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

-- ================================================================
-- AUTHORITATIVE BASELINE SEED DATA (PostgreSQL)
-- ================================================================

-- Data for table users
INSERT INTO users (id, name, role, email, password_hash, phone, created_at) VALUES
(1, 'Akhilesh Kumar', 'Librarian', 'akhilesh@library.com', '$2a$10$U8tRjX3gT8du40N8exqlmun954Yg.fzWDWLXunTyqsnNTRnu7hnsO', '+91 9931964443', '2026-08-25 17:28:39');
SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;

-- Data for table categories
INSERT INTO categories (id, name, description, created_at) VALUES
(1, 'Computer Science', 'Programming, Software Engineering, AI, Databases and Networks', '2026-08-25 17:28:39'),
(2, 'Technology', 'Modern technology trends, electronics, robotics and emerging tech', '2026-08-25 17:28:39'),
(3, 'Science', 'Physics, Chemistry, Biology, Astronomy, and Earth Sciences', '2026-08-25 17:28:39'),
(4, 'Mathematics', 'Calculus, Linear Algebra, Statistics, and Discrete Mathematics', '2026-08-25 17:28:39'),
(5, 'Fiction', 'Novels, classic literature, sci-fi and modern fiction', '2026-08-25 17:28:39'),
(6, 'History', 'World history, ancient civilizations, and modern historical events', '2026-08-25 17:28:39'),
(7, 'Biography', 'Memoirs and biographies of eminent personalities', '2026-08-25 17:28:39'),
(41, 'Adventure', 'Adventure novels, thrilling journeys and expeditions', '2026-09-14 10:03:37'),
(42, 'Science Fiction', 'Sci-Fi, time travel, futuristic and speculative fiction', '2026-09-14 10:03:37'),
(43, 'Horror', 'Gothic horror, psychological terror and suspense', '2026-09-14 10:03:37'),
(44, 'Drama', 'Plays, theatrical works and dramatic literature', '2026-09-14 10:03:37'),
(45, 'Mystery', 'Detective stories, crime fiction and mystery classics', '2026-09-14 10:03:37'),
(46, 'Children''s', 'Children''s literature, fairy tales and fables', '2026-09-14 10:03:37'),
(47, 'Fantasy', 'Fantasy literature, magical worlds and epic adventures', '2026-09-14 10:03:37'),
(48, 'Classic', 'Timeless literary masterpieces and philosophical classics', '2026-09-14 10:03:37'),
(49, 'Philosophy', 'Ancient and modern philosophical treatises and ethics', '2026-09-14 10:03:37');
SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;

-- Data for table books
INSERT INTO books (id, book_code, title, author, category_id, isbn, publisher, publication_year, total_copies, available_copies, shelf_location, cover_image, created_at) VALUES
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
(12, 'BK-1012', 'The Innovators: How a Group of Hackers, Geniuses, and Geeks Created the Digital Revolution', 'Walter Isaacson', 2, '978-1476708690', 'Simon & Schuster', 2014, 4, 4, 'TC-A2-02', '', '2026-08-25 17:28:39'),
(46, 'BK-1013', 'Pride and Prejudice', 'Jane Austen', 5, '978-0141439518', 'Penguin Classics', 2003, 4, 4, 'FC-G1-01', '', '2026-09-14 10:03:37'),
(47, 'BK-1047', 'Sense and Sensibility', 'Jane Austen', 5, '978-0141439662', 'Penguin Books', 2014, 4, 4, 'FC-G1-02', '', '2026-09-14 10:03:37'),
(48, 'BK-1048', 'Emma', 'Jane Austen', 5, '978-0141439587', 'Penguin Books', 2015, 4, 4, 'FC-G1-03', '', '2026-09-14 10:03:37'),
(49, 'BK-1049', 'Great Expectations', 'Charles Dickens', 5, '978-0141439563', 'Penguin Books', 1993, 4, 4, 'FC-G2-01', '', '2026-09-14 10:03:37'),
(50, 'BK-1050', 'Oliver Twist', 'Charles Dickens', 5, '978-0141439747', 'Penguin Books', 2003, 4, 4, 'FC-G2-02', '', '2026-09-14 10:03:37'),
(51, 'BK-1051', 'A Tale of Two Cities', 'Charles Dickens', 6, '978-0141439600', 'Penguin Books', 2003, 4, 4, 'HS-D2-01', '', '2026-09-14 10:03:37'),
(52, 'BK-1052', 'Jane Eyre', 'Charlotte Brontë', 5, '978-0141441146', 'PENGUIN BOOKS', 2006, 4, 4, 'FC-G2-03', '', '2026-09-14 10:03:37'),
(53, 'BK-1053', 'Wuthering Heights', 'Emily Brontë', 5, '978-0141439556', 'Penguin Books', 2003, 4, 4, 'FC-G3-01', '', '2026-09-14 10:03:37'),
(54, 'BK-1054', 'Little Women', 'Louisa May Alcott', 5, '978-0143106654', 'Penguin Classics, Penguin', 2012, 4, 4, 'FC-G3-02', '', '2026-09-14 10:03:37'),
(55, 'BK-1055', 'The Great Gatsby', 'F. Scott Fitzgerald', 5, '978-0743273565', 'Independently Published', 2021, 4, 4, 'FC-G3-03', '', '2026-09-14 10:03:37'),
(56, 'BK-1056', 'Moby-Dick', 'Herman Melville', 41, '978-0142437247', 'Penguin Books', 2003, 4, 4, 'AD-A1-01', '', '2026-09-14 10:03:37'),
(57, 'BK-1057', 'The Adventures of Tom Sawyer', 'Mark Twain', 41, '978-0143039563', 'Mediasat Group', 2005, 4, 4, 'AD-A1-02', '', '2026-09-14 10:03:37'),
(58, 'BK-1058', 'Adventures of Huckleberry Finn', 'Mark Twain', 41, '978-0143107323', 'Penguin Books', 2014, 4, 4, 'AD-A1-03', '', '2026-09-14 10:03:37'),
(59, 'BK-1059', 'Treasure Island', 'Robert Louis Stevenson', 41, '978-0140437683', 'Penguin Books', 1999, 4, 4, 'AD-A2-01', '', '2026-09-14 10:03:37'),
(60, 'BK-1060', 'Around the World in 80 Days', 'Jules Verne', 41, '978-0140449068', 'Penguin Books', 2004, 4, 4, 'AD-A2-02', '', '2026-09-14 10:03:37'),
(61, 'BK-1061', 'Twenty Thousand Leagues Under the Seas', 'Jules Verne', 41, '978-0199538645', 'Oxford University Press', 2009, 4, 4, 'AD-A2-03', '', '2026-09-14 10:03:37'),
(62, 'BK-1062', 'The Time Machine', 'H. G. Wells', 42, '978-0141439976', 'PENGUIN BOOKS', 2005, 4, 4, 'SF-B1-01', '', '2026-09-14 10:03:37'),
(63, 'BK-1063', 'The War of the Worlds', 'H. G. Wells', 42, '978-0141441030', 'Penguin Books', 2005, 4, 4, 'SF-B1-02', '', '2026-09-14 10:03:37'),
(64, 'BK-1064', 'Frankenstein', 'Mary Shelley', 43, '978-0141439471', 'Penguin Books', 2003, 4, 4, 'HR-C1-01', '', '2026-09-14 10:03:37'),
(65, 'BK-1065', 'Dracula', 'Bram Stoker', 43, '978-0141439846', 'Penguin Books', 2003, 4, 4, 'HR-C1-02', '', '2026-09-14 10:03:37'),
(66, 'BK-1066', 'The Picture of Dorian Gray', 'Oscar Wilde', 5, '978-0141439570', 'Penguin Books', 2003, 4, 4, 'FC-G4-01', '', '2026-09-14 10:03:37'),
(67, 'BK-1067', 'The Importance of Being Earnest', 'Oscar Wilde', 44, '978-0486264783', 'Dover Publications', 1990, 4, 4, 'DR-D1-01', '', '2026-09-14 10:03:37'),
(68, 'BK-1068', 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 45, '978-0141034331', 'Penguin Books', 2007, 4, 4, 'MY-E1-01', '', '2026-09-14 10:03:37'),
(69, 'BK-1069', 'The Sign of the Four', 'Arthur Conan Doyle', 45, '978-0140439076', 'Penguin Books', 2001, 4, 4, 'MY-E1-02', '', '2026-09-14 10:03:37'),
(70, 'BK-1070', 'The Hound of the Baskervilles', 'Arthur Conan Doyle', 45, '978-0140437867', 'Penguin Books', 2003, 4, 4, 'MY-E1-03', '', '2026-09-14 10:03:37'),
(71, 'BK-1071', 'The Secret Garden', 'Frances Hodgson Burnett', 46, '978-0141321066', 'Puffin', 2008, 4, 4, 'CH-F1-01', '', '2026-09-14 10:03:37'),
(72, 'BK-1072', 'Alice''s Adventures in Wonderland', 'Lewis Carroll', 46, '978-0141439761', 'Penguin', 1998, 4, 4, 'CH-F1-02', '', '2026-09-14 10:03:37'),
(73, 'BK-1073', 'Through the Looking-Glass', 'Lewis Carroll', 46, '978-0141439679', 'Penguin Books', 2003, 4, 4, 'CH-F1-03', '', '2026-09-14 10:03:37'),
(74, 'BK-1074', 'Anne of Green Gables', 'L. M. Montgomery', 46, '978-0141321592', 'Puffin Classics', 2008, 4, 4, 'CH-F2-01', '', '2026-09-14 10:03:37'),
(75, 'BK-1075', 'Black Beauty', 'Anna Sewell', 46, '978-0141321035', 'Puffin', 2008, 4, 4, 'CH-F2-02', '', '2026-09-14 10:03:37'),
(76, 'BK-1076', 'The Wonderful Wizard of Oz', 'L. Frank Baum', 47, '978-0199540648', 'Oxford University Press', 2008, 4, 4, 'FN-G1-01', '', '2026-09-14 10:03:37'),
(77, 'BK-1077', 'The Wind in the Willows', 'Kenneth Grahame', 46, '978-0143039099', 'Penguin Books', 2005, 4, 4, 'CH-F3-01', '', '2026-09-14 10:03:37'),
(78, 'BK-1078', 'The Jungle Book', 'Rudyard Kipling', 46, '978-0141325293', 'Puffin Classics', 2009, 4, 4, 'CH-F3-02', '', '2026-09-14 10:03:37'),
(79, 'BK-1079', 'The Call of the Wild', 'Jack London', 41, '978-0140622621', 'Penguin', 1997, 4, 4, 'AD-A3-01', '', '2026-09-14 10:03:37'),
(80, 'BK-1080', 'White Fang', 'Jack London', 41, '978-0140623383', 'Penguin Books', 1994, 4, 4, 'AD-A3-02', '', '2026-09-14 10:03:37'),
(81, 'BK-1081', 'Crime and Punishment', 'Fyodor Dostoevsky', 48, '978-0140449136', 'Penguin', 2003, 4, 4, 'CL-H1-01', '', '2026-09-14 10:03:37'),
(82, 'BK-1082', 'The Brothers Karamazov', 'Fyodor Dostoevsky', 48, '978-0140449242', 'Penguin classics', 1993, 4, 4, 'CL-H1-02', '', '2026-09-14 10:03:37'),
(83, 'BK-1083', 'War and Peace', 'Leo Tolstoy', 6, '978-0140447934', 'Penguin Books', 2007, 4, 4, 'HS-D2-02', '', '2026-09-14 10:03:37'),
(84, 'BK-1084', 'Anna Karenina', 'Leo Tolstoy', 48, '978-0143035008', 'Penguin', 2004, 4, 4, 'CL-H1-03', '', '2026-09-14 10:03:37'),
(85, 'BK-1085', 'The Death of Ivan Ilyich', 'Leo Tolstoy', 48, '978-0140449617', 'Penguin Books, Penguin', 2008, 4, 4, 'CL-H2-01', '', '2026-09-14 10:03:37'),
(86, 'BK-1086', 'The Metamorphosis', 'Franz Kafka', 48, '978-0143105244', 'Penguin Classics, Penguin Books', 2008, 4, 4, 'CL-H2-02', '', '2026-09-14 10:03:37'),
(87, 'BK-1087', 'The Trial', 'Franz Kafka', 5, '978-0141182902', 'Penguin Books Ltd', 2000, 4, 4, 'FC-G4-02', '', '2026-09-14 10:03:37'),
(88, 'BK-1088', 'The Count of Monte Cristo', 'Alexandre Dumas', 41, '978-0140449266', 'Penguin Books', 2003, 4, 4, 'AD-A4-01', '', '2026-09-14 10:03:37'),
(89, 'BK-1089', 'The Three Musketeers', 'Alexandre Dumas', 41, '978-0140440256', 'Penguin Books', 1970, 4, 4, 'AD-A4-02', '', '2026-09-14 10:03:37'),
(90, 'BK-1090', 'Don Quixote', 'Miguel de Cervantes', 48, '978-0142437230', 'Penguin Putnam', 2003, 4, 4, 'CL-H3-01', '', '2026-09-14 10:03:37'),
(91, 'BK-1091', 'The Canterbury Tales', 'Geoffrey Chaucer', 48, '978-0140424386', 'Penguin', 2003, 4, 4, 'CL-H3-02', '', '2026-09-14 10:03:37'),
(92, 'BK-1092', 'The Republic', 'Plato', 49, '978-0140455113', 'Penguin Classics', 2007, 4, 4, 'PH-I1-01', '', '2026-09-14 10:03:37'),
(93, 'BK-1093', 'Meditations', 'Marcus Aurelius', 49, '978-0140449334', 'Penguin Books', 2006, 4, 4, 'PH-I1-02', '', '2026-09-14 10:03:37'),
(94, 'BK-1094', 'The Art of War', 'Sun Tzu', 49, '978-0140455526', 'imusti, Penguin Classic', 2008, 4, 4, 'PH-I1-03', '', '2026-09-14 10:03:37'),
(95, 'BK-1095', 'Aesop''s Fables', 'Aesop', 46, '978-0199540754', 'Oxford University Press', 2008, 4, 4, 'CH-F4-01', '', '2026-09-14 10:03:37');
SELECT setval(pg_get_serial_sequence('books', 'id'), coalesce(max(id), 1)) FROM books;

-- Data for table members
INSERT INTO members (id, member_code, full_name, email, password_hash, phone, address, membership_date, status, created_at) VALUES
(1, 'MEM-001', 'Akhilesh Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9931964443', 'Sitamarhi, Bihar', '2025-01-10', 'Active', '2026-08-25 17:28:39'),
(2, 'MEM-002', 'Chandra Mohan Thakur', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9973458244', 'Harmu Colony, Ranchi, Jharkhand', '2025-01-20', 'Active', '2026-08-25 17:28:39'),
(3, 'MEM-003', 'Aman Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9798229184', NULL, '2025-02-05', 'Active', '2026-08-25 17:28:39'),
(4, 'MEM-004', 'Ashish Kumar Singh', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9304232905', 'Madhubani, Bihar', '2025-02-15', 'Active', '2026-08-25 17:28:39'),
(5, 'MEM-005', 'Sonali Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 8051561554', 'Salt Lake Sector 5, Kolkata, WB', '2025-03-01', 'Active', '2026-08-25 17:28:39'),
(6, 'MEM-006', 'Sonam Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 9234784808', 'Madhubani, Bihar', '2025-03-12', 'Active', '2026-08-25 17:28:39'),
(7, 'MEM-007', 'Manish Kumar', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 7061172817', 'Begusarai, Bihar', '2025-03-22', 'Active', '2026-08-25 17:28:39'),
(8, 'MEM-008', 'Nishu Kumari', NULL, '$2a$10$OvBHXLA8VXwQK6dCQmZYx.4EklG3x0LWZFz6UHrHwZQsjfpzI2gXa', '+91 95544 88990', 'Gomti Nagar, Lucknow, UP', '2025-04-02', 'Active', '2026-08-25 17:28:39');
SELECT setval(pg_get_serial_sequence('members', 'id'), coalesce(max(id), 1)) FROM members;
