const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { protect } = require('../middleware/auth');
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

// Get all documents or filtered documents
router.get('/', documentController.getDocuments);

// Get single document by ID
router.get('/:id', documentController.getDocument);

// Upload document
router.post('/upload', upload.single('file'), documentController.uploadDocument);

// Update document
router.put('/:id', documentController.updateDocument);

// Delete document
router.delete('/:id', documentController.deleteDocument);

// Share document with users
router.post('/:id/share', documentController.shareDocument);

// Toggle document favorite status
router.post('/:id/favorite', documentController.toggleFavorite);

module.exports = router;