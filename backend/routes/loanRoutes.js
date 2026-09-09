const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { authenticateToken } = require('../middleware/auth');

// All loan operations protected
router.use(authenticateToken);

router.post('/issue', loanController.issueBook);
router.post('/:id/return', loanController.returnBook);
router.get('/active', loanController.getActiveLoans);
router.get('/overdue', loanController.getOverdueLoans);
router.post('/fines/:id/pay', loanController.settleFine);

module.exports = router;
