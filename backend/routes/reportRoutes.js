const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// All reports protected
router.use(authenticateToken);

router.get('/', reportController.getReport);
router.get('/summary', reportController.getReportSummary);

module.exports = router;
