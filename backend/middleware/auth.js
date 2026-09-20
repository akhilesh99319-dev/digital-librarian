const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (isProduction) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production mode.');
  }
  JWT_SECRET = 'dev_only_library_jwt_key_not_for_production';
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token is missing.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.'
      });
    }

    if (!user || user.purpose === 'OTP_VERIFY') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Please complete OTP verification first.'
      });
    }

    req.user = user;
    next();
  });
}

function requireLibrarian(req, res, next) {
  if (!req.user || (req.user.role !== 'Librarian' && req.user.role !== 'Admin')) {
    return res.status(403).json({
      success: false,
      message: 'You are not authorized to modify member information.'
    });
  }
  next();
}

function requireAdminOrLibrarian(req, res, next) {
  if (!req.user || (req.user.role !== 'Librarian' && req.user.role !== 'Admin')) {
    return res.status(403).json({
      success: false,
      message: 'Access forbidden. Administrator or Librarian privileges required.'
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireLibrarian,
  requireAdminOrLibrarian,
  JWT_SECRET
};

