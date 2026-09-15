const { db } = require('../database/db');
const { calculateOverdueFine, getFineRatePerDay } = require('../utils/fineCalculator');

/**
 * Issue a Book to a Member (Atomic Transaction)
 */
async function issueBook(req, res) {
  try {
    const { book_id, member_id, issue_date, due_date, notes } = req.body;

    if (!book_id || !member_id || !issue_date || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'Book, Member, Issue Date, and Due Date are required.'
      });
    }

    // Validate dates
    const issueD = new Date(issue_date);
    const dueD = new Date(due_date);
    if (dueD <= issueD) {
      return res.status(400).json({
        success: false,
        message: 'Due date must be after the issue date.'
      });
    }

    // 1. Check member exists & is active
    const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(member_id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Selected member was not found.'
      });
    }

    if (member.status === 'Suspended') {
      return res.status(400).json({
        success: false,
        message: `Member "${member.full_name}" is currently suspended and cannot be issued books.`
      });
    }

    // 2. Check book exists
    const book = await db.prepare('SELECT * FROM books WHERE id = ?').get(book_id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Selected book was not found.'
      });
    }

    // 3. Check available copies > 0
    if (book.available_copies <= 0) {
      return res.status(400).json({
        success: false,
        message: `No available copies for "${book.title}". All ${book.total_copies} copies are currently on loan.`
      });
    }

    // 4. Generate unique loan transaction code (e.g. LN-2026-0042)
    const maxLoan = await db.prepare('SELECT MAX(id) as max_id FROM loans').get();
    const nextLoanNum = (maxLoan?.max_id || 0) + 1;
    const year = new Date().getFullYear();
    const loanCode = `LN-${year}-${String(nextLoanNum).padStart(4, '0')}`;

    // 5. Atomic transaction execution
    await db.exec('BEGIN TRANSACTION');

    try {
      // Insert loan record
      const insertLoan = db.prepare(`
        INSERT INTO loans (
          loan_code, book_id, member_id, issue_date, due_date, return_date, status, fine_amount, fine_paid, notes
        ) VALUES (?, ?, ?, ?, ?, NULL, 'Issued', 0, 0, ?)
      `);
      const loanResult = await insertLoan.run(
        loanCode,
        parseInt(book_id),
        parseInt(member_id),
        issue_date,
        due_date,
        notes ? notes.trim() : null
      );

      // Decrement available copies safely
      const updateBook = db.prepare(`
        UPDATE books 
        SET available_copies = available_copies - 1 
        WHERE id = ? AND available_copies > 0
      `);
      const bookUpdateRes = await updateBook.run(book_id);

      if (bookUpdateRes.changes === 0) {
        throw new Error('Failed to reserve book copy. It may have just been issued.');
      }

      await db.exec('COMMIT');

      const createdLoan = await db.prepare(`
        SELECT 
          l.*,
          b.title as book_title,
          b.book_code,
          b.isbn,
          b.available_copies,
          b.total_copies,
          m.full_name as member_name,
          m.member_code,
          m.email as member_email
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN members m ON l.member_id = m.id
        WHERE l.id = ?
      `).get(loanResult.lastInsertRowid);

      return res.status(201).json({
        success: true,
        message: `Book "${book.title}" issued successfully to ${member.full_name}. Loan Code: ${loanCode}`,
        data: createdLoan
      });
    } catch (txError) {
      await db.exec('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('issueBook error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to issue book.'
    });
  }
}

/**
 * Return a Book (Atomic Transaction with Fine Calculation)
 */
async function returnBook(req, res) {
  try {
    const { id } = req.params;
    const { return_date, fine_paid = 0, notes } = req.body;

    const actualReturnDate = return_date || new Date().toISOString().split('T')[0];

    // Find loan
    const loan = await db.prepare(`
      SELECT l.*, b.title as book_title, b.available_copies, b.total_copies, m.full_name as member_name
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      WHERE l.id = ?
    `).get(id);

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan record not found.'
      });
    }

    if (loan.return_date) {
      return res.status(400).json({
        success: false,
        message: `This book has already been returned on ${loan.return_date}.`
      });
    }

    // Calculate fine if returned after due date
    const { daysOverdue, fineAmount } = calculateOverdueFine(loan.due_date, actualReturnDate);

    // Atomic transaction
    await db.exec('BEGIN TRANSACTION');

    try {
      // 1. Update loan record
      const isPaid = fineAmount > 0 ? (parseInt(fine_paid) === 1 ? 1 : 0) : 1;
      const finalNotes = notes ? (loan.notes ? `${loan.notes} | ${notes}` : notes) : loan.notes;

      await db.prepare(`
        UPDATE loans
        SET 
          return_date = ?,
          status = 'Returned',
          fine_amount = ?,
          fine_paid = ?,
          notes = ?
        WHERE id = ?
      `).run(actualReturnDate, fineAmount, isPaid, finalNotes, id);

      // 2. Increase available copies by 1, never exceeding total_copies
      await db.prepare(`
        UPDATE books
        SET available_copies = CASE WHEN available_copies < total_copies THEN available_copies + 1 ELSE total_copies END
        WHERE id = ?
      `).run(loan.book_id);

      // 3. Record fine in fines table if fine applies
      if (fineAmount > 0) {
        await db.prepare(`
          INSERT INTO fines (loan_id, member_id, days_overdue, amount, status, payment_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          loan.id,
          loan.member_id,
          daysOverdue,
          fineAmount,
          isPaid === 1 ? 'Paid' : 'Unpaid',
          isPaid === 1 ? actualReturnDate : null
        );
      }

      await db.exec('COMMIT');

      const updatedLoan = await db.prepare(`
        SELECT 
          l.*,
          b.title as book_title,
          b.available_copies,
          b.total_copies,
          m.full_name as member_name,
          m.member_code
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN members m ON l.member_id = m.id
        WHERE l.id = ?
      `).get(id);

      let message = `Book "${loan.book_title}" returned successfully.`;
      if (fineAmount > 0) {
        message += ` Overdue by ${daysOverdue} days. Fine calculated: ₹${fineAmount}.`;
      }

      return res.status(200).json({
        success: true,
        message,
        data: {
          ...updatedLoan,
          days_overdue: daysOverdue,
          fine_amount: fineAmount
        }
      });
    } catch (txError) {
      await db.exec('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('returnBook error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process book return.'
    });
  }
}

/**
 * Get Active Loans (all currently issued books)
 */
async function getActiveLoans(req, res) {
  try {
    const { search, overdue_only, page = 1, limit = 50 } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fineRate = getFineRatePerDay();

    let query = `
      SELECT 
        l.id,
        l.loan_code,
        l.book_id,
        l.member_id,
        l.issue_date,
        l.due_date,
        l.return_date,
        l.status,
        l.fine_amount,
        l.notes,
        l.created_at,
        b.title as book_title,
        b.book_code,
        b.isbn,
        b.author as book_author,
        b.shelf_location,
        m.full_name as member_name,
        m.member_code,
        m.email as member_email,
        m.phone as member_phone,
        CASE 
          WHEN l.due_date < '${today}' THEN 'Overdue'
          ELSE 'Issued'
        END as current_status
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      WHERE l.return_date IS NULL
    `;

    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (l.loan_code LIKE ? OR b.title LIKE ? OR b.isbn LIKE ? OR b.book_code LIKE ? OR m.full_name LIKE ? OR m.member_code LIKE ?)`;
      params.push(s, s, s, s, s, s);
    }

    if (overdue_only === 'true' || overdue_only === '1') {
      query += ` AND l.due_date < '${today}'`;
    }

    // Total Count
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countRow = await db.prepare(countQuery).get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ` ORDER BY l.due_date ASC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const loans = await db.prepare(query).all(...params);

    // Compute dynamic fine amounts
    const enrichedLoans = loans.map(loan => {
      const { daysOverdue, fineAmount } = calculateOverdueFine(loan.due_date);
      return {
        ...loan,
        days_overdue: daysOverdue,
        calculated_fine: fineAmount,
        fine_rate_per_day: fineRate,
        is_overdue: daysOverdue > 0
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedLoans,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getActiveLoans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve active loans.'
    });
  }
}

/**
 * Get Overdue Books with dynamic fine calculations
 */
async function getOverdueLoans(req, res) {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const fineRate = getFineRatePerDay();

    let query = `
      SELECT 
        l.id,
        l.loan_code,
        l.book_id,
        l.member_id,
        l.issue_date,
        l.due_date,
        l.status,
        l.notes,
        b.title as book_title,
        b.book_code,
        b.isbn,
        b.author as book_author,
        b.shelf_location,
        m.full_name as member_name,
        m.member_code,
        m.email as member_email,
        m.phone as member_phone
      FROM loans l
      JOIN books b ON l.book_id = b.id
      JOIN members m ON l.member_id = m.id
      WHERE l.return_date IS NULL AND l.due_date < ?
    `;

    const params = [today];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (l.loan_code LIKE ? OR b.title LIKE ? OR b.isbn LIKE ? OR m.full_name LIKE ? OR m.member_code LIKE ?)`;
      params.push(s, s, s, s, s);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countRow = await db.prepare(countQuery).get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ` ORDER BY l.due_date ASC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const loans = await db.prepare(query).all(...params);

    const enriched = loans.map(loan => {
      const { daysOverdue, fineAmount } = calculateOverdueFine(loan.due_date);
      return {
        ...loan,
        days_overdue: daysOverdue,
        fine_amount: fineAmount,
        fine_rate: fineRate,
        status: 'Overdue'
      };
    });

    return res.status(200).json({
      success: true,
      data: enriched,
      fine_rate_per_day: fineRate,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getOverdueLoans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve overdue loans.'
    });
  }
}

/**
 * Member Pay / Settle a Fine via UPI / Payment QR
 */
async function memberPayFine(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const today = new Date().toISOString().split('T')[0];

    const fine = await db.prepare(`
      SELECT f.*, l.loan_code, l.book_id, b.title as book_title, m.full_name as member_name, m.member_code
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      JOIN members m ON f.member_id = m.id
      WHERE f.id = ?
    `).get(id);

    if (!fine) {
      return res.status(404).json({
        success: false,
        message: 'Fine record not found.'
      });
    }

    // Role ownership security check: Members can only pay their own fines
    if (userRole === 'Member' && fine.member_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied. You are only authorized to settle fines for your own account.'
      });
    }

    if (fine.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This fine has already been settled and paid in full.'
      });
    }

    const txnRef = `TXN-UPI-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await db.exec('BEGIN TRANSACTION');
    try {
      await db.prepare(`
        UPDATE fines 
        SET status = 'Paid', payment_date = ? 
        WHERE id = ?
      `).run(today, id);

      await db.prepare(`
        UPDATE loans 
        SET fine_paid = 1 
        WHERE id = ?
      `).run(fine.loan_id);

      await db.exec('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Fine of ₹${Number(fine.amount).toFixed(2)} settled successfully via UPI / QR Payment.`,
        data: {
          receipt_id: `REC-${id}-${Date.now().toString().slice(-6)}`,
          fine_id: fine.id,
          loan_code: fine.loan_code,
          book_title: fine.book_title,
          member_name: fine.member_name,
          member_code: fine.member_code,
          amount_paid: fine.amount,
          payment_method: 'UPI / QR Code',
          payment_date: today,
          transaction_ref: txnRef,
          status: 'Paid'
        }
      });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('memberPayFine error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process fine payment.'
    });
  }
}

/**
 * Pay / Settle a Fine
 */
async function settleFine(req, res) {
  try {
    const { id } = req.params; // fine_id or loan_id
    const today = new Date().toISOString().split('T')[0];

    const fine = await db.prepare('SELECT * FROM fines WHERE id = ?').get(id);
    if (!fine) {
      return res.status(404).json({
        success: false,
        message: 'Fine record not found.'
      });
    }

    if (fine.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'This fine has already been marked as paid.'
      });
    }

    await db.exec('BEGIN TRANSACTION');
    try {
      await db.prepare(`
        UPDATE fines 
        SET status = 'Paid', payment_date = ? 
        WHERE id = ?
      `).run(today, id);

      await db.prepare(`
        UPDATE loans 
        SET fine_paid = 1 
        WHERE id = ?
      `).run(fine.loan_id);

      await db.exec('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Fine of ₹${fine.amount} settled successfully.`
      });
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('settleFine error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to settle fine.'
    });
  }
}

/**
 * Member: Request a Book (Automated Member Identity Association)
 */
async function requestBook(req, res) {
  try {
    const memberId = req.user.id;
    const { book_id, notes } = req.body;

    if (!book_id) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required to place a request.'
      });
    }

    // 1. Check member status
    const member = await db.prepare('SELECT id, full_name, member_code, status FROM members WHERE id = ?').get(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member account not found.'
      });
    }

    if (member.status === 'Suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your membership is currently suspended. You cannot request books.'
      });
    }

    // 2. Check book exists
    const book = await db.prepare('SELECT id, title, author, available_copies, total_copies FROM books WHERE id = ?').get(book_id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'The requested book was not found.'
      });
    }

    // 3. Check for existing active loan for this book
    const activeLoan = await db.prepare('SELECT id FROM loans WHERE member_id = ? AND book_id = ? AND return_date IS NULL').get(memberId, book_id);
    if (activeLoan) {
      return res.status(400).json({
        success: false,
        message: `You currently have "${book.title}" checked out.`
      });
    }

    // 4. Check for existing pending request
    const existingReq = await db.prepare("SELECT id, status FROM book_requests WHERE member_id = ? AND book_id = ? AND status IN ('Pending', 'Approved')").get(memberId, book_id);
    if (existingReq) {
      return res.status(400).json({
        success: false,
        message: `You already have an active request for "${book.title}" (Status: ${existingReq.status}).`
      });
    }

    // 5. Insert request
    const insertRes = await db.prepare(`
      INSERT INTO book_requests (member_id, book_id, status, notes, request_date, created_at)
      VALUES (?, ?, 'Pending', ?, datetime('now'), datetime('now'))
    `).run(memberId, book_id, notes ? notes.trim() : null);

    const createdReq = await db.prepare(`
      SELECT r.*, b.title as book_title, b.author as book_author, b.isbn, b.book_code
      FROM book_requests r
      JOIN books b ON r.book_id = b.id
      WHERE r.id = ?
    `).get(insertRes.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: `Book Request Submitted Successfully! Librarian will review your request for "${book.title}".`,
      data: createdReq
    });
  } catch (error) {
    console.error('requestBook error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit book request.'
    });
  }
}

/**
 * Member: Get Personal Book Requests
 */
async function getMyRequests(req, res) {
  try {
    const memberId = req.user.id;

    const requests = await db.prepare(`
      SELECT r.*, b.title as book_title, b.author as book_author, b.isbn, b.book_code, b.shelf_location, b.available_copies
      FROM book_requests r
      JOIN books b ON r.book_id = b.id
      WHERE r.member_id = ?
      ORDER BY r.request_date DESC
    `).all(memberId);

    return res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('getMyRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve book requests.'
    });
  }
}

/**
 * Member: Get Personal Loans, History & Fines
 */
async function getMyLoans(req, res) {
  try {
    const memberId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const fineRate = getFineRatePerDay();

    // Active loans
    const rawActive = await db.prepare(`
      SELECT 
        l.id, l.loan_code, l.book_id, l.member_id, l.issue_date, l.due_date, l.return_date, l.status, l.notes,
        b.title as book_title, b.author as book_author, b.isbn, b.book_code, b.shelf_location,
        CASE WHEN l.due_date < '${today}' THEN 'Overdue' ELSE 'Issued' END as current_status
      FROM loans l
      JOIN books b ON l.book_id = b.id
      WHERE l.member_id = ? AND l.return_date IS NULL
      ORDER BY l.due_date ASC
    `).all(memberId);

    const activeLoans = rawActive.map(loan => {
      const { daysOverdue, fineAmount } = calculateOverdueFine(loan.due_date);
      return {
        ...loan,
        days_overdue: daysOverdue,
        fine_amount: fineAmount,
        fine_rate: fineRate,
        is_overdue: daysOverdue > 0
      };
    });

    // Past returned loans
    const loanHistory = await db.prepare(`
      SELECT 
        l.id, l.loan_code, l.book_id, l.member_id, l.issue_date, l.due_date, l.return_date, l.status, l.fine_amount, l.fine_paid, l.notes,
        b.title as book_title, b.author as book_author, b.isbn, b.book_code
      FROM loans l
      JOIN books b ON l.book_id = b.id
      WHERE l.member_id = ? AND l.return_date IS NOT NULL
      ORDER BY l.return_date DESC
    `).all(memberId);

    // Fines
    const fines = await db.prepare(`
      SELECT f.*, l.loan_code, b.title as book_title
      FROM fines f
      JOIN loans l ON f.loan_id = l.id
      JOIN books b ON l.book_id = b.id
      WHERE f.member_id = ?
      ORDER BY f.id DESC
    `).all(memberId);

    // Book Requests
    const requests = await db.prepare(`
      SELECT r.*, b.title as book_title, b.author as book_author, b.isbn, b.book_code, b.available_copies
      FROM book_requests r
      JOIN books b ON r.book_id = b.id
      WHERE r.member_id = ?
      ORDER BY r.request_date DESC
    `).all(memberId);

    const totalActive = activeLoans.length;
    const totalReturned = loanHistory.length;
    const totalOverdue = activeLoans.filter(l => l.is_overdue).length;
    const pendingFines = fines.filter(f => f.status === 'Unpaid').reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const pendingRequests = requests.filter(r => r.status === 'Pending').length;

    return res.status(200).json({
      success: true,
      data: {
        active_loans: activeLoans,
        loan_history: loanHistory,
        fines,
        book_requests: requests,
        metrics: {
          active_loans_count: totalActive,
          total_borrowed_count: totalActive + totalReturned,
          overdue_count: totalOverdue,
          pending_fines_amount: pendingFines,
          pending_requests_count: pendingRequests
        }
      }
    });
  } catch (error) {
    console.error('getMyLoans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your borrowing records.'
    });
  }
}

/**
 * Librarian / Admin: Get All Member Book Requests Queue
 */
async function getMemberRequests(req, res) {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        r.id, r.member_id, r.book_id, r.status, r.notes, r.request_date, r.processed_by, r.processed_at, r.rejection_reason,
        b.title as book_title, b.author as book_author, b.isbn, b.book_code, b.available_copies, b.total_copies, b.shelf_location,
        m.full_name as member_name, m.member_code, m.email as member_email, m.phone as member_phone, m.status as member_status,
        u.name as processed_by_name
      FROM book_requests r
      JOIN books b ON r.book_id = b.id
      JOIN members m ON r.member_id = m.id
      LEFT JOIN users u ON r.processed_by = u.id
      WHERE 1=1
    `;

    const params = [];
    if (status && status !== 'all') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countRow = await db.prepare(countQuery).get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ` ORDER BY CASE WHEN r.status = 'Pending' THEN 1 WHEN r.status = 'Approved' THEN 2 ELSE 3 END, r.request_date DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const requests = await db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getMemberRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve member requests.'
    });
  }
}

/**
 * Librarian / Admin: Process Member Book Request (Approve, Reject, or Issue)
 */
async function actionMemberRequest(req, res) {
  try {
    const { id } = req.params;
    const { action, rejection_reason, due_date, notes } = req.body;
    const librarianId = req.user.id;

    if (!['APPROVE', 'REJECT', 'ISSUE'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be APPROVE, REJECT, or ISSUE.'
      });
    }

    const request = await db.prepare(`
      SELECT r.*, b.title as book_title, b.available_copies, b.total_copies, m.full_name as member_name, m.status as member_status
      FROM book_requests r
      JOIN books b ON r.book_id = b.id
      JOIN members m ON r.member_id = m.id
      WHERE r.id = ?
    `).get(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Book request not found.'
      });
    }

    if (request.status === 'Issued') {
      return res.status(400).json({
        success: false,
        message: 'This book request has already been physically issued.'
      });
    }

    if (action === 'REJECT') {
      await db.prepare(`
        UPDATE book_requests
        SET status = 'Rejected', processed_by = ?, processed_at = datetime('now'), rejection_reason = ?
        WHERE id = ?
      `).run(librarianId, rejection_reason ? rejection_reason.trim() : 'Declined by Librarian', id);

      return res.status(200).json({
        success: true,
        message: `Book request #${id} for "${request.book_title}" has been rejected.`
      });
    }

    if (action === 'APPROVE') {
      await db.prepare(`
        UPDATE book_requests
        SET status = 'Approved', processed_by = ?, processed_at = datetime('now')
        WHERE id = ?
      `).run(librarianId, id);

      return res.status(200).json({
        success: true,
        message: `Book request #${id} for "${request.book_title}" has been approved for collection.`
      });
    }

    if (action === 'ISSUE') {
      // Check available copies
      if (request.available_copies <= 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot issue "${request.book_title}". No available copies remaining in library.`
        });
      }

      if (request.member_status === 'Suspended') {
        return res.status(400).json({
          success: false,
          message: `Cannot issue book: Member "${request.member_name}" is currently suspended.`
        });
      }

      const today = new Date().toISOString().split('T')[0];
      let finalDueDate = due_date;
      if (!finalDueDate) {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        finalDueDate = d.toISOString().split('T')[0];
      }

      // Generate loan code
      const maxLoan = await db.prepare('SELECT MAX(id) as max_id FROM loans').get();
      const nextLoanNum = (maxLoan?.max_id || 0) + 1;
      const year = new Date().getFullYear();
      const loanCode = `LN-${year}-${String(nextLoanNum).padStart(4, '0')}`;

      // Atomic Issue Transaction
      await db.exec('BEGIN TRANSACTION');
      try {
        const insertLoan = db.prepare(`
          INSERT INTO loans (loan_code, book_id, member_id, issue_date, due_date, return_date, status, fine_amount, fine_paid, notes)
          VALUES (?, ?, ?, ?, ?, NULL, 'Issued', 0, 0, ?)
        `);
        const loanResult = await insertLoan.run(
          loanCode,
          request.book_id,
          request.member_id,
          today,
          finalDueDate,
          notes ? notes.trim() : (request.notes ? `From Request: ${request.notes}` : 'Issued via Member Request')
        );

        const updateBook = db.prepare(`
          UPDATE books
          SET available_copies = available_copies - 1
          WHERE id = ? AND available_copies > 0
        `);
        const bookUpdateRes = await updateBook.run(request.book_id);
        if (bookUpdateRes.changes === 0) {
          throw new Error('Failed to reserve book copy. No available copies.');
        }

        await db.prepare(`
          UPDATE book_requests
          SET status = 'Issued', processed_by = ?, processed_at = datetime('now')
          WHERE id = ?
        `).run(librarianId, id);

        await db.exec('COMMIT');

        const createdLoan = await db.prepare('SELECT * FROM loans WHERE id = ?').get(loanResult.lastInsertRowid);

        return res.status(200).json({
          success: true,
          message: `Book "${request.book_title}" physically issued successfully to ${request.member_name}. Loan Code: ${loanCode}`,
          data: createdLoan
        });
      } catch (txErr) {
        await db.exec('ROLLBACK');
        throw txErr;
      }
    }
  } catch (error) {
    console.error('actionMemberRequest error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process member request action.'
    });
  }
}

/**
 * Get Dynamic Notifications for Authenticated User
 */
async function getMemberNotifications(req, res) {
  try {
    const user = req.user;
    const today = new Date().toISOString().split('T')[0];
    const notificationsList = [];

    if (user.role === 'Member') {
      const memberId = user.id;

      // 1. Book Request updates
      const requests = await db.prepare(`
        SELECT r.*, b.title as book_title
        FROM book_requests r
        JOIN books b ON r.book_id = b.id
        WHERE r.member_id = ?
        ORDER BY r.request_date DESC LIMIT 10
      `).all(memberId);

      for (const r of requests) {
        if (r.status === 'Pending') {
          notificationsList.push({
            id: `req-pen-${r.id}`,
            type: 'request_pending',
            icon: '⏳',
            title: 'Book Request Pending',
            message: `Your request for "${r.book_title}" has been submitted and is awaiting Librarian review.`,
            date: r.request_date,
            status: 'Pending'
          });
        } else if (r.status === 'Approved') {
          notificationsList.push({
            id: `req-app-${r.id}`,
            type: 'request_approved',
            icon: '✅',
            title: 'Book Request Approved!',
            message: `Your request for "${r.book_title}" was approved! Please visit the library desk to collect your book.`,
            date: r.processed_at || r.request_date,
            status: 'Approved'
          });
        } else if (r.status === 'Rejected') {
          notificationsList.push({
            id: `req-rej-${r.id}`,
            type: 'request_rejected',
            icon: '❌',
            title: 'Book Request Declined',
            message: `Your request for "${r.book_title}" could not be fulfilled (${r.rejection_reason || 'Unavailable'}).`,
            date: r.processed_at || r.request_date,
            status: 'Rejected'
          });
        } else if (r.status === 'Issued') {
          notificationsList.push({
            id: `req-iss-${r.id}`,
            type: 'book_issued',
            icon: '📖',
            title: 'Book Issued to You',
            message: `"${r.book_title}" has been physically issued to your library account.`,
            date: r.processed_at || r.request_date,
            status: 'Issued'
          });
        }
      }

      // 2. Active Loans & Due Date alerts
      const activeLoans = await db.prepare(`
        SELECT l.*, b.title as book_title
        FROM loans l
        JOIN books b ON l.book_id = b.id
        WHERE l.member_id = ? AND l.return_date IS NULL
      `).all(memberId);

      for (const l of activeLoans) {
        const { daysOverdue } = calculateOverdueFine(l.due_date);
        if (daysOverdue > 0) {
          notificationsList.push({
            id: `loan-overdue-${l.id}`,
            type: 'book_overdue',
            icon: '⚠️',
            title: 'Book Overdue Alert',
            message: `"${l.book_title}" was due on ${l.due_date} (${daysOverdue} days ago). Please return it to avoid additional overdue fines.`,
            date: l.due_date,
            is_urgent: true
          });
        } else {
          const dueD = new Date(l.due_date);
          const nowD = new Date(today);
          const diffDays = Math.ceil((dueD - nowD) / (1000 * 60 * 60 * 24));
          if (diffDays <= 3 && diffDays >= 0) {
            notificationsList.push({
              id: `loan-duesoon-${l.id}`,
              type: 'book_due_soon',
              icon: '⏰',
              title: 'Due Date Approaching',
              message: `"${l.book_title}" is due in ${diffDays === 0 ? 'today' : `${diffDays} day(s)`} (${l.due_date}).`,
              date: l.due_date
            });
          }
        }
      }

      // 3. Unpaid Fines
      const unpaidFines = await db.prepare(`
        SELECT f.*, b.title as book_title
        FROM fines f
        JOIN loans l ON f.loan_id = l.id
        JOIN books b ON l.book_id = b.id
        WHERE f.member_id = ? AND f.status = 'Unpaid'
      `).all(memberId);

      for (const f of unpaidFines) {
        notificationsList.push({
          id: `fine-${f.id}`,
          type: 'fine_unpaid',
          icon: '💰',
          title: 'Outstanding Fine Due',
          message: `Fine of ₹${f.amount} pending for overdue loan of "${f.book_title}".`,
          date: f.created_at
        });
      }
    } else {
      // Librarian Notifications (Pending requests and overdue books count)
      const pendingCount = await db.prepare("SELECT COUNT(*) as count FROM book_requests WHERE status = 'Pending'").get();
      if (pendingCount && pendingCount.count > 0) {
        notificationsList.push({
          id: 'librarian-pending-reqs',
          type: 'pending_requests',
          icon: '📥',
          title: 'New Member Book Requests',
          message: `There are ${pendingCount.count} pending book request(s) waiting for review.`,
          date: new Date().toISOString()
        });
      }

      const overdueCount = await db.prepare("SELECT COUNT(*) as count FROM loans WHERE return_date IS NULL AND due_date < ?").get(today);
      if (overdueCount && overdueCount.count > 0) {
        notificationsList.push({
          id: 'librarian-overdue-loans',
          type: 'overdue_summary',
          icon: '⚠️',
          title: 'Overdue Books in Circulation',
          message: `There are currently ${overdueCount.count} overdue book loan(s) in circulation.`,
          date: new Date().toISOString()
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: notificationsList
    });
  } catch (error) {
    console.error('getMemberNotifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.'
    });
  }
}

module.exports = {
  issueBook,
  returnBook,
  getActiveLoans,
  getOverdueLoans,
  settleFine,
  memberPayFine,
  requestBook,
  getMyRequests,
  getMyLoans,
  getMemberRequests,
  actionMemberRequest,
  getMemberNotifications
};


