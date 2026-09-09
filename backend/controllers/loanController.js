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

module.exports = {
  issueBook,
  returnBook,
  getActiveLoans,
  getOverdueLoans,
  settleFine
};

