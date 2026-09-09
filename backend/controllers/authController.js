const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { db } = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Record event in audit log
 */
async function logAudit(userId, action, result, details = null, ipAddress = null) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, result, details, ip_address, timestamp)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(userId || null, action, result, details ? String(details) : null, ipAddress || null);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

/**
 * Handle Unified Login (Librarian, Admin, or Member)
 */
async function login(req, res) {
  try {
    const { email, password, login_type = 'librarian' } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Try Librarian/Admin Login first if requested or by default
    if (login_type === 'librarian' || login_type === 'all' || login_type === 'admin') {
      const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(trimmedEmail);

      if (user && user.password_hash && typeof user.password_hash === 'string') {
        const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
        if (isPasswordValid) {
          const payload = {
            id: user.id,
            name: user.name,
            role: user.role || 'Librarian',
            email: user.email
          };

          const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

          await logAudit(user.id, 'LOGIN', 'SUCCESS', `User ${user.name} logged in from ${clientIp}`, clientIp);

          return res.status(200).json({
            success: true,
            message: `Login successful. Welcome back, ${user.role} ${user.name}!`,
            token,
            user: {
              id: user.id,
              name: user.name,
              role: user.role || 'Librarian',
              email: user.email,
              phone: user.phone,
              created_at: user.created_at
            }
          });
        }
      }
    }

    // 2. Try Member Login
    const member = await db.prepare('SELECT * FROM members WHERE LOWER(email) = ?').get(trimmedEmail);
    if (member) {
      if (member.status === 'Suspended') {
        await logAudit(member.id, 'LOGIN', 'BLOCKED', `Suspended member ${member.full_name} attempt`, clientIp);
        return res.status(403).json({
          success: false,
          message: 'Your library membership account is currently suspended. Please contact the Librarian.'
        });
      }

      // Check member password
      let isValidMemberPass = false;
      if (member.password_hash && typeof member.password_hash === 'string') {
        isValidMemberPass = bcrypt.compareSync(password, member.password_hash);
      } else if (password === 'Member@123') {
        isValidMemberPass = true;
      }

      if (isValidMemberPass) {
        const payload = {
          id: member.id,
          name: member.full_name,
          role: 'Member',
          email: member.email,
          member_code: member.member_code
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        await logAudit(member.id, 'LOGIN', 'SUCCESS', `Member ${member.full_name} (${member.member_code}) logged in`, clientIp);

        return res.status(200).json({
          success: true,
          message: `Login successful. Welcome, ${member.full_name}!`,
          token,
          user: {
            id: member.id,
            name: member.full_name,
            role: 'Member',
            email: member.email,
            member_code: member.member_code,
            phone: member.phone,
            membership_date: member.membership_date,
            status: member.status
          }
        });
      }
    }

    await logAudit(null, 'LOGIN', 'FAILED', `Failed login attempt for email: ${trimmedEmail}`, clientIp);

    return res.status(401).json({
      success: false,
      message: 'Invalid email address or password.'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during login. Please try again.'
    });
  }
}

/**
 * Request Admin Login Approval (Multi-Admin Authorization)
 */
async function requestAdminLogin(req, res) {
  try {
    const { email, password, device_info } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(trimmedEmail);

    if (!user || !user.password_hash || typeof user.password_hash !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      await logAudit(user.id, 'ADMIN_LOGIN_REQUEST', 'FAILED', `Invalid password from ${clientIp}`, clientIp);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate secure 32-byte hex token
    const requestToken = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    const insertRequest = db.prepare(`
      INSERT INTO admin_approval_requests (
        user_id, status, request_token, device_info, requested_at, expires_at, created_at, updated_at
      ) VALUES (?, 'PENDING', ?, ?, datetime('now'), ?, datetime('now'), datetime('now'))
    `);

    const result = await insertRequest.run(user.id, requestToken, device_info || 'Unknown Device', expiryDate);

    await logAudit(user.id, 'ADMIN_LOGIN_REQUEST', 'PENDING', `Approval request #${result.lastInsertRowid} created for ${user.name}`, clientIp);

    return res.status(200).json({
      success: true,
      approval_required: true,
      request_id: Number(result.lastInsertRowid),
      request_token: requestToken,
      expires_at: expiryDate,
      expires_in_seconds: 300,
      message: 'Admin approval request generated. Awaiting confirmation from active administrator.'
    });
  } catch (error) {
    console.error('requestAdminLogin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin login request.'
    });
  }
}

/**
 * Check Admin Approval Status (Polling by Client)
 */
async function checkAdminApprovalStatus(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Request token is required.'
      });
    }

    const request = await db.prepare(`
      SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role, u.phone as user_phone
      FROM admin_approval_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.request_token = ?
    `).get(token);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found.'
      });
    }

    // Check expiration if still pending
    const now = new Date();
    const expiresAt = new Date(request.expires_at);

    if (request.status === 'PENDING' && now > expiresAt) {
      await db.prepare("UPDATE admin_approval_requests SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(request.id);
      request.status = 'EXPIRED';
      await logAudit(request.user_id, 'ADMIN_APPROVAL', 'EXPIRED', `Approval request #${request.id} expired`);
    }

    if (request.status === 'APPROVED') {
      const payload = {
        id: request.user_id,
        name: request.user_name,
        role: request.user_role || 'Librarian',
        email: request.user_email
      };
      const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      return res.status(200).json({
        success: true,
        status: 'APPROVED',
        token: jwtToken,
        user: {
          id: request.user_id,
          name: request.user_name,
          role: request.user_role || 'Librarian',
          email: request.user_email,
          phone: request.user_phone
        },
        message: 'Admin access approved!'
      });
    }

    return res.status(200).json({
      success: true,
      status: request.status,
      message: `Approval request is currently ${request.status}.`
    });
  } catch (error) {
    console.error('checkAdminApprovalStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify approval status.'
    });
  }
}

/**
 * List Pending Admin Requests (For Active Admin)
 */
async function getPendingAdminRequests(req, res) {
  try {
    // Expire old requests
    await db.prepare("UPDATE admin_approval_requests SET status = 'EXPIRED', updated_at = datetime('now') WHERE status = 'PENDING' AND expires_at < datetime('now')").run();

    const pendingRequests = await db.prepare(`
      SELECT r.id, r.user_id, r.status, r.device_info, r.requested_at, r.expires_at,
             u.name as user_name, u.email as user_email, u.role as user_role
      FROM admin_approval_requests r
      JOIN users u ON r.user_id = u.id
      WHERE r.status = 'PENDING'
      ORDER BY r.requested_at DESC
    `).all();

    return res.status(200).json({
      success: true,
      data: pendingRequests
    });
  } catch (error) {
    console.error('getPendingAdminRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve admin requests.'
    });
  }
}

/**
 * Approve or Reject Admin Login Request
 */
async function actionAdminRequest(req, res) {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const adminId = req.user.id;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either APPROVE or REJECT.'
      });
    }

    const request = await db.prepare('SELECT * FROM admin_approval_requests WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Approval request not found.'
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Request is already ${request.status} and cannot be modified.`
      });
    }

    if (new Date() > new Date(request.expires_at)) {
      await db.prepare("UPDATE admin_approval_requests SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(id);
      return res.status(400).json({
        success: false,
        message: 'This approval request has expired (5-minute limit).'
      });
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    if (action === 'APPROVE') {
      await db.prepare(`
        UPDATE admin_approval_requests 
        SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(adminId, id);
      await logAudit(request.user_id, 'ADMIN_APPROVAL', 'APPROVED', `Approved by Admin ID ${adminId}`, clientIp);
    } else {
      await db.prepare(`
        UPDATE admin_approval_requests 
        SET status = 'REJECTED', rejected_by = ?, rejected_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(adminId, id);
      await logAudit(request.user_id, 'ADMIN_APPROVAL', 'REJECTED', `Rejected by Admin ID ${adminId}`, clientIp);
    }

    return res.status(200).json({
      success: true,
      message: `Admin login request #${id} has been ${newStatus}.`
    });
  } catch (error) {
    console.error('actionAdminRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process admin approval action.'
    });
  }
}

/**
 * Retrieve Audit Logs
 */
async function getAuditLogs(req, res) {
  try {
    const { page = 1, limit = 50, action } = req.query;
    let query = `
      SELECT a.*, u.name as user_name, u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countRow = await db.prepare(countQuery).get(...params);
    const totalCount = countRow ? Number(countRow.total || 0) : 0;

    query += ' ORDER BY a.timestamp DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const logs = await db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs.'
    });
  }
}

/**
 * Get current authenticated user profile
 */
async function getMe(req, res) {
  try {
    if (req.user.role === 'Member') {
      const member = await db.prepare('SELECT id, member_code, full_name as name, email, phone, address, membership_date, status, created_at FROM members WHERE id = ?').get(req.user.id);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found.' });
      }
      return res.status(200).json({
        success: true,
        user: { ...member, role: 'Member' }
      });
    }

    // Default: Librarian/Admin
    const user = await db.prepare('SELECT id, name, role, email, phone, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        role: user.role || 'Librarian'
      }
    });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile details.'
    });
  }
}

/**
 * Update Profile Information
 */
async function updateProfile(req, res) {
  try {
    const { name, phone, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required.'
      });
    }

    if (req.user.role === 'Member') {
      await db.prepare(`
        UPDATE members 
        SET full_name = ?, phone = ?, address = ? 
        WHERE id = ?
      `).run(name.trim(), phone ? phone.trim() : null, address ? address.trim() : null, req.user.id);

      const updated = await db.prepare('SELECT id, member_code, full_name as name, email, phone, address, status FROM members WHERE id = ?').get(req.user.id);
      await logAudit(req.user.id, 'PROFILE_UPDATE', 'SUCCESS', `Member profile updated`);
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        user: { ...updated, role: 'Member' }
      });
    }

    await db.prepare(`
      UPDATE users 
      SET name = ?, phone = ? 
      WHERE id = ?
    `).run(name.trim(), phone ? phone.trim() : null, req.user.id);

    const updatedUser = await db.prepare('SELECT id, name, role, email, phone, created_at FROM users WHERE id = ?').get(req.user.id);
    await logAudit(req.user.id, 'PROFILE_UPDATE', 'SUCCESS', `User profile updated`);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
}

/**
 * Change Password
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    if (confirm_password && new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);

    if (req.user.role === 'Member') {
      const member = await db.prepare('SELECT password_hash FROM members WHERE id = ?').get(req.user.id);
      if (!member) return res.status(404).json({ success: false, message: 'Member not found.' });

      const isMatch = (member.password_hash && typeof member.password_hash === 'string') 
        ? bcrypt.compareSync(current_password, member.password_hash) 
        : (current_password === 'Member@123');
      if (!isMatch) {
        await logAudit(req.user.id, 'PASSWORD_CHANGE', 'FAILED', 'Incorrect current password');
        return res.status(400).json({ success: false, message: 'Incorrect current password.' });
      }

      await db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
      await logAudit(req.user.id, 'PASSWORD_CHANGE', 'SUCCESS', 'Member password changed');
      return res.status(200).json({ success: true, message: 'Password changed successfully.' });
    }

    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.password_hash || typeof user.password_hash !== 'string') {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = bcrypt.compareSync(current_password, user.password_hash);
    if (!isMatch) {
      await logAudit(req.user.id, 'PASSWORD_CHANGE', 'FAILED', 'Incorrect current password');
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.'
      });
    }

    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    await logAudit(req.user.id, 'PASSWORD_CHANGE', 'SUCCESS', 'User password changed');

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password.'
    });
  }
}

/**
 * Logout
 */
async function logout(req, res) {
  const userId = req.user ? req.user.id : null;
  await logAudit(userId, 'LOGOUT', 'SUCCESS', 'User logged out');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}

module.exports = {
  login,
  requestAdminLogin,
  checkAdminApprovalStatus,
  getPendingAdminRequests,
  actionAdminRequest,
  getAuditLogs,
  getMe,
  updateProfile,
  changePassword,
  logout,
  logAudit
};

