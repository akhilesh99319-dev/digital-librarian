const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireLibrarian } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/admin-request', authController.requestAdminLogin);
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
