const Event = require('../models/event.model');
const Case = require('../models/case.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * @desc    Get all events or filtered events
 * @route   GET /api/events
 * @access  Private (Lawyers and Clients)
 */
exports.getEvents = async (req, res, next) => {
  try {
    const { search, type, caseId, startDate, endDate } = req.query;

    // Build filter object
    const filter = {};

    // Find all case IDs where the user is involved (as lawyer or client, including arrays)
    let userCaseIds = [];
    if (req.user.role === 'client') {
      const clientCases = await Case.find({
        $or: [
          { client: req.user.id },
          { 'clients.user': req.user.id }
        ]
      }).select('_id');
      userCaseIds = clientCases.map(c => c._id);
    } else if (req.user.role === 'lawyer') {
      const lawyerCases = await Case.find({
        $or: [
          { lawyer: req.user.id },
          { 'lawyers.user': req.user.id }
        ]
      }).select('_id');
      userCaseIds = lawyerCases.map(c => c._id);
    }
    if (userCaseIds.length > 0) {
      filter.case = { $in: userCaseIds };
    }

    // Apply additional filters if provided
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    if (type) {
      filter.type = type;
    }

    if (caseId && caseId !== 'all') {
      filter.case = caseId;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.start = {};
      if (startDate) {
        filter.start.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.start.$lte = new Date(endDate);
      }
    }

    // --- LOGGING: Print filter before querying ---
    console.log('Event filter:', filter);

    // Query events with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 1000; // For testing, show all events
    const skip = (page - 1) * limit;

    // Execute query with populated fields
    const events = await Event.find(filter)
      .populate('case', 'title caseNumber')
      .populate('createdBy', 'name email')
      .sort({ start: 1 })
      .skip(skip)
      .limit(limit);

    // --- LOGGING: Print number of events returned and the events themselves ---
    console.log('Events returned:', events.length);
    console.log('Events array:', events);

    // Get total count for pagination
    const total = await Event.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      data: events,
    });
  } catch (error) {
    logger.error(`Error getting events: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get single event by ID
 * @route   GET /api/events/:id
 * @access  Private
 */
exports.getEvent = async (req, res, next) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findById(eventId)
      .populate('case', 'title caseNumber')
      .populate('createdBy', 'name email')
      .populate('participants.user', 'name email');

    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    // Check if user has permission to view this event
    if (req.user.role === 'client') {
      // Check if event belongs to a case where the client is assigned
      const caseItem = await Case.findById(event.case);
      if (!caseItem || caseItem.client.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this event', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if event belongs to a case where the lawyer is assigned
      const caseItem = await Case.findById(event.case);
      if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to access this event', 403));
      }
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    logger.error(`Error getting event: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Create new event
 * @route   POST /api/events
 * @access  Private
 */
exports.createEvent = async (req, res, next) => {
  try {
    // Log incoming payload for debugging
    logger.info(`createEvent: Incoming payload: ${JSON.stringify(req.body)}`);

    const { title, start, end, type, location, description, case: caseId, participants } = req.body;

    // Validate required fields
    if (!title || !start || !end) {
      logger.error('createEvent: Missing required fields');
      return next(new AppError('Title, start, and end are required', 400));
    }

    // Check if case exists if provided
    if (caseId && type !== 'client_meeting') {
      const caseItem = await Case.findById(caseId);
      if (!caseItem) {
        logger.error(`createEvent: Case not found with id ${caseId}`);
        return next(new AppError('Case not found', 404));
      }

      // Check if user has permission to add events to this case
      if (req.user.role === 'client' && caseItem.client.toString() !== req.user.id.toString()) {
        logger.error(`createEvent: Client ${req.user.id} not authorized for case ${caseId}`);
        return next(new AppError('Not authorized to add events to this case', 403));
      }

      if (req.user.role === 'lawyer' && caseItem.lawyer.toString() !== req.user.id.toString()) {
        logger.error(`createEvent: Lawyer ${req.user.id} not authorized for case ${caseId}`);
        return next(new AppError('Not authorized to add events to this case', 403));
      }
    }

    // Create event
    const newEvent = await Event.create({
      title,
      start,
      end,
      type,
      location: location || undefined,
      description: description || undefined,
      case: caseId || undefined,
      caseTitle: caseId ? (await Case.findById(caseId))?.title : undefined,
      caseNumber: caseId ? (await Case.findById(caseId))?.caseNumber : undefined,
      participants: participants || [],
      createdBy: req.user.id,
    });

    // If associated with a case, add event to the case
    if (caseId) {
      await Case.findByIdAndUpdate(caseId, {
        $push: { events: newEvent._id }
      });
    }

    logger.info(`New event created: ${newEvent.title} (ID: ${newEvent._id})`);

    res.status(201).json({
      success: true,
      data: newEvent,
    });
  } catch (error) {
    logger.error(`createEvent: Error: ${error.message}, Stack: ${error.stack}`);
    next(error);
  }
};

/**
 * @desc    Update event
 * @route   PUT /api/events/:id
 * @access  Private
 */
exports.updateEvent = async (req, res, next) => {
  try {
    const eventId = req.params.id;

    // Find event first to check permissions
    const event = await Event.findById(eventId);
    
    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    // Check if user has permission to update this event
    if (req.user.role === 'client') {
      // Clients can only update events they created
      if (event.createdBy.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to update this event', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if event belongs to a case where the lawyer is assigned
      if (event.case) {
        const caseItem = await Case.findById(event.case);
        if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
          return next(new AppError('Not authorized to update this event', 403));
        }
      } else {
        // If not associated with a case, only the creator can update it
        if (event.createdBy.toString() !== req.user.id.toString()) {
          return next(new AppError('Not authorized to update this event', 403));
        }
      }
    }

    // Update event
    const updatedEvent = await Event.findByIdAndUpdate(eventId, {
      ...req.body,
      caseTitle: req.body.case ? (await Case.findById(req.body.case))?.title : undefined,
      caseNumber: req.body.case ? (await Case.findById(req.body.case))?.caseNumber : undefined,
    }, {
      new: true,
      runValidators: true,
    });

    logger.info(`Event updated: ${updatedEvent.title} (ID: ${updatedEvent._id})`);

    res.status(200).json({
      success: true,
      data: updatedEvent,
    });
  } catch (error) {
    logger.error(`Error updating event: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Delete event
 * @route   DELETE /api/events/:id
 * @access  Private
 */
exports.deleteEvent = async (req, res, next) => {
  try {
    const eventId = req.params.id;

    // Find event first to check permissions
    const event = await Event.findById(eventId);
    
    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    // Check if user has permission to delete this event
    if (req.user.role === 'client') {
      // Clients can only delete events they created
      if (event.createdBy.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to delete this event', 403));
      }
    } else if (req.user.role === 'lawyer') {
      // Check if event belongs to a case where the lawyer is assigned
      if (event.case) {
        const caseItem = await Case.findById(event.case);
        if (!caseItem || caseItem.lawyer.toString() !== req.user.id.toString()) {
          return next(new AppError('Not authorized to delete this event', 403));
        }
      } else {
        // If not associated with a case, only the creator can delete it
        if (event.createdBy.toString() !== req.user.id.toString()) {
          return next(new AppError('Not authorized to delete this event', 403));
        }
      }
    }

    // Delete event
    await Event.findByIdAndDelete(eventId);

    logger.info(`Event deleted: ${event.title} (ID: ${event._id})`);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    logger.error(`Error deleting event: ${error.message}`);
    next(error);
  }
};