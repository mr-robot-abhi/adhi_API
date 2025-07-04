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

    const userId = req.user.id;
    
    // Base filter for user access - user can only see cases they're involved with
    const userAccessFilter = {
      $or: [
        { creator: userId },
        { lawyer: userId },
        { client: userId }
      ]
    }

    // Additional filters
    const additionalFilters = {}

    if (search) {
      additionalFilters.$or = [
        { title: { $regex: search, $options: "i" } },
        { caseNumber: { $regex: search, $options: "i" } },
        { court: { $regex: search, $options: "i" } },
      ]
    }

    if (status) additionalFilters.status = status
    if (type) additionalFilters.caseType = type
    if (district) additionalFilters.district = district

    if (date) {
      const today = new Date()
      const startOfToday = new Date(today.setHours(0, 0, 0, 0))
      if (date === "today") {
        additionalFilters.filingDate = { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) }
      } else if (date === "week") {
        additionalFilters.filingDate = { $gte: new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000) }
      } else if (date === "month") {
        additionalFilters.filingDate = { $gte: new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }
    }

    // Combine user access filter with additional filters
    if (Object.keys(additionalFilters).length > 0) {
      filter.$and = [userAccessFilter, additionalFilters]
    } else {
      Object.assign(filter, userAccessFilter)
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
    // Get the case with all necessary populated fields
    const caseItem = await Case.findById(caseId)
      .populate("lawyer", "name email contact")  // Primary lawyer
      .populate("client", "name email contact address")  // Primary client
      .populate({
        path: "lawyers.user",
        select: "name email contact company gst level"
      })
      .populate("documents")
      .populate("events")

    if (!caseItem) {
      return next(new AppError("Case not found", 404))
    }

    // Check authorization: User must be the assigned lawyer or client
    const userIdStr = req.user.id.toString();
    const caseLawyerIdStr = caseItem.lawyer?._id?.toString();
    const caseClientIdStr = caseItem.client?._id?.toString();

    if (!(caseLawyerIdStr === userIdStr || caseClientIdStr === userIdStr)) {
      // If the user is neither the lawyer nor the client associated with the case
      return next(new AppError("Not authorized to access this case", 403));
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
 * @access  Private (Lawyers and Clients)
 */
const { createCaseSchema, updateCaseSchema } = require('../utils/validation');

exports.createCase = async (req, res, next) => {
  try {
    // Validate request body against new schema
    const { error } = createCaseSchema.validate(req.body);
    if (error) return next(new AppError(error.details[0].message, 400));

    const { parties = {}, advocates = [], clients = [], stakeholders = [], lawyers = [], ...otherFields } = req.body;
    
    // Initialize case data with basic info
    const caseData = {
      ...otherFields,
      creator: req.user.id,
      parties: {
        petitioner: Array.isArray(parties.petitioner) ? parties.petitioner : [],
        respondent: Array.isArray(parties.respondent) ? parties.respondent : []
      },
      // Initialize arrays with provided data or empty arrays
      advocates: Array.isArray(advocates) ? advocates : [],
      clients: Array.isArray(clients) ? clients : [],
      stakeholders: Array.isArray(stakeholders) ? stakeholders : [],
      lawyers: Array.isArray(lawyers) ? lawyers : []
    };

    // Handle user role specific data
    // Remove forced assignment of logged-in user as primary lawyer or client
    // Only set lawyer/client if not provided in request
    if (req.user.role === 'lawyer') {
      if (!caseData.lawyers || caseData.lawyers.length === 0) {
        // If no lawyers provided, default to logged-in user
        caseData.lawyer = req.user.id;
        caseData.lawyers = [
          {
            user: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: 'lead',
            position: 'first_chair',
            isPrimary: true,
            level: 'Senior',
            chairPosition: 'first_chair',
            addedBy: req.user.id,
            addedAt: new Date()
          }
        ];
      } else {
        // Use provided lawyers array, set primary if indicated
        const primaryLawyer = caseData.lawyers.find(lawyer => lawyer.isPrimary);
        if (primaryLawyer) {
          caseData.lawyer = primaryLawyer.user;
        } else {
          // If no primary, set the first as primary
          caseData.lawyers[0].isPrimary = true;
          caseData.lawyer = caseData.lawyers[0].user;
        }
      }
    } else if (req.user.role === 'client') {
      if (!caseData.clients || caseData.clients.length === 0) {
        // If no clients provided, default to logged-in user
        caseData.client = req.user.id;
        caseData.clients = [
          {
            user: req.user.id,
            name: req.user.name,
            email: req.user.email,
            isPrimary: true,
            addedBy: req.user.id,
            addedAt: new Date()
          }
        ];
      } else {
        // Use provided clients array, set primary if indicated
        const primaryClient = caseData.clients.find(client => client.isPrimary);
        if (primaryClient) {
          caseData.client = primaryClient.user;
        } else {
          // If no primary, set the first as primary
          caseData.clients[0].isPrimary = true;
          caseData.client = caseData.clients[0].user;
        }
      }
    }
    // Ensure at least one primary lawyer is set if there are lawyers
    if (caseData.lawyers && caseData.lawyers.length > 0) {
      const hasPrimary = caseData.lawyers.some(lawyer => lawyer.isPrimary);
      if (!hasPrimary) {
        caseData.lawyers[0].isPrimary = true;
      }
    }
    // Ensure at least one primary client is set if there are clients
    if (caseData.clients && caseData.clients.length > 0) {
      const hasPrimary = caseData.clients.some(client => client.isPrimary);
      if (!hasPrimary) {
        caseData.clients[0].isPrimary = true;
      }
    }

    // Prevent duplicate case numbers
    const existing = await Case.findOne({ caseNumber: caseData.caseNumber });
    if (existing) {
      return next(new AppError("A case with this case number already exists.", 409));
    }

    const newCase = await Case.create(caseData);
    logger.info(`New case created: ${newCase.title} (ID: ${newCase._id})`);

    // Notify all lawyers and clients (except creator)
    const Notification = require('../models/notification.model');
    const notifiedUserIds = new Set();
    const notifiedEmails = new Set();
    const notifiedPhones = new Set();
    // Lawyers
    if (Array.isArray(newCase.lawyers)) {
      for (const lawyer of newCase.lawyers) {
        if (lawyer.user && lawyer.user.toString() !== req.user.id && !notifiedUserIds.has(lawyer.user.toString())) {
          await Notification.create({
            user: lawyer.user,
            type: 'case',
            message: `You were added to the case: ${newCase.title}`,
            link: `/dashboard/cases/${newCase._id}`,
            meta: { caseId: newCase._id }
          });
          notifiedUserIds.add(lawyer.user.toString());
        }
        if (lawyer.email) notifiedEmails.add(lawyer.email);
        if (lawyer.contact) notifiedPhones.add(lawyer.contact);
      }
    }
    // Clients
    if (Array.isArray(newCase.clients)) {
      for (const client of newCase.clients) {
        if (client.user && client.user.toString() !== req.user.id && !notifiedUserIds.has(client.user.toString())) {
          await Notification.create({
            user: client.user,
            type: 'case',
            message: `You were added to the case: ${newCase.title}`,
            link: `/dashboard/cases/${newCase._id}`,
            meta: { caseId: newCase._id }
          });
          notifiedUserIds.add(client.user.toString());
        }
        if (client.email) notifiedEmails.add(client.email);
        if (client.contact) notifiedPhones.add(client.contact);
      }
    }
    // Parties (petitioner/respondent)
    if (newCase.parties && Array.isArray(newCase.parties.petitioner)) {
      for (const p of newCase.parties.petitioner) {
        if (p.email) notifiedEmails.add(p.email);
        if (p.contact) notifiedPhones.add(p.contact);
      }
    }
    if (newCase.parties && Array.isArray(newCase.parties.respondent)) {
      for (const r of newCase.parties.respondent) {
        if (r.email) notifiedEmails.add(r.email);
        if (r.contact) notifiedPhones.add(r.contact);
      }
    }
    // Stakeholders
    if (Array.isArray(newCase.stakeholders)) {
      for (const s of newCase.stakeholders) {
        if (s.email) notifiedEmails.add(s.email);
        if (s.contact) notifiedPhones.add(s.contact);
      }
    }
    // Advocates
    if (Array.isArray(newCase.advocates)) {
      for (const a of newCase.advocates) {
        if (a.email) notifiedEmails.add(a.email);
        if (a.contact) notifiedPhones.add(a.contact);
      }
    }
    // Prepare to send email/SMS (stub)
    const sendgridMailer = require('../utils/sendgridMailer');
    const twilio = require('../utils/twilio');
    await sendgridMailer.sendCaseNotification(Array.from(notifiedEmails), newCase.title, `/dashboard/cases/${newCase._id}`);
    await twilio.sendCaseNotification(Array.from(notifiedPhones), newCase.title, `/dashboard/cases/${newCase._id}`);

    res.status(201).json({
      status: 'success',
      data: { case: newCase }
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.caseNumber) {
      logger.error('Duplicate case number error.');
      return next(new AppError('A case with this case number already exists.', 409));
    }
    logger.error(`Error creating case: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update case
 * @route   PUT /api/cases/:id
 * @access  Private (Lawyers and Clients)
 */
exports.updateCase = async (req, res, next) => {
  try {
    // Debug log incoming payload
    console.log('Incoming update payload:', JSON.stringify(req.body, null, 2));
    if (req.body.parties) {
      if (!Array.isArray(req.body.parties.petitioner)) req.body.parties.petitioner = [];
      if (!Array.isArray(req.body.parties.respondent)) req.body.parties.respondent = [];
      // Patch missing fields for every party
      req.body.parties.petitioner = req.body.parties.petitioner.map(p => ({
        name: p.name || "",
        type: p.type || "Individual",
        role: p.role || "Petitioner",
        email: p.email || "",
        contact: p.contact || "",
        address: p.address || ""
      }));
      req.body.parties.respondent = req.body.parties.respondent.map(p => ({
        name: p.name || "",
        type: p.type || "Individual",
        role: p.role || "Respondent",
        email: p.email || "",
        contact: p.contact || "",
        address: p.address || "",
        opposingCounsel: p.opposingCounsel || ""
      }));
    }
    // Validate request body against update schema
    const { error: validationError } = updateCaseSchema.validate(req.body);
    if (validationError) return next(new AppError(validationError.details[0].message, 400));

    const caseId = req.params.id;
    const caseToUpdate = await Case.findById(caseId);

    if (!caseToUpdate) {
      return next(new AppError("Case not found", 404));
    }

    // Allow update if user is assigned lawyer or client
    if (
      (caseToUpdate.lawyer && caseToUpdate.lawyer.toString() === req.user.id) ||
      (caseToUpdate.client && caseToUpdate.client.toString() === req.user.id) ||
      (req.user.role === 'lawyer' && !caseToUpdate.lawyer) || // Allow lawyer to assign themselves if not already assigned
      (req.user.role === 'client' && !caseToUpdate.client)  // Allow client to assign themselves if not already assigned
    ) {
      // Prepare update data, ensuring we handle clients, advocates, lawyers, and stakeholders correctly
      const { parties, clients, advocates, stakeholders, lawyers, ...otherUpdateData } = req.body;
      const updatePayload = {
        ...otherUpdateData,
      };

      // Handle lawyers - update lawyers array if provided
      if (lawyers !== undefined) {
        let updatedLawyers = Array.isArray(lawyers) ? [...lawyers] : [];
        if (updatedLawyers.length > 0) {
          // Set primary lawyer if indicated, else first
          const primaryLawyer = updatedLawyers.find(lawyer => lawyer.isPrimary);
          if (!primaryLawyer) {
            updatedLawyers[0].isPrimary = true;
          }
          updatePayload.lawyer = (updatedLawyers.find(lawyer => lawyer.isPrimary) || updatedLawyers[0]).user;
        }
        updatePayload.lawyers = updatedLawyers;
      }
      // Handle clients if provided
      if (clients !== undefined) {
        let updatedClients = Array.isArray(clients) ? [...clients] : [];
        if (updatedClients.length > 0) {
          // Set primary client if indicated, else first
          const primaryClient = updatedClients.find(client => client.isPrimary);
          if (!primaryClient) {
            updatedClients[0].isPrimary = true;
          }
          updatePayload.client = (updatedClients.find(client => client.isPrimary) || updatedClients[0]).user;
        }
        updatePayload.clients = updatedClients;
      }

      // Handle advocates if provided
      if (advocates !== undefined) {
        updatePayload.advocates = Array.isArray(advocates) ? advocates : [];
      }

      // Handle stakeholders if provided
      if (stakeholders !== undefined) {
        updatePayload.stakeholders = Array.isArray(stakeholders) ? stakeholders : [];
      }
      
      // Handle parties robustly
      let newParties;
      if (parties) {
        newParties = {
          petitioner: Array.isArray(parties.petitioner) ? parties.petitioner : [],
          respondent: Array.isArray(parties.respondent) ? parties.respondent : []
        };
      } else {
        // Use existing case's parties, but ensure structure
        const existingParties = caseToUpdate.parties || {};
        newParties = {
          petitioner: Array.isArray(existingParties.petitioner) ? existingParties.petitioner : [],
          respondent: Array.isArray(existingParties.respondent) ? existingParties.respondent : []
        };
      }
      updatePayload.parties = newParties;

      const updatedCase = await Case.findByIdAndUpdate(caseId, updatePayload, {
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
