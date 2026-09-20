/**
 * In-memory sliding window rate limiter for Authentication endpoints
 */

const loginAttempts = new Map();
const resendCooldowns = new Map();

/**
 * Clean up stale rate limiting entries older than maxAgeMs
 */
function cleanupMap(map, maxAgeMs) {
  const now = Date.now();
  for (const [key, entry] of map.entries()) {
    if (now - entry.lastAttempt > maxAgeMs) {
      map.delete(key);
    }
  }
}

// Run cleanup periodically every 5 minutes
setInterval(() => {
  cleanupMap(loginAttempts, 15 * 60 * 1000);
  cleanupMap(resendCooldowns, 10 * 60 * 1000);
}, 5 * 60 * 1000).unref();

/**
 * Rate Limiter for Login Attempts
 * Limits failed attempts to 15 per 5 minutes per IP + identifier
 */
function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const identifier = (req.body?.email || req.body?.identifier || '').toLowerCase().trim();
  const key = `${ip}_${identifier}`;

  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAttempts = isProduction ? 15 : 250;

  let record = loginAttempts.get(key);
  if (!record || (now - record.firstAttempt > windowMs)) {
    record = { count: 1, firstAttempt: now, lastAttempt: now };
    loginAttempts.set(key, record);
  } else {
    record.count++;
    record.lastAttempt = now;
    if (record.count > maxAttempts) {
      const waitSeconds = Math.ceil((windowMs - (now - record.firstAttempt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many authentication attempts. Please try again in ${waitSeconds} seconds.`
      });
    }
  }

  next();
}

/**
 * Reset in-memory rate limiting maps (for test suite cleanup)
 */
function resetRateLimits() {
  loginAttempts.clear();
  resendCooldowns.clear();
}

/**
 * Record initial OTP issuance to trigger resend cooldown immediately
 */
function recordOtpIssued(sessionKey) {
  if (!sessionKey) return;
  const key = String(sessionKey).trim().toLowerCase();
  resendCooldowns.set(key, { lastSent: Date.now(), count: 1 });
}

/**
 * Check and enforce OTP Resend Cooldown (45 seconds) & max resends (3)
 * @param {string} sessionKey - email or tempToken identifier
 * @returns {{ allowed: boolean, remainingSeconds: number, reason: string }}
 */
function checkResendCooldown(sessionKey, cooldownSeconds = 45, maxResends = 3) {
  const now = Date.now();
  const key = String(sessionKey).trim().toLowerCase();
  let record = resendCooldowns.get(key);

  if (!record) {
    resendCooldowns.set(key, { lastSent: now, count: 1 });
    return { allowed: true, remainingSeconds: cooldownSeconds };
  }

  const elapsedSeconds = Math.floor((now - record.lastSent) / 1000);
  if (elapsedSeconds < cooldownSeconds) {
    const remaining = cooldownSeconds - elapsedSeconds;
    return {
      allowed: false,
      remainingSeconds: remaining,
      reason: `Please wait ${remaining} seconds before requesting a new verification code.`
    };
  }

  if (record.count >= maxResends) {
    if (elapsedSeconds > 300) {
      resendCooldowns.set(key, { lastSent: now, count: 1 });
      return { allowed: true, remainingSeconds: cooldownSeconds };
    }
    return {
      allowed: false,
      remainingSeconds: 300 - elapsedSeconds,
      reason: 'Maximum resend attempts reached. Please start a new authentication session.'
    };
  }

  record.lastSent = now;
  record.count++;
  return { allowed: true, remainingSeconds: cooldownSeconds };
}

module.exports = {
  authRateLimiter,
  recordOtpIssued,
  checkResendCooldown,
  resetRateLimits
};
