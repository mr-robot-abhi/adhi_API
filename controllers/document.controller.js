const Document = require('../models/document.model');
const Case = require('../models/case.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const { uploadFile, deleteFile, getSignedUrl } = require('../utils/firebaseStorage');

/**
 * @desc    Get all documents or filtered documents
 * @route   GET /api/documents
 * @access  Private
 */
exports.getDocuments = async (req, res, next) => {
  try {
    const { search, category, status, caseId, tag, tab, sortBy, sortOrder } = req.query;

    // Build filter object
    const filter = {};

    // Check user role and filter documents accordingly
    if (req.user.role === 'client') {
      // Clients can only see documents from their cases
      const clientCases = await Case.find({ client: req.user.id }).select('_id');
      const clientCaseIds = clientCases.map(c => c._id);
      filter.case = { $in: clientCaseIds };
    } else if (req.user.role === 'lawyer') {
      // Lawyers can see documents from cases where they are assigned
      const lawyerCases = await Case.find({ lawyer: req.user.id }).select('_id');
      const lawyerCaseIds = lawyerCases.map(c => c._id);
      filter.case = { $in: lawyerCaseIds };
    }
    // Admins can see all documents (no additional filter)

    // Apply additional filters if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (category && category !== 'All Categories') {
      filter.category = category;
    }

    if (status && status !== 'All Statuses') {
      filter.status = status;
    }

    if (caseId && caseId !== 'all') {
      filter.case = caseId;
    }

    if (tag) {
      filter.tags = tag;
    }

    if (tab && tab !== 'all') {
      if (tab === 'recent') {
        // Recent documents (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filter.createdAt = { $gte: sevenDaysAgo };
      } else if (tab === 'shared') {
        // Documents shared with the user
        filter.sharedWith = req.user.id;
      } else if (tab === 'favorites') {
        // Favorited documents
        filter.favoritedBy = req.user.id;
      }
    }

    // Prepare sort options
    const sortOptions = {};
    if (sortBy) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    } else {
      sortOptions.createdAt = -1; // Default sort by created date desc
    }

    // Query documents with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Execute query with populated fields
    const documents = await Document.find(filter)
      .populate('case', 'title caseNumber')
      .populate('uploadedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Document.countDocuments(filter);

    // Generate signed URLs for document access
    const documentsWithUrls = await Promise.all(documents.map(async (doc) => {
      const docObj = doc.toObject();
      if (docObj.fileUrl) {
        docObj.signedUrl = await getSignedUrl(docObj.fileUrl);
      }
      return docObj;
    }));

    res.status(200).json({
      success: true,
      count: documents.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: documentsWithUrls,
    });
  } catch (error) {
    logger.error(`Error getting documents: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get single document by ID
 * @route   GET /api/documents/:id
 * @access  Private
 */
exports.getDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    const document = await Document.findById(documentId)
      .populate('case', 'title caseNumber')
      .populate('uploadedBy', 'name email');

    if (!document) {
      return next(new AppError('Document not found', 404));
    }

    // Check if user has permission to view this document
    if (req.user.role === 'client') {
      // Check if document belongs to a case where the client is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.client.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this document', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if document belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this document', 403));
      }
    }

    // Generate signed URL for document access
    let signedUrl = null;
    if (document.fileUrl) {
      signedUrl = await getSignedUrl(document.fileUrl);
    }

    const documentWithUrl = document.toObject();
    documentWithUrl.signedUrl = signedUrl;

    res.status(200).json({
      success: true,
      data: documentWithUrl,
    });
  } catch (error) {
    logger.error(`Error getting document: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Upload document
 * @route   POST /api/documents/upload
 * @access  Private
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload a file', 400));
    }

    const { caseId, name, description, category, tags } = req.body;

    // Check if case exists
    const caseItem = await Case.findById(caseId);

    if (!caseItem) {
      return next(new AppError('Case not found', 404));
    }

    // Check if user has permission to add documents to this case
    if (req.user.role === 'client' && caseItem.client.toString() !== req.user.id.toString()) {
      return next(new AppError('Not authorized to add documents to this case', 403));
    }

    if (req.user.role === 'lawyer' && caseItem.lawyer.toString() !== req.user.id.toString()) {
      return next(new AppError('Not authorized to add documents to this case', 403));
    }

    // Upload file to Firebase Storage
    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    
    const fileUrl = await uploadFile(
      fileBuffer, 
      `cases/${caseId}/documents/${Date.now()}_${originalName}`,
      mimeType
    );

    // Parse tags if provided
    const parsedTags = tags ? tags.split(',').map(tag => tag.trim()) : [];

    // Create document record
    const newDocument = await Document.create({
      name: name || originalName,
      description,
      case: caseId,
      category,
      tags: parsedTags,
      fileType: mimeType,
      fileSize: req.file.size,
      fileName: originalName,
      fileUrl,
      uploadedBy: req.user.id,
      status: 'Pending', // Default status
    });

    // Add document to case
    caseItem.documents.push(newDocument._id);
    await caseItem.save();

    logger.info(`Document uploaded: ${newDocument.name} (ID: ${newDocument._id})`);

    res.status(201).json({
      success: true,
      data: newDocument,
    });
  } catch (error) {
    logger.error(`Error uploading document: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update document
 * @route   PUT /api/documents/:id
 * @access  Private
 */
exports.updateDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;
    const { name, description, category, tags, status } = req.body;

    // Find document first to check permissions
    const document = await Document.findById(documentId);

    if (!document) {
      return next(new AppError('Document not found', 404));
    }

    // Check if user has permission to update this document
    if (req.user.role === 'client') {
      // Clients can only update documents they uploaded
      if (document.uploadedBy.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to update this document', 403));
      }
      
      // Clients cannot change the status
      if (status && status !== document.status) {
        return next(new AppError('Not authorized to change document status', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if document belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to update this document', 403));
      }
    }

    // Parse tags if provided
    let parsedTags;
    if (tags) {
      parsedTags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }

    // Update document
    const updateData = {
      name,
      description,
      category,
      status,
    };
    
    // Only update tags if they were provided
    if (parsedTags) {
      updateData.tags = parsedTags;
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedDocument = await Document.findByIdAndUpdate(
      documentId,
      updateData,
      { new: true, runValidators: true }
    );

    logger.info(`Document updated: ${updatedDocument.name} (ID: ${updatedDocument._id})`);

    res.status(200).json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    logger.error(`Error updating document: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Delete document
 * @route   DELETE /api/documents/:id
 * @access  Private
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const documentId = req.params.id;

    // Find document first to check permissions
    const document = await Document.findById(documentId);

    if (!document) {
      return next(new AppError('Document not found', 404));
    }

    // Check if user has permission to delete this document
    if (req.user.role === 'client') {
      // Clients cannot delete documents
      return next(new AppError('Not authorized to delete documents', 403));
    } else if (req.user.role === 'lawyer') {
      // Check if document belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to delete this document', 403));
      }
    }

    // Delete file from storage
    if (document.fileUrl) {
      await deleteFile(document.fileUrl);
    }

    // Remove document reference from case
    await Case.findByIdAndUpdate(document.case, {
      $pull: { documents: documentId }
    });

    // Delete document from database
    await Document.findByIdAndDelete(documentId);

    logger.info(`Document deleted: ${document.name} (ID: ${documentId})`);

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    logger.error(`Error deleting document: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Share document with users
 * @route   POST /api/documents/:id/share
 * @access  Private (Lawyers and Admins only)
 */
exports.shareDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { users } = req.body;

    if (req.user.role === 'client') {
      return next(new AppError('Not authorized to share documents', 403));
    }

    const document = await Document.findById(id);

    if (!document) {
      return next(new AppError('Document not found', 404));
    }

    if (req.user.role === 'lawyer') {
      // Check if document belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to share this document', 403));
      }
    }

    // Update document with shared users
    document.sharedWith = users;
    await document.save();

    logger.info(`Document shared: ${document.name} (ID: ${id}) with users: ${users.join(', ')}`);

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    logger.error(`Error sharing document: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Toggle document favorite status
 * @route   POST /api/documents/:id/favorite
 * @access  Private
 */
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);

    if (!document) {
      return next(new AppError('Document not found', 404));
    }

    // Check if user has access to this document
    if (req.user.role === 'client') {
      // Check if document belongs to a case where the client is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.client.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this document', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if document belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(document.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this document', 403));
      }
    }

    // Toggle favorite status
    const isFavorited = document.favoritedBy.includes(req.user.id);
    
    if (isFavorited) {
      // Remove from favorites
      document.favoritedBy = document.favoritedBy.filter(
        userId => userId.toString() !== req.user.id.toString()
      );
    } else {
      // Add to favorites
      document.favoritedBy.push(req.user.id);
    }
    
    await document.save();

    logger.info(`Document favorite toggled: ${document.name} (ID: ${id}) by user ${req.user.id}`);

    res.status(200).json({
      success: true,
      isFavorited: !isFavorited,
      data: document,
    });
  } catch (error) {
    logger.error(`Error toggling document favorite: ${error.message}`);
    next(error);
  }
};