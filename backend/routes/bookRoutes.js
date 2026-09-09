const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { authenticateToken } = require('../middleware/auth');

// All book management routes are protected
router.use(authenticateToken);

router.get('/', bookController.getAllBooks);
router.get('/:id', bookController.getBookById);
router.post('/', bookController.createBook);
router.put('/:id', bookController.updateBook);
router.delete('/:id', bookController.deleteBook);

module.exports = router;
