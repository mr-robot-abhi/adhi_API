const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');
const Document = require('../models/document.model');
const Case = require('../models/case.model');


// Configure multer for memory storage (better for cloud uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Validation rules
const documentUploadRules = [
  check('case').optional().isMongoId(),
  check('category').optional().isIn([
    'pleading', 'affidavit', 'evidence', 'contract', 
    'judgment', 'order', 'notice', 'memo', 'report'
  ]),
  check('tags.*').optional().trim().escape()
];

// @route    POST api/documents/upload
// @desc     Upload a document
// @access   Private
router.post(
  '/upload',
  auth.verify,
  upload.single('file'),
  documentUploadRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ errors: [{ msg: 'No file uploaded' }] });
      }

      // Verify case exists if provided
      let caseDetails = null;
      if (req.body.case) {
        caseDetails = await Case.findOne({
          _id: req.body.case,
          $or: [
            { user: req.user.id },
            { client: req.user.id },
            { lawyers: req.user.id }
          ]
        });
        
        if (!caseDetails) {
          return res.status(404).json({ errors: [{ msg: 'Case not found or unauthorized' }] });
        }
      }

      // Upload to cloud storage
      const { fileUrl, thumbnailUrl } = await StorageService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Create document record
      const document = await DocumentService.createDocument({
        file: req.file,
        url: fileUrl,
        thumbnailUrl,
        case: req.body.case,
        caseTitle: caseDetails?.title,
        category: req.body.category,
        tags: req.body.tags?.split(',').map(tag => tag.trim()),
        uploadedBy: req.user.id,
        owner: req.user.id,
        accessibleTo: req.body.sharedWith?.split(',').map(id => ({
          user: id.trim(),
          permission: 'view'
        })) || []
      });

      res.status(201).json(document);
    } catch (err) {
      console.error(err.message);
      if (err.message.includes('Invalid file type')) {
        return res.status(400).json({ errors: [{ msg: err.message }] });
      }
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    GET api/documents
// @desc     Get all documents with filters
// @access   Private
router.get('/', auth.verify, async (req, res) => {
  try {
    let query = {
      $or: [
        { owner: req.user.id },
        { 'accessibleTo.user': req.user.id }
      ]
    };

    // Apply filters
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { originalName: searchRegex },
        { caseTitle: searchRegex },
        { tags: searchRegex }
      ];
    }

    if (req.query.case) {
      query.case = req.query.case;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.tag) {
      query.tags = req.query.tag;
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting
    const sortOptions = {
      'date': { createdAt: -1 },
      'name': { originalName: 1 },
      'size': { size: -1 },
      'type': { type: 1 }
    };
    const sort = sortOptions[req.query.sort] || sortOptions.date;

    const documents = await Document.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('case', 'title caseNumber')
      .populate('uploadedBy', 'name');

    const total = await Document.countDocuments(query);

    res.json({
      documents,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/documents/case/:caseId
// @desc     Get all documents for a case
// @access   Private
router.get('/case/:caseId', auth.verify, async (req, res) => {
  try {
    // Verify user has access to this case
    const caseItem = await Case.findOne({
      _id: req.params.caseId,
      $or: [
        { user: req.user.id },
        { client: req.user.id },
        { lawyers: req.user.id }
      ]
    });

    if (!caseItem) {
      return res.status(404).json({ errors: [{ msg: 'Case not found or unauthorized' }] });
    }

    const documents = await Document.find({ case: req.params.caseId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name');

    res.json(documents);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/documents/:id
// @desc     Get document metadata
// @access   Private
router.get('/:id', auth.verify, async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { 'accessibleTo.user': req.user.id }
      ]
    })
    .populate('case', 'title caseNumber')
    .populate('uploadedBy', 'name')
    .populate('accessibleTo.user', 'name role');

    if (!document) {
      return res.status(404).json({ errors: [{ msg: 'Document not found or unauthorized' }] });
    }

    res.json(document);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/documents/:id/download
// @desc     Download a document
// @access   Private
router.get('/:id/download', auth.verify, async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { 'accessibleTo.user': req.user.id }
      ]
    });

    if (!document) {
      return res.status(404).json({ errors: [{ msg: 'Document not found or unauthorized' }] });
    }

    // Get downloadable file from storage service
    const fileStream = await StorageService.downloadDocument(document.url);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.originalName}"`
    );

    fileStream.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    PUT api/documents/:id
// @desc     Update document metadata
// @access   Private (Owner)
router.put('/:id', 
  auth.verify,
  [
    check('name').optional().trim().escape(),
    check('category').optional().isIn([
      'pleading', 'affidavit', 'evidence', 'contract', 
      'judgment', 'order', 'notice', 'memo', 'report'
    ]),
    check('tags.*').optional().trim().escape()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const document = await Document.findOneAndUpdate(
        { 
          _id: req.params.id,
          owner: req.user.id // Only owner can update
        },
        req.body,
        { new: true }
      );

      if (!document) {
        return res.status(404).json({ errors: [{ msg: 'Document not found or unauthorized' }] });
      }

      res.json(document);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    DELETE api/documents/:id
// @desc     Delete a document
// @access   Private (Owner or Admin)
router.delete('/:id', 
  auth.verify,
  async (req, res) => {
    try {
      const document = await Document.findOneAndDelete({
        _id: req.params.id,
        $or: [
          { owner: req.user.id },
          { $and: [
            { 'accessibleTo.user': req.user.id },
            { 'accessibleTo.permission': 'edit' }
          ]}
        ]
      });

      if (!document) {
        return res.status(404).json({ errors: [{ msg: 'Document not found or unauthorized' }] });
      }

      // Delete from storage
      await StorageService.deleteDocument(document.url);
      if (document.thumbnailUrl) {
        await StorageService.deleteDocument(document.thumbnailUrl);
      }

      res.json({ msg: 'Document deleted successfully' });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

module.exports = router;