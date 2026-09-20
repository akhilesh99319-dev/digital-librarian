const nodemailer = require('nodemailer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const testCachePath = path.join(__dirname, '../../database/test_otps_cache.json');

/**
 * Generate a cryptographically secure 6-digit random OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Mask an email address for safe display in UI
 * e.g. "akhilesh@library.com" -> "a***h@library.com"
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***@***';
  }
  const [localPart, domain] = email.trim().split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}***${last}@${domain}`;
}

/**
 * Create Nodemailer Transporter if environment variables are configured
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587', 10);
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      }
    });
  }
  return null;
}

/**
 * Save test OTP to cache file for multi-process test runner accessibility
 */
function saveTestOtp(email, otp, type) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    let cache = {};
    if (fs.existsSync(testCachePath)) {
      try {
        cache = JSON.parse(fs.readFileSync(testCachePath, 'utf8'));
      } catch (_) {}
    }
    cache[email.toLowerCase().trim()] = {
      otp,
      type,
      timestamp: Date.now()
    };
    fs.writeFileSync(testCachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal cache write
  }
}

/**
 * Send 6-Digit OTP Email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} type - 'LOGIN' or 'REGISTER'
 * @param {string} recipientName - Optional recipient display name
 */
async function sendOTPEmail(toEmail, otp, type = 'LOGIN', recipientName = 'User') {
  if (!toEmail || !otp) {
    throw new Error('Recipient email and OTP are required.');
  }

  const cleanEmail = toEmail.trim().toLowerCase();
  const transporter = createTransporter();
  const fromAddress = process.env.EMAIL_FROM || '"Digital Librarian" <noreply@digitallibrarian.org>';
  const actionTitle = type === 'REGISTER' ? 'Account Registration' : 'Account Login';

  const subject = `Your Digital Librarian Verification Code: ${otp}`;
  const textContent = `Hello ${recipientName},\n\nYour 6-digit verification code for Digital Librarian ${actionTitle} is:\n\n${otp}\n\nThis code will expire in 5 minutes and can only be used once.\nIf you did not request this code, please ignore this email or contact the library administrator.\n\nDigital Librarian System`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 540px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { text-align: center; margin-bottom: 24px; }
        .logo { font-size: 32px; margin-bottom: 8px; }
        .title { color: #818cf8; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; margin: 0; }
        .subtitle { color: #94a3b8; font-size: 13px; margin-top: 4px; }
        .otp-box { background: rgba(99, 102, 241, 0.12); border: 2px dashed #6366f1; border-radius: 8px; padding: 18px; text-align: center; margin: 28px 0; }
        .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #a5b4fc; font-family: monospace; }
        .details { color: #cbd5e1; font-size: 14px; line-height: 1.6; }
        .warning { color: #f87171; font-size: 12px; margin-top: 20px; border-top: 1px solid #334155; padding-top: 16px; }
        .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📚</div>
          <h1 class="title">DIGITAL LIBRARIAN</h1>
          <div class="subtitle">Secure Identity Verification</div>
        </div>
        <p class="details">Hello <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p class="details">Use the following single-use verification code to complete your <strong>${actionTitle}</strong>:</p>
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        <p class="details" style="text-align:center;color:#94a3b8;font-size:13px;">
          ⏱️ Valid for <strong>5 minutes</strong>. Single-use only.
        </p>
        <div class="warning">
          🔒 If you did not initiate this request, please contact your library administrator immediately. Never share this code with anyone.
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Digital Librarian Management System.
        </div>
      </div>
    </body>
    </html>
  `;

  // Always save for test runners in non-production environments
  saveTestOtp(cleanEmail, otp, type);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: cleanEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      return { success: true, delivered: true };
    } catch (mailErr) {
      console.error('Email delivery error:', mailErr.message);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Failed to deliver verification email. Please contact administrator.');
      }
    }
  }

  // Simulated delivery for local dev / testing
  return { success: true, delivered: false, simulated: true };
}

/**
 * Helper to retrieve test OTP (Only accessible in test environment for automated test suites)
 */
function getTestOtp(email) {
  if (process.env.NODE_ENV === 'production') return null;
  const targetEmail = email ? email.trim().toLowerCase() : '';
  try {
    if (fs.existsSync(testCachePath)) {
      const cache = JSON.parse(fs.readFileSync(testCachePath, 'utf8'));
      if (cache[targetEmail]) {
        return cache[targetEmail].otp;
      }
    }
  } catch (_) {}
  return null;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCachedTestOtps() {
  if (process.env.NODE_ENV === 'production') return {};
  try {
    if (fs.existsSync(testCachePath)) {
      return JSON.parse(fs.readFileSync(testCachePath, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function clearTestOtpCache() {
  try {
    if (fs.existsSync(testCachePath)) {
      fs.unlinkSync(testCachePath);
    }
  } catch (_) {}
}

module.exports = {
  generateOTP,
  maskEmail,
  sendOTPEmail,
  getTestOtp,
  getCachedTestOtps,
  clearTestOtpCache
};
