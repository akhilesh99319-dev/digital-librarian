const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, requireAdminOrLibrarian } = require('../middleware/auth');

// All category routes protected by JWT authentication
router.use(authenticateToken);

// Read-only category endpoints (Admin, Librarian, Member)
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);

// Write operations strictly restricted to Admin and Librarian
router.post('/', requireAdminOrLibrarian, categoryController.createCategory);
router.put('/:id', requireAdminOrLibrarian, categoryController.updateCategory);
router.delete('/:id', requireAdminOrLibrarian, categoryController.deleteCategory);

module.exports = router;

