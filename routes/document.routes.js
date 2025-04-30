const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { verify: authMiddleware } = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

// Upload document
router.post(
  '/upload',
  authMiddleware,
  uploadMiddleware.single('document'),
  documentController.uploadDocument
);

// Get all documents for a case
router.get('/case/:caseId', authMiddleware, documentController.getCaseDocuments);

// Download document
router.get('/:id/download', authMiddleware, documentController.downloadDocument);

// Delete document
router.delete('/:id', authMiddleware, documentController.deleteDocument);

module.exports = router;
