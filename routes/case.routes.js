const express = require('express');
const router = express.Router();
const caseController = require('../controllers/case.controller');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

// Create new case
router.post('/', authMiddleware.verify, authorize(['admin', 'lawyer']), caseController.createCase);

// Get all cases
router.get('/', authMiddleware.verify, caseController.getAllCases);

// Get single case
router.get('/:id', authMiddleware.verify, caseController.getCase);

// Update case
router.put('/:id', authMiddleware.verify, authorize(['admin', 'lawyer']), caseController.updateCase);

// Delete case
router.delete('/:id', authMiddleware.verify, authorize(['admin']), caseController.deleteCase);

module.exports = router;
