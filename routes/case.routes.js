const express = require('express');
const router = express.Router();
const caseController = require('../controllers/case.controller');
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'application/x-rar-compressed',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents, images, and archives are allowed.'), false);
    }
  }
});

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

// Create new case - all users
router.post('/', caseController.createCase);

// Update case - all users
router.put('/:id', caseController.updateCase);

// Delete case - only admins
router.delete('/:id', authorize('admin'), caseController.deleteCase);

// Add client to case - all users
router.post('/:id/clients', caseController.addClientToCase);

// Upload documents to case
router.post('/:id/documents', upload.array('files', 5), caseController.uploadCaseDocuments);

module.exports = router;