const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { authenticateToken, requireLibrarian } = require('../middleware/auth');

// All member routes protected by JWT authentication
router.use(authenticateToken);

// Read-only member routes
router.get('/', memberController.getAllMembers);
router.get('/:id', memberController.getMemberById);

// Librarian-only member management & email update routes
router.put('/:id/email', requireLibrarian, memberController.updateMemberEmail);
router.patch('/:id/email', requireLibrarian, memberController.updateMemberEmail);
router.post('/', requireLibrarian, memberController.createMember);
router.put('/:id', requireLibrarian, memberController.updateMember);
router.patch('/:id', requireLibrarian, memberController.updateMember);
router.delete('/:id', requireLibrarian, memberController.deleteMember);

module.exports = router;
