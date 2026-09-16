# 📚 Digital Librarian — Library Management System

A clean, modern, robust, and production-ready Library Management System built with **Node.js**, **Express.js**, **SQLite** (`node:sqlite`), and **Vanilla HTML5/CSS3/JavaScript**.

---

## 🌟 Features & Highlights

### 1. 📊 Real-Time Dashboard & Analytics
- **Live Metrics**: Total Books, Total Available Copies, Total Members, Active Loans, Overdue Books, and Pending Fines calculated in real time from SQLite.
- **Interactive Visualizations**: Chart.js charts for **Books by Category** (Doughnut) and **Monthly Circulation Trends** (Bar).
- **Recent Activity Table**: Instant overview of recent checkouts and returns.

### 2. 🔐 Authentication, Multi-Device Login & Admin Approval System
- Secure JWT (JSON Web Token) authentication with `bcryptjs` password hashing.
- **Multi-Device Support (Option A)**: Independent sessions for laptops, phones, and tablets without cross-device logout conflicts.
- **Admin Approval System**: Supports secondary administrator approval requests with 5-minute timeout window and instant approve/reject actions.
- **Audit Logging System**: Complete historical audit trail recording logins, logouts, approvals, rejections, password changes, and profile edits.
- Pre-seeded main librarian account:
  - **Name**: `Akhilesh Kumar`
  - **Role**: `Librarian`
  - **Email**: `akhilesh@library.com`
  - **Password**: `Password@123`

### 3. 📚 Catalog & Book Management
- Full CRUD operations with instant search (Title, Author, ISBN, Code, Shelf location) and category filtering.
- Tracks `total_copies` vs. `available_copies` with strict non-negative availability constraints.
- Foreign key protection prevents deletion of books with active borrowings.
- Exact shelf/rack location tracking (e.g. `CS-A1-01`).

### 4. 🗂️ Category Management
- Organize books across categories (Computer Science, Technology, Science, Mathematics, Fiction, History, Biography).
- Real-time aggregation of book counts and copy availability per category.
- Foreign key protection prevents deleting categories with assigned books.

### 5. 👥 Member Management
- Register, edit, and manage library patrons.
- Track individual member borrowing history, active loans, and overdue counts.
- Pre-seeded with 8 verified registered members (`MEM-001` through `MEM-008`).
- **Member Email Feature**: Only the Librarian is authorized to add or update member emails. Normal members have read-only access.

### 6. 🔄 Circulation: Issue & Return Workflows
- **Issue Book**:
  - Validates active member standing and copy availability (`available_copies > 0`).
  - Generates unique loan transaction code (e.g. `LN-2026-0001`).
  - Decreases available copies by 1 within an atomic database transaction.
- **Return Book**:
  - Restores available copy count by 1 (never exceeding `total_copies`).
  - Automatic overdue detection and fine calculation at standard rate (**₹5 per overdue day**).
  - Ability to record instant fine collection or keep as pending.

### 7. ⚠️ Overdue Tracking & Fine Management
- Live list of loans exceeding due dates.
- Dynamic calculation of days overdue and total fine amounts.
- Direct "Return & Settle Fine" action.

### 8. 📋 Comprehensive Reports & CSV Export
- Tabbed reports:
  - **Book Inventory Report**
  - **Member List Report**
  - **Active Loans Report**
  - **Returned Books History Report**
  - **Overdue Summary Report**
  - **Fines & Penalties Report**
- One-click **RFC 4180-compliant CSV download** for all reports.

### 9. 📱 Modern & Responsive Design
- Dark navy/blue theme (`#0a0f1d`, `#111827`, `#4f46e5`, `#38bdf8`) with glassmorphic cards and crisp contrast.
- Fully responsive on **Desktop** (1200px+), **Tablet** (768px–1199px), and **Mobile** (<768px) with off-canvas sidebar navigation.
- Built-in loading spinners, error alerts, empty states, and toast notifications.

---

## 🏛️ Authoritative Baseline Dataset

| Metric | Authoritative Count |
|---|---|
| **Unique Book Titles** | Exactly 62 |
| **Physical Book Copies** | Exactly 255 |
| **Available Book Copies (Baseline)** | Exactly 255 |
| **Registered Members** | Exactly 8 (`MEM-001` to `MEM-008`) |
| **Categories** | Exactly 16 |
| **Active Loans (Baseline)** | 0 |
| **Overdue Loans (Baseline)** | 0 |
| **Pending Fines (Baseline)** | ₹0.00 |
| **Librarian Account** | Akhilesh Kumar (`akhilesh@library.com`) |

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js (v20+ / v22+ / v24+), Express.js 4.x |
| **Database** | SQLite (Embedded via native `node:sqlite`, WAL mode, Foreign Keys ON) + MySQL/MariaDB Migration Ready |
| **Authentication** | JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`) |
| **Frontend** | Vanilla HTML5, CSS3, JavaScript (ES6+), Chart.js |
| **Deployment** | Render (Web Service), Docker, GitHub, VPS / cPanel Ready |

---

## 📁 Directory Structure

```
digital-librarian/
├── backend/
│   ├── controllers/         # Modular controllers (auth, books, categories, members, loans, dashboard, reports)
│   ├── database/            # db.js (SQLite setup, schema migrations, seed check, audit & approval tables)
│   ├── middleware/         # auth.js (JWT validation, requireLibrarian authorization)
│   ├── routes/             # Express API route modules
│   ├── tests/              # Comprehensive test suites (authoritative data, system integrity, 16-point feature checks, E2E HTTP)
│   ├── utils/              # fineCalculator.js, csvExporter.js
│   └── server.js           # Server entry point (security headers, reverse proxy trust, CORS, static serving)
├── database/
│   ├── library.db          # Authoritative SQLite database file
│   ├── digital_librarian_schema.sql       # Production MySQL / MariaDB DDL Schema
│   ├── digital_librarian_mysql_import.sql # Complete MySQL import dump with seed data
│   ├── export_sqlite_to_sql.js            # Automated SQLite to MySQL dump generator
│   └── backups/                           # Timestamped database backups
├── frontend/
│   ├── assets/
│   │   ├── css/            # Modern dark-theme responsive stylesheets
│   │   └── js/             # Frontend JavaScript (api.js, auth.js, dashboard.js, books.js, members.js, etc.)
│   ├── index.html          # Main Dashboard
│   ├── login.html          # Authentication page
│   ├── books.html          # Books catalog & inventory
│   ├── categories.html     # Categories management
│   ├── members.html        # Members management & email update
│   ├── issue.html          # Book issue workflow
│   ├── return.html         # Book return workflow
│   ├── loans.html          # Active loans tracking
│   ├── overdue.html        # Overdue tracking & fine calculator
│   ├── reports.html        # System analytics & CSV export
│   └── profile.html        # Librarian profile
├── uploads/                # Directory for cover images
├── .env.example            # Production environment template
├── .gitignore              # Git ignore rules
├── Dockerfile              # Production multi-stage Dockerfile
├── render.yaml             # Render blueprint / Infrastructure as Code configuration
├── package.json            # Node.js configuration & scripts
└── README.md               # Project documentation & deployment guide
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v20.0.0 or higher, tested on v24.15.0)
- npm (v9.0.0 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Run Verification Tests
Run the comprehensive test runner (56 automated checks verifying authoritative data, system integrity, 16-point feature tests, user test cases, admin approval system, and E2E HTTP endpoints):
```bash
npm test
```

### 5. Start Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.

---

## ☁️ Production Deployment Guide

### Architecture
The project uses a **single unified web service** architecture: Express serves both the REST API at `/api/*` and the static frontend at `/`. All API requests made by the frontend dynamically use relative paths (`/api`), ensuring that the deployed application operates seamlessly through **ONE public HTTPS URL** (e.g. `https://digital-librarian-xxxx.onrender.com`).

---

### Option 1: Render Deployment (1-Click Blueprint)

1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: digital librarian production release"
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/digital-librarian.git
   git branch -M main
   git push -u origin main
   ```
2. Go to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Select your GitHub repository (`digital-librarian`).
5. Render will automatically read [`render.yaml`](render.yaml) and configure the web service with:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Auto-generated JWT Secret**
6. Click **Apply**.

---

### Option 2: MySQL / MariaDB Hosting (cPanel / VPS / Cloud SQL)

1. Open **cPanel** → **phpMyAdmin** (or connect via MySQL CLI).
2. Create database `library_management_system`.
3. Import [`database/digital_librarian_mysql_import.sql`](database/digital_librarian_mysql_import.sql).
4. Run the Node.js service pointing to your environment or use the provided API routes.

---

## 🔑 Default Librarian Account

| Attribute | Details |
|---|---|
| **Role** | `Librarian` |
| **Name** | `Akhilesh Kumar` |
| **Email** | `akhilesh@library.com` |
| **Password** | `Password@123` |

---

## 🧪 Verification & Quality Assurance

Run all test suites with:
```bash
npm test
```

Verified Test Coverage:
- `verify_authoritative_data.js` — Checks 12 books, 55 copies, 8 members, 7 categories, 11 authors, 11 publishers, 0 loans, ₹0 fines.
- `verify_system.js` — Checks authentication, password hashing, issue/return transactions, fine calculations, CSV output, branding, admin approval system, audit logs, multi-device isolation, and migration assets.
- `verify_feature_16_points.js` — 16-point feature verification including member email management and role permissions.
- `verify_user_test_cases.js` — 8 user scenario tests for email additions, updates, duplicate detection, and invalid format handling.
- `e2e_http_test.js` — End-to-end HTTP API tests across all routes including health check, admin approval requests, and audit logs.

---

## 📄 License
This project is licensed under the ISC License.
