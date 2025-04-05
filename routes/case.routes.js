const express = require('express');
const router = express.Router();
const caseController = require('../controllers/case.controller');
const authMiddleware = require('../middleware/auth');
const rolesMiddleware = require('../middleware/roles');

// Create new case
router.post('/', authMiddleware, rolesMiddleware(['admin', 'lawyer']), caseController.createCase);

// Get all cases
router.get('/', authMiddleware, caseController.getAllCases);

// Get single case
router.get('/:id', authMiddleware, caseController.getCase);

// Update case
router.put('/:id', authMiddleware, rolesMiddleware(['admin', 'lawyer']), caseController.updateCase);

// Delete case
router.delete('/:id', authMiddleware, rolesMiddleware(['admin']), caseController.deleteCase);

module.exports = router;
