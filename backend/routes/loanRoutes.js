const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { authenticateToken, requireAdminOrLibrarian } = require('../middleware/auth');

// All loan and request operations require valid JWT token
router.use(authenticateToken);

// --- MEMBER ACCESSIBLE ROUTES (Derives Member ID from authenticated session) ---
router.post('/request', loanController.requestBook);
router.get('/my-requests', loanController.getMyRequests);
router.get('/my-loans', loanController.getMyLoans);
router.get('/my-books', loanController.getMyLoans);
router.get('/notifications', loanController.getMemberNotifications);
router.post('/fines/:id/member-pay', loanController.memberPayFine);

// --- LIBRARIAN & ADMIN ONLY CIRCULATION ROUTES ---
router.get('/requests', requireAdminOrLibrarian, loanController.getMemberRequests);
router.post('/requests/:id/action', requireAdminOrLibrarian, loanController.actionMemberRequest);

router.post('/issue', requireAdminOrLibrarian, loanController.issueBook);
router.post('/:id/return', requireAdminOrLibrarian, loanController.returnBook);
router.get('/active', requireAdminOrLibrarian, loanController.getActiveLoans);
router.get('/overdue', requireAdminOrLibrarian, loanController.getOverdueLoans);
router.post('/fines/:id/pay', requireAdminOrLibrarian, loanController.settleFine);

module.exports = router;

