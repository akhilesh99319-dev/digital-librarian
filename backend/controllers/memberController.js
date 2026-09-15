const { db } = require('../database/db');

/**
 * Get all members with search, status filtering, and loan counts
 */
async function getAllMembers(req, res) {
  try {
    if (req.user && req.user.role === 'Member') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Administrator or Librarian privileges required.'
      });
    }

    const { search, status, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        m.id,
        m.member_code,
        m.full_name,
        m.email,
        m.phone,
        m.address,
        m.membership_date,
        m.status,
        m.created_at,
        COUNT(CASE WHEN l.return_date IS NULL THEN 1 END) as active_loans_count,
        COUNT(CASE WHEN l.status = 'Overdue' OR (l.return_date IS NULL AND l.due_date < date('now')) THEN 1 END) as overdue_loans_count,
        COALESCE(SUM(CASE WHEN f.status = 'Unpaid' THEN f.amount ELSE 0 END), 0) as pending_fines_amount
      FROM members m
      LEFT JOIN loans l ON m.id = l.member_id
      LEFT JOIN fines f ON m.id = f.member_id
      WHERE 1=1
    `;

    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (m.full_name LIKE ? OR m.email LIKE ? OR m.member_code LIKE ? OR m.phone LIKE ? OR m.address LIKE ?)`;
      params.push(s, s, s, s, s);
    }

    if (status) {
      query += ` AND m.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY m.id, m.member_code, m.full_name, m.email, m.phone, m.address, m.membership_date, m.status, m.created_at`;

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) AS count_subquery`;
    const countRow = await db.prepare(countQuery).get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ` ORDER BY m.id DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const members = await db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      data: members,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAllMembers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve members list.'
    });
  }
}

/**
 * Get Member by ID with complete loan and fine history
 */
async function getMemberById(req, res) {
  try {
    const { id } = req.params;

    if (req.user && req.user.role === 'Member' && parseInt(req.user.id) !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. You can only view your own membership account.'
      });
    }

    const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    // Get active loans
    const activeLoans = await db.prepare(`
      SELECT 
        l.id,
        l.loan_code,
        l.book_id,
        b.title as book_title,
        b.book_code,
        b.isbn,
        l.issue_date,
        l.due_date,
        l.status,
        l.fine_amount
      FROM loans l
      JOIN books b ON l.book_id = b.id
      WHERE l.member_id = ? AND l.return_date IS NULL
      ORDER BY l.due_date ASC
    `).all(id);

    // Get past returned loans
    const loanHistory = await db.prepare(`
      SELECT 
        l.id,
        l.loan_code,
        l.book_id,
        b.title as book_title,
        b.book_code,
        l.issue_date,
        l.due_date,
        l.return_date,
        l.status,
        l.fine_amount,
        l.fine_paid
      FROM loans l
      JOIN books b ON l.book_id = b.id
      WHERE l.member_id = ? AND l.return_date IS NOT NULL
      ORDER BY l.return_date DESC
      LIMIT 15
    `).all(id);

    // Get fines
    const fines = await db.prepare(`
      SELECT 
        f.id,
        f.loan_id,
        l.loan_code,
        f.days_overdue,
        f.amount,
        f.status,
        f.payment_date,
        f.created_at
      FROM fines f
      LEFT JOIN loans l ON f.loan_id = l.id
      WHERE f.member_id = ?
      ORDER BY f.id DESC
    `).all(id);

    return res.status(200).json({
      success: true,
      data: {
        ...member,
        active_loans: activeLoans,
        loan_history: loanHistory,
        fines
      }
    });
  } catch (error) {
    console.error('getMemberById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve member details.'
    });
  }
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Create a new member
 */
async function createMember(req, res) {
  try {
    const { full_name, email, phone, address, membership_date, status = 'Active' } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone number are required.'
      });
    }

    let trimmedEmail = null;
    if (email && email.trim()) {
      trimmedEmail = email.trim().toLowerCase();
      if (!isValidEmail(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address (e.g. name@example.com).'
        });
      }

      // Check duplicate email
      const existing = await db.prepare('SELECT id FROM members WHERE LOWER(email) = ?').get(trimmedEmail);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'This email address is already assigned to another member.'
        });
      }
    }

    // Generate unique member code (e.g. MEM-009)
    const maxIdRow = await db.prepare('SELECT MAX(id) as max_id FROM members').get();
    const nextNum = (maxIdRow?.max_id || 0) + 1;
    const memberCode = `MEM-${String(nextNum).padStart(3, '0')}`;

    const memDate = membership_date || new Date().toISOString().split('T')[0];

    const result = await db.prepare(`
      INSERT INTO members (member_code, full_name, email, phone, address, membership_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      memberCode,
      full_name.trim(),
      trimmedEmail,
      phone.trim(),
      address ? address.trim() : null,
      memDate,
      status
    );

    const newMember = await db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Member registered successfully.',
      data: newMember
    });
  } catch (error) {
    console.error('createMember error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register member.'
    });
  }
}

/**
 * Update member information
 */
async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const { full_name, email, phone, address, membership_date, status } = req.body;

    const existing = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    const finalName = full_name !== undefined ? full_name.trim() : existing.full_name;
    const finalPhone = phone !== undefined ? phone.trim() : existing.phone;

    if (!finalName || !finalPhone) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone number are required.'
      });
    }

    let trimmedEmail = existing.email;
    if (email !== undefined) {
      if (email && email.toString().trim()) {
        trimmedEmail = email.toString().trim().toLowerCase();
        if (!isValidEmail(trimmedEmail)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address (e.g. name@example.com).'
          });
        }

        // Check duplicate email on another member
        const dup = await db.prepare('SELECT id FROM members WHERE LOWER(email) = ? AND id != ?').get(trimmedEmail, id);
        if (dup) {
          return res.status(400).json({
            success: false,
            message: 'This email address is already assigned to another member.'
          });
        }
      } else {
        trimmedEmail = null;
      }
    }

    const finalAddress = address !== undefined ? (address ? address.trim() : null) : existing.address;
    const finalDate = membership_date || existing.membership_date;
    const finalStatus = status || existing.status;

    await db.prepare(`
      UPDATE members
      SET 
        full_name = ?,
        email = ?,
        phone = ?,
        address = ?,
        membership_date = ?,
        status = ?
      WHERE id = ?
    `).run(
      finalName,
      trimmedEmail,
      finalPhone,
      finalAddress,
      finalDate,
      finalStatus,
      id
    );

    const updated = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      message: 'Member information updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('updateMember error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update member.'
    });
  }
}

/**
 * Update member Gmail / Email Address (Librarian Action)
 */
async function updateMemberEmail(req, res) {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    let trimmedEmail = null;
    if (email !== undefined && email !== null && email.toString().trim() !== '') {
      trimmedEmail = email.toString().trim().toLowerCase();
      if (!isValidEmail(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address (e.g. name@example.com).'
        });
      }

      // Check duplicate email on another member
      const dup = await db.prepare('SELECT id FROM members WHERE LOWER(email) = ? AND id != ?').get(trimmedEmail, id);
      if (dup) {
        return res.status(400).json({
          success: false,
          message: 'This email address is already assigned to another member.'
        });
      }
    }

    await db.prepare('UPDATE members SET email = ? WHERE id = ?').run(trimmedEmail, id);

    const updatedMember = await db.prepare('SELECT id, member_code, full_name, email, phone, address, membership_date, status, created_at FROM members WHERE id = ?').get(id);

    const successMsg = trimmedEmail 
      ? 'Member email updated successfully.'
      : 'Member email cleared successfully.';

    return res.status(200).json({
      success: true,
      message: successMsg,
      data: updatedMember
    });
  } catch (error) {
    console.error('updateMemberEmail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update member email.'
    });
  }
}

/**
 * Delete a member
 */
async function deleteMember(req, res) {
  try {
    const { id } = req.params;

    const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.'
      });
    }

    // Check active loans
    const activeLoan = await db.prepare('SELECT id FROM loans WHERE member_id = ? AND return_date IS NULL LIMIT 1').get(id);
    if (activeLoan) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete member "${member.full_name}" because they have books currently checked out. Please return all books first.`
      });
    }

    // Check unpaid fines
    const unpaidFine = await db.prepare("SELECT id FROM fines WHERE member_id = ? AND status = 'Unpaid' LIMIT 1").get(id);
    if (unpaidFine) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete member "${member.full_name}" due to outstanding unpaid fines.`
      });
    }

    // Clean up past loans and fines
    await db.prepare('DELETE FROM fines WHERE member_id = ?').run(id);
    await db.prepare('DELETE FROM loans WHERE member_id = ?').run(id);
    await db.prepare('DELETE FROM members WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      message: `Member "${member.full_name}" was deleted successfully.`
    });
  } catch (error) {
    console.error('deleteMember error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete member.'
    });
  }
}

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  updateMemberEmail,
  deleteMember
};

