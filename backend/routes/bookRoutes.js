const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { authenticateToken, requireAdminOrLibrarian } = require('../middleware/auth');

// All book management routes are protected by JWT authentication
router.use(authenticateToken);

// Read-only catalog endpoints (Admin, Librarian, Member)
router.get('/', bookController.getAllBooks);
router.get('/:id', bookController.getBookById);

// Write operations strictly restricted to Admin and Librarian
router.post('/', requireAdminOrLibrarian, bookController.createBook);
router.put('/:id', requireAdminOrLibrarian, bookController.updateBook);
router.patch('/:id', requireAdminOrLibrarian, bookController.updateBook);
router.delete('/:id', requireAdminOrLibrarian, bookController.deleteBook);

module.exports = router;

