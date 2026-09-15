const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireAdminOrLibrarian } = require('../middleware/auth');

// All reports protected for Admin and Librarian
router.use(authenticateToken);
router.use(requireAdminOrLibrarian);

router.get('/', reportController.getReport);
router.get('/summary', reportController.getReportSummary);

module.exports = router;

