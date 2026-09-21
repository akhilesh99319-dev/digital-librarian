const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireLibrarian } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');

// Public Authentication Routes (Password & Google Sign-In)
router.post('/login', authRateLimiter, authController.login);
router.post('/verify-otp', authController.verifyLoginOtp);
router.post('/resend-otp', authController.resendOtp);

router.post('/register', authRateLimiter, authController.register);
router.post('/verify-register-otp', authController.verifyRegisterOtp);

router.post('/google', authRateLimiter, authController.googleLogin);

// Admin Approval Routes
router.post('/admin-request', authRateLimiter, authController.requestAdminLogin);
router.get('/admin-request/:token', authController.checkAdminApprovalStatus);

// Protected routes (Any authenticated role)
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);

// Admin/Librarian Management routes
router.get('/admin-requests', authenticateToken, requireLibrarian, authController.getPendingAdminRequests);
router.post('/admin-request/:id/action', authenticateToken, requireLibrarian, authController.actionAdminRequest);
router.get('/audit-logs', authenticateToken, requireLibrarian, authController.getAuditLogs);

module.exports = router;
