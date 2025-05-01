const express = require('express');
const router = express.Router();
const caseController = require('../controllers/case.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get all cases or filtered cases
router.get('/', caseController.getCases);

// Get case statistics
router.get('/stats', caseController.getCaseStats);

// Get recent cases
router.get('/recent', caseController.getRecentCases);

// Get single case by ID
router.get('/:id', caseController.getCase);

// Get case timeline
router.get('/:id/timeline', caseController.getCaseTimeline);

// Create new case - only lawyers and admins
router.post('/', authorize('lawyer', 'admin'), caseController.createCase);

// Update case - only lawyers and admins
router.put('/:id', authorize('lawyer', 'admin'), caseController.updateCase);

// Delete case - only admins
router.delete('/:id', authorize('admin'), caseController.deleteCase);

// Add client to case - only lawyers and admins
router.post('/:id/clients', authorize('lawyer', 'admin'), caseController.addClientToCase);

module.exports = router;