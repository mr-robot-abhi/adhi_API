const Case = require("../models/case.model")
const Document = require("../models/document.model")
const AppError = require("../utils/appError")
const logger = require("../utils/logger")
const mongoose = require("mongoose")
const { uploadFile, getSignedUrl } = require("../utils/firebaseStorage")

/**
 * @desc    Get all cases or filtered cases
 * @route   GET /api/cases
 * @access  Private
 */
exports.getCases = async (req, res, next) => {
  try {
    const { search, status, type, district, date } = req.query
    const filter = {}

    if (req.user.role === "client") {
      filter.client = req.user.id
    } else if (req.user.role === "lawyer") {
      filter.lawyer = req.user.id
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { caseNumber: { $regex: search, $options: "i" } },
        { court: { $regex: search, $options: "i" } },
      ]
    }

    if (status) filter.status = status
    if (type) filter.caseType = type
    if (district) filter.district = district

    if (date) {
      const today = new Date()
      const startOfToday = new Date(today.setHours(0, 0, 0, 0))
      if (date === "today") {
        filter.filingDate = { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) }
      } else if (date === "week") {
        filter.filingDate = { $gte: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000) }
      } else if (date === "month") {
        filter.filingDate = { $gte: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }
    }

    const page = Number.parseInt(req.query.page, 10) || 1
    const limit = Number.parseInt(req.query.limit, 10) || 10
    const skip = (page - 1) * limit

    const cases = await Case.find(filter)
      .populate("lawyer", "name email")
      .populate("client", "name email")
      .populate("documents", "name fileType fileUrl")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Case.countDocuments(filter)

    res.status(200).json({
      success: true,
      count: cases.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: cases,
    })
  } catch (error) {
    logger.error(`Error getting cases: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Get single case by ID
 * @route   GET /api/cases/:id
 * @access  Private
 */
exports.getCase = async (req, res, next) => {
  try {
    const caseId = req.params.id
    const caseItem = await Case.findById(caseId)
      .populate("lawyer", "name email")
      .populate("client", "name email")
      .populate("documents")
      .populate("events")

    if (!caseItem) {
      return next(new AppError("Case not found", 404))
    }

    // Allow all authenticated users to view cases
    if (req.user.role === "client" && caseItem.client && caseItem.client.toString() !== req.user.id.toString()) {
      return next(new AppError("Not authorized to access this case", 403))
    }

    res.status(200).json({
      success: true,
      data: caseItem,
    })
  } catch (error) {
    logger.error(`Error getting case: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Create new case
 * @route   POST /api/cases
 * @access  Private (Lawyers and Admins only)
 */
exports.createCase = async (req, res, next) => {
  try {
    // Allow all authenticated users to create cases

    const caseData = {
      ...req.body,
      lawyer: req.user.id,
    }

    // Ensure required fields are present
    if (!caseData.title || !caseData.caseNumber || !caseData.caseType || !caseData.status) {
      return next(new AppError("Missing required fields: title, caseNumber, caseType, or status", 400))
    }

    // Prevent duplicate case numbers
    const existing = await Case.findOne({ caseNumber: caseData.caseNumber });
    if (existing) {
      return next(new AppError("A case with this case number already exists.", 409));
    }

    const newCase = await Case.create(caseData)
    logger.info(`New case created: ${newCase.title} (ID: ${newCase._id})`)

    res.status(201).json({
      success: true,
      data: newCase,
    })
  } catch (error) {
    // Handle duplicate key error (unique constraint)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.caseNumber) {
      logger.error('Duplicate case number error.');
      return next(new AppError('A case with this case number already exists.', 409));
    }
    logger.error(`Error creating case: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Update case
 * @route   PUT /api/cases/:id
 * @access  Private (Lawyers and Clients)
 */
exports.updateCase = async (req, res, next) => {
  try {
    const caseId = req.params.id
    const caseToUpdate = await Case.findById(caseId)

    if (!caseToUpdate) {
      return next(new AppError("Case not found", 404))
    }

    // Allow update if user is assigned lawyer or client
    if (
      (caseToUpdate.lawyer && caseToUpdate.lawyer.toString() === req.user.id) ||
      (caseToUpdate.client && caseToUpdate.client.toString() === req.user.id)
    ) {
      const updatedCase = await Case.findByIdAndUpdate(caseId, req.body, {
        new: true,
        runValidators: true,
      })
      logger.info(`Case updated: ${updatedCase.title} (ID: ${updatedCase._id})`)
      return res.status(200).json({
        success: true,
        data: updatedCase,
      })
    } else {
      return next(new AppError("Not authorized to update this case", 403))
    }
  } catch (error) {
    logger.error(`Error updating case: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Delete case
 * @route   DELETE /api/cases/:id
 * @access  Private (Lawyers and Clients)
 */
exports.deleteCase = async (req, res, next) => {
  try {
    const caseId = req.params.id
    const caseToDelete = await Case.findById(caseId)

    if (!caseToDelete) {
      return next(new AppError("Case not found", 404))
    }

    // Only allow deletion if user is owner (lawyer or client assigned to this case)
    if (
      (caseToDelete.lawyer && caseToDelete.lawyer.toString() === req.user.id) ||
      (caseToDelete.client && caseToDelete.client.toString() === req.user.id)
    ) {
      await caseToDelete.deleteOne();
      return res.status(200).json({ success: true, message: "Case deleted" });
    } else {
      return next(new AppError("Not authorized to delete this case", 403))
    }

    // Delete associated documents
    await Document.deleteMany({ case: caseId })

    await Case.findByIdAndDelete(caseId)
    logger.info(`Case deleted: ${caseToDelete.title} (ID: ${caseId})`)

    res.status(200).json({
      success: true,
      message: "Case deleted successfully",
    })
  } catch (error) {
    logger.error(`Error deleting case: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Add client to case
 * @route   POST /api/cases/:id/clients
 * @access  Private (Lawyers and Clients)
 */
exports.addClientToCase = async (req, res, next) => {
  try {
    const { id } = req.params
    const { clientId } = req.body

    const caseItem = await Case.findById(id)
    if (!caseItem) {
      return next(new AppError("Case not found", 404))
    }

    if (req.user.role === "lawyer" && caseItem.lawyer && caseItem.lawyer.toString() !== req.user.id.toString()) {
      return next(new AppError("Not authorized to modify this case", 403))
    }

    caseItem.client = clientId
    await caseItem.save()

    logger.info(`Client added to case: Case ID ${id}, Client ID ${clientId}`)

    res.status(200).json({
      success: true,
      data: caseItem,
    })
  } catch (error) {
    logger.error(`Error adding client to case: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Get case statistics
 * @route   GET /api/cases/stats
 * @access  Private
 */
exports.getCaseStats = async (req, res, next) => {
  try {
    const filter =
      req.user.role === "lawyer" ? { lawyer: req.user.id } : req.user.role === "client" ? { client: req.user.id } : {}

    const totalCases = await Case.countDocuments(filter)
    const activeCases = await Case.countDocuments({ ...filter, status: "active" })
    const urgentCases = await Case.countDocuments({ ...filter, isUrgent: true })
    const casesByType = await Case.aggregate([
      { $match: filter },
      { $group: { _id: "$caseType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    const casesByStatus = await Case.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    const closedCases = await Case.countDocuments({ ...filter, status: "closed" })
    const successfulCases = await Case.countDocuments({ ...filter, outcome: "successful" })

    res.status(200).json({
      success: true,
      data: {
        totalCases,
        activeCases,
        urgentCases,
        casesByType,
        casesByStatus,
        closedCases,
        successfulCases,
      },
    })
  } catch (error) {
    logger.error(`Error getting case stats: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Get recent cases
 * @route   GET /api/cases/recent
 * @access  Private
 */
exports.getRecentCases = async (req, res, next) => {
  try {
    // Build filter based on user role
    const filter = {}

    if (req.user.role === "lawyer") {
      filter.lawyer = req.user.id
    } else if (req.user.role === "client") {
      filter.client = req.user.id
    }

    // Get recent cases
    const recentCases = await Case.find(filter)
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate("lawyer", "name email")
      .populate("client", "name email")

    res.status(200).json({
      success: true,
      count: recentCases.length,
      data: recentCases,
    })
  } catch (error) {
    logger.error(`Error getting recent cases: ${error.message}`)
    next(error)
  }
}

/**
 * @desc    Upload documents to case
 * @route   POST /api/cases/:id/documents
 * @access  Private
 */
exports.uploadCaseDocuments = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(new AppError('Please upload at least one file', 400));
    }

    const caseId = req.params.id;

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

    const uploadedDocs = [];

    // Handle multiple files
    for (const file of req.files) {
      // Upload file to Firebase Storage
      const fileBuffer = file.buffer;
      const originalName = file.originalname;
      const mimeType = file.mimetype;
      
      const fileUrl = await uploadFile(
        fileBuffer, 
        `cases/${caseId}/documents/${Date.now()}_${originalName}`,
        mimeType
      );

      // Parse tags if provided
      const parsedTags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [];

      // Create document record
      const newDocument = await Document.create({
        name: req.body.name || originalName,
        description: req.body.description || `Document for case ${caseItem.title || caseId}`,
        case: caseId,
        category: req.body.category || 'Other',
        tags: parsedTags,
        fileType: mimeType,
        fileSize: file.size,
        fileName: originalName,
        fileUrl,
        uploadedBy: req.user.id,
        status: 'Pending', // Default status
      });

      // Add document to case if not already present
      if (!caseItem.documents.includes(newDocument._id)) {
        caseItem.documents.push(newDocument._id);
      }

      // Get signed URL for immediate access
      const signedUrl = await getSignedUrl(fileUrl);
      
      uploadedDocs.push({
        ...newDocument.toObject(),
        signedUrl
      });

      logger.info(`Document uploaded to case ${caseId}: ${newDocument.name} (ID: ${newDocument._id})`);
    }

    // Save the updated case
    await caseItem.save();

    res.status(201).json({
      success: true,
      data: uploadedDocs,
    });
  } catch (error) {
    logger.error(`Error uploading documents to case: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get case timeline
 * @route   GET /api/cases/:id/timeline
 * @access  Private
 */
exports.getCaseTimeline = async (req, res, next) => {
  try {
    const { id } = req.params

    const caseItem = await Case.findById(id)

    if (!caseItem) {
      return next(new AppError("Case not found", 404))
    }

    // Check if user has permission to view this case
    if (req.user.role === "client" && caseItem.client && caseItem.client.toString() !== req.user.id.toString()) {
      return next(new AppError("Not authorized to access this case", 403))
    }

    if (req.user.role === "lawyer" && caseItem.lawyer && caseItem.lawyer.toString() !== req.user.id.toString()) {
      return next(new AppError("Not authorized to access this case", 403))
    }

    // Get timeline events (from case history, events, documents, etc.)
    // Note: This is a simplified version, you would normally combine multiple collections
    const timeline = await Case.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(id) } },
      {
        $project: {
          _id: 0,
          events: [
            {
              type: "created",
              title: "Case Created",
              description: "Case was filed in the system",
              date: "$createdAt",
            },
            {
              type: "updated",
              title: "Case Updated",
              description: "Case details were modified",
              date: "$updatedAt",
            },
          ],
        },
      },
      { $unwind: "$events" },
      { $sort: { "events.date": -1 } },
    ])

    res.status(200).json({
      success: true,
      count: timeline.length,
      data: timeline,
    })
  } catch (error) {
    logger.error(`Error getting case timeline: ${error.message}`)
    next(error)
  }
}
