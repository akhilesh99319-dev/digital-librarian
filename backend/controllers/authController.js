const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { db } = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');
const { generateOTP, maskEmail, sendOTPEmail } = require('../utils/emailService');
const { verifyGoogleIdToken } = require('../utils/googleAuth');
const { checkResendCooldown, recordOtpIssued } = require('../middleware/rateLimiter');

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
 * Helper: Validate email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Handle Unified Login Step 1: Validate Credentials & Issue OTP
 * (Supports Librarian, Admin, or Member via Email or Member Code)
 */
async function login(req, res) {
  try {
    const { email, password, login_type = 'all' } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email/member code and password.'
      });
    }

    const trimmedIdentifier = String(email).trim().toLowerCase();
    let account = null;
    let accountType = null;

    // Registered Librarian / Admin account lookup.
    if (login_type === 'librarian' || login_type === 'admin' || login_type === 'all') {
      const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(trimmedIdentifier);
      if (user && user.password_hash && typeof user.password_hash === 'string') {
        if (bcrypt.compareSync(password, user.password_hash)) {
          account = user;
          accountType = 'user';
        }
      }
    }

    // Registered Member account lookup by email or member code.
    if (!account) {
      const member = await db.prepare(`
        SELECT * FROM members
        WHERE (email IS NOT NULL AND LOWER(email) = ?)
           OR LOWER(member_code) = ?
      `).get(trimmedIdentifier, trimmedIdentifier);

      if (member) {
        if (member.status === 'Suspended') {
          await logAudit(member.id, 'LOGIN', 'BLOCKED', `Suspended member ${member.full_name} attempt`, clientIp);
          return res.status(403).json({
            success: false,
            message: 'Your library membership account is currently suspended. Please contact the Librarian.'
          });
        }

        let isPassMatch = false;
        if (member.password_hash && typeof member.password_hash === 'string') {
          isPassMatch = bcrypt.compareSync(password, member.password_hash);
        } else if (password === 'Member@123') {
          isPassMatch = true;
        }

        if (isPassMatch) {
          account = member;
          accountType = 'member';
        }
      }
    }

    // No matching registered account or password: reject the login.
    if (!account) {
      await logAudit(null, 'LOGIN', 'FAILED', `Failed credentials attempt for: ${trimmedIdentifier}`, clientIp);
      return res.status(401).json({
        success: false,
        message: 'Invalid email/member code or password.'
      });
    }

    // Issue the normal application JWT immediately. Login does not require OTP.
    const payload = accountType === 'member'
      ? {
          id: account.id,
          name: account.full_name,
          role: 'Member',
          email: account.email,
          member_code: account.member_code
        }
      : {
          id: account.id,
          name: account.name,
          role: account.role || 'Librarian',
          email: account.email
        };

    const userObj = accountType === 'member'
      ? {
          id: account.id,
          name: account.full_name,
          role: 'Member',
          email: account.email,
          member_code: account.member_code,
          phone: account.phone,
          membership_date: account.membership_date,
          status: account.status
        }
      : {
          id: account.id,
          name: account.name,
          role: account.role || 'Librarian',
          email: account.email,
          phone: account.phone,
          created_at: account.created_at
        };

    const authToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    await logAudit(
      payload.id,
      'LOGIN',
      'SUCCESS',
      `User ${payload.name} (${payload.role}) authenticated with email/member code and password from ${clientIp}`,
      clientIp
    );

    return res.status(200).json({
      success: true,
      otp_required: false,
      message: `Login successful. Welcome back, ${payload.name}!`,
      token: authToken,
      user: userObj
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred during authentication. Please try again.'
    });
  }
}
/**
 * Handle Login OTP Verification & Session Issuance
 */
async function verifyLoginOtp(req, res) {
  try {
    const { temp_token, otp } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!temp_token || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Verification token and 6-digit code are required.'
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'The verification code must be exactly 6 digits.'
      });
    }

    // Verify temp_token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.purpose !== 'OTP_VERIFY' || decoded.otp_type !== 'LOGIN') {
        throw new Error('Invalid token purpose');
      }
    } catch (tokenErr) {
      return res.status(400).json({
        success: false,
        message: 'Verification session has expired or is invalid. Please sign in again.'
      });
    }

    const email = decoded.email.toLowerCase();

    // Retrieve active OTP record
    const otpRecord = await db.prepare(`
      SELECT * FROM auth_otps 
      WHERE LOWER(email) = ? AND otp_type = 'LOGIN' AND verified = 0 
      ORDER BY id DESC LIMIT 1
    `).get(email);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'The verification code is incorrect or expired.'
      });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = new Date(otpRecord.expires_at);
    if (now > expiresAt) {
      await db.prepare('UPDATE auth_otps SET verified = 2 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new code.'
      });
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await db.prepare('UPDATE auth_otps SET verified = 2 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. This verification code has been invalidated. Please request a new code.'
      });
    }

    // Verify OTP against bcrypt hash
    const isOtpValid = bcrypt.compareSync(cleanOtp, otpRecord.otp_hash);
    if (!isOtpValid) {
      await db.prepare('UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      await logAudit(decoded.user_id, 'LOGIN_OTP_VERIFY', 'FAILED', `Invalid OTP attempt from ${clientIp}`, clientIp);
      return res.status(400).json({
        success: false,
        message: 'The verification code is incorrect or expired.'
      });
    }

    // Invalidate OTP (single-use)
    await db.prepare('UPDATE auth_otps SET verified = 1 WHERE id = ?').run(otpRecord.id);

    // Retrieve authoritative account data
    let userObj = null;
    let payload = null;

    if (decoded.user_type === 'member') {
      const member = await db.prepare('SELECT * FROM members WHERE id = ?').get(decoded.user_id);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member account not found.' });
      }

      payload = {
        id: member.id,
        name: member.full_name,
        role: 'Member',
        email: member.email,
        member_code: member.member_code
      };

      userObj = {
        id: member.id,
        name: member.full_name,
        role: 'Member',
        email: member.email,
        member_code: member.member_code,
        phone: member.phone,
        membership_date: member.membership_date,
        status: member.status
      };
    } else {
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.user_id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      payload = {
        id: user.id,
        name: user.name,
        role: user.role || 'Librarian',
        email: user.email
      };

      userObj = {
        id: user.id,
        name: user.name,
        role: user.role || 'Librarian',
        email: user.email,
        phone: user.phone,
        created_at: user.created_at
      };
    }

    // Issue authoritative JWT
    const authToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    await logAudit(payload.id, 'LOGIN', 'SUCCESS', `User ${payload.name} (${payload.role}) authenticated via Email OTP from ${clientIp}`, clientIp);

    return res.status(200).json({
      success: true,
      message: `Login successful. Welcome back, ${payload.name}!`,
      token: authToken,
      user: userObj
    });
  } catch (error) {
    console.error('verifyLoginOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify verification code.'
    });
  }
}

/**
 * Handle Resending OTP with Rate-Limit & Cooldown
 */
async function resendOtp(req, res) {
  try {
    const { temp_token } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!temp_token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.purpose !== 'OTP_VERIFY') {
        throw new Error('Invalid token purpose');
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Verification session has expired. Please restart the authentication process.'
      });
    }

    const email = decoded.email.toLowerCase();

    // Check cooldown & limits
    const cooldownCheck = checkResendCooldown(email, 45, 3);
    if (!cooldownCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: cooldownCheck.reason
      });
    }

    // Find active OTP record
    const activeOtp = await db.prepare(`
      SELECT * FROM auth_otps 
      WHERE LOWER(email) = ? AND otp_type = ? AND verified = 0 
      ORDER BY id DESC LIMIT 1
    `).get(email, decoded.otp_type);

    if (!activeOtp) {
      return res.status(400).json({
        success: false,
        message: 'No active verification session found. Please start over.'
      });
    }

    // Generate new 6-digit OTP
    const newOtp = generateOTP();
    const newOtpHash = bcrypt.hashSync(newOtp, 10);
    const newExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Update OTP record
    await db.prepare(`
      UPDATE auth_otps 
      SET otp_hash = ?, attempts = 0, resend_count = resend_count + 1, last_sent_at = datetime('now'), expires_at = ? 
      WHERE id = ?
    `).run(newOtpHash, newExpiresAt, activeOtp.id);

    // Send new OTP email
    let recipientName = 'User';
    if (activeOtp.metadata) {
      try {
        const meta = JSON.parse(activeOtp.metadata);
        recipientName = meta.name || 'User';
      } catch (_) {}
    }

    await sendOTPEmail(email, newOtp, decoded.otp_type, recipientName);
    await logAudit(decoded.user_id || null, 'OTP_RESEND', 'SUCCESS', `Resent ${decoded.otp_type} OTP to ${maskEmail(email)}`, clientIp);

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (error) {
    console.error('resendOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend verification code. Please try again.'
    });
  }
}

/**
 * Handle Public Member Registration Step 1: Validate Fields & Issue Registration OTP
 */
async function register(req, res) {
  try {
    const { name, full_name, email, password, confirm_password, confirmPassword, phone, address } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const rawName = name || full_name;
    if (!rawName || typeof rawName !== 'string' || rawName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required (at least 2 characters).'
      });
    }

    const trimmedName = rawName.trim();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const confirmPass = confirm_password !== undefined ? confirm_password : confirmPassword;
    if (confirmPass !== undefined && confirmPass !== password) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.'
      });
    }

    // Check duplicate email across both users and members.
    const existingUser = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(trimmedEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    const existingMember = await db.prepare('SELECT id FROM members WHERE LOWER(email) = ?').get(trimmedEmail);
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Store the password securely with bcrypt.
    const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    const sanitizedPhone = phone && typeof phone === 'string' ? phone.trim() : '';
    const sanitizedAddress = address && typeof address === 'string' ? address.trim() : '';

    // Generate the next unique member code.
    const maxIdRow = await db.prepare('SELECT MAX(id) as max_id FROM members').get();
    let nextNum = (maxIdRow?.max_id || 0) + 1;
    let memberCode = `MEM-${String(nextNum).padStart(3, '0')}`;

    let codeExists = await db.prepare('SELECT id FROM members WHERE member_code = ?').get(memberCode);
    while (codeExists) {
      nextNum++;
      memberCode = `MEM-${String(nextNum).padStart(3, '0')}`;
      codeExists = await db.prepare('SELECT id FROM members WHERE member_code = ?').get(memberCode);
    }

    const memDate = new Date().toISOString().split('T')[0];

    // Registration is now direct: no email verification code is required.
    const insertStmt = db.prepare(`
      INSERT INTO members (member_code, full_name, email, password_hash, phone, address, membership_date, status, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', datetime('now'))
    `);

    const result = await insertStmt.run(
      memberCode,
      trimmedName,
      trimmedEmail,
      passwordHash,
      sanitizedPhone,
      sanitizedAddress,
      memDate
    );

    const newMemberId = Number(result.lastInsertRowid);

    await logAudit(
      newMemberId,
      'REGISTER',
      'SUCCESS',
      `New member registered directly: ${trimmedName} (${memberCode}, ${trimmedEmail})`,
      clientIp
    );

    return res.status(201).json({
      success: true,
      otp_required: false,
      message: 'Account created successfully! You can now sign in with your credentials.',
      user: {
        id: newMemberId,
        member_code: memberCode,
        name: trimmedName,
        email: trimmedEmail,
        role: 'Member',
        phone: sanitizedPhone,
        membership_date: memDate,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.'
    });
  }
}
/**
 * Handle Registration OTP Verification & Member Activation
 */
async function verifyRegisterOtp(req, res) {
  try {
    const { temp_token, otp } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!temp_token || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Verification token and 6-digit code are required.'
      });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'The verification code must be exactly 6 digits.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.purpose !== 'OTP_VERIFY' || decoded.otp_type !== 'REGISTER') {
        throw new Error('Invalid token purpose');
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Registration verification session has expired. Please register again.'
      });
    }

    const email = decoded.email.toLowerCase();

    // Fetch active registration OTP
    const otpRecord = await db.prepare(`
      SELECT * FROM auth_otps 
      WHERE LOWER(email) = ? AND otp_type = 'REGISTER' AND verified = 0 
      ORDER BY id DESC LIMIT 1
    `).get(email);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'The verification code is incorrect or expired.'
      });
    }

    // Check expiry
    const now = new Date();
    if (now > new Date(otpRecord.expires_at)) {
      await db.prepare('UPDATE auth_otps SET verified = 2 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'This verification code has expired. Please request a new code.'
      });
    }

    // Check attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await db.prepare('UPDATE auth_otps SET verified = 2 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. This code has been invalidated. Please register again.'
      });
    }

    // Verify code
    const isOtpValid = bcrypt.compareSync(cleanOtp, otpRecord.otp_hash);
    if (!isOtpValid) {
      await db.prepare('UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      return res.status(400).json({
        success: false,
        message: 'The verification code is incorrect or expired.'
      });
    }

    // Mark OTP as verified
    await db.prepare('UPDATE auth_otps SET verified = 1 WHERE id = ?').run(otpRecord.id);

    const metadata = JSON.parse(otpRecord.metadata || '{}');

    // Auto-generate next unique member code (e.g. MEM-009)
    const maxIdRow = await db.prepare('SELECT MAX(id) as max_id FROM members').get();
    let nextNum = (maxIdRow?.max_id || 0) + 1;
    let memberCode = `MEM-${String(nextNum).padStart(3, '0')}`;

    let codeExists = await db.prepare('SELECT id FROM members WHERE member_code = ?').get(memberCode);
    while (codeExists) {
      nextNum++;
      memberCode = `MEM-${String(nextNum).padStart(3, '0')}`;
      codeExists = await db.prepare('SELECT id FROM members WHERE member_code = ?').get(memberCode);
    }

    const memDate = new Date().toISOString().split('T')[0];

    // Insert verified member
    const insertStmt = db.prepare(`
      INSERT INTO members (member_code, full_name, email, password_hash, phone, address, membership_date, status, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', datetime('now'))
    `);

    const result = await insertStmt.run(
      memberCode,
      metadata.name,
      metadata.email,
      metadata.password_hash,
      metadata.phone || '',
      metadata.address || '',
      memDate
    );

    const newMemberId = result.lastInsertRowid;

    await logAudit(
      newMemberId,
      'REGISTER',
      'SUCCESS',
      `New member registered and email verified: ${metadata.name} (${memberCode}, ${metadata.email})`,
      clientIp
    );

    return res.status(201).json({
      success: true,
      message: 'Account verified and created successfully! You can now sign in with your credentials.',
      user: {
        id: Number(newMemberId),
        member_code: memberCode,
        name: metadata.name,
        email: metadata.email,
        role: 'Member',
        phone: metadata.phone || '',
        membership_date: memDate,
        status: 'Active'
      }
    });
  } catch (error) {
    console.error('verifyRegisterOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify registration code.'
    });
  }
}

/**
 * Handle Google Sign-In (OpenID Connect / Google ID Token Verification)
 */
async function googleLogin(req, res) {
  try {
    const { id_token } = req.body;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!id_token) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token credential is required.'
      });
    }

    // Authoritatively verify Google ID token with Google servers
    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(id_token);
    } catch (verErr) {
      await logAudit(null, 'GOOGLE_AUTH', 'FAILED', `Google token verification error: ${verErr.message}`, clientIp);
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed: ' + verErr.message
      });
    }

    const verifiedEmail = googlePayload.email.toLowerCase().trim();

    // 1. Check Librarian/Admin match
    const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(verifiedEmail);
    if (user) {
      // Link Google ID if not yet recorded
      if (!user.google_id) {
        await db.prepare("UPDATE users SET google_id = ?, google_email = ?, email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?")
          .run(googlePayload.sub, verifiedEmail, user.id);
      }

      const payload = {
        id: user.id,
        name: user.name,
        role: user.role || 'Librarian',
        email: user.email
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      await logAudit(user.id, 'LOGIN_GOOGLE', 'SUCCESS', `User ${user.name} logged in with Google identity`, clientIp);

      return res.status(200).json({
        success: true,
        message: `Google authentication successful. Welcome back, ${user.role} ${user.name}!`,
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

    // 2. Check Member match
    const member = await db.prepare('SELECT * FROM members WHERE email IS NOT NULL AND LOWER(email) = ?').get(verifiedEmail);
    if (member) {
      if (member.status === 'Suspended') {
        await logAudit(member.id, 'LOGIN_GOOGLE', 'BLOCKED', `Suspended member Google login attempt: ${member.full_name}`, clientIp);
        return res.status(403).json({
          success: false,
          message: 'Your library membership account is currently suspended. Please contact the Librarian.'
        });
      }

      // Link Google ID if not yet recorded
      if (!member.google_id) {
        await db.prepare("UPDATE members SET google_id = ?, google_email = ?, email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE id = ?")
          .run(googlePayload.sub, verifiedEmail, member.id);
      }

      const payload = {
        id: member.id,
        name: member.full_name,
        role: 'Member',
        email: member.email,
        member_code: member.member_code
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      await logAudit(member.id, 'LOGIN_GOOGLE', 'SUCCESS', `Member ${member.full_name} logged in with Google identity`, clientIp);

      return res.status(200).json({
        success: true,
        message: `Google authentication successful. Welcome, ${member.full_name}!`,
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

    // 3. No matching library account found -> Reject safely (NO auto-creation of unrestricted accounts)
    await logAudit(null, 'LOGIN_GOOGLE', 'UNAUTHORIZED', `Unregistered Google email attempt: ${verifiedEmail}`, clientIp);

    return res.status(403).json({
      success: false,
      message: 'No library account is associated with this Google account. Please register first or contact the library administrator.'
    });
  } catch (error) {
    console.error('googleLogin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to authenticate with Google identity.'
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

    const countQuery = `SELECT COUNT(*) as total FROM (${query}) AS count_subquery`;
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
    const userId = parseInt(req.user.id) || req.user.id;
    if (req.user.role === 'Member') {
      const member = await db.prepare('SELECT id, member_code, full_name, full_name as name, email, phone, address, membership_date, status, email_verified_at, created_at FROM members WHERE id = ?').get(userId);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found.' });
      }
      return res.status(200).json({
        success: true,
        user: { ...member, role: 'Member' }
      });
    }

    // Default: Librarian/Admin
    const user = await db.prepare('SELECT id, name, role, email, phone, email_verified_at, created_at FROM users WHERE id = ?').get(userId);
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
  verifyLoginOtp,
  resendOtp,
  register,
  verifyRegisterOtp,
  googleLogin,
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
