const Event = require('../models/event.model');
const Case = require('../models/case.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * @desc    Get all events or filtered events
 * @route   GET /api/events
 * @access  Private
 */
exports.getEvents = async (req, res, next) => {
  try {
    const { search, type, caseId, startDate, endDate } = req.query;

    // Build filter object
    const filter = {};

    // Check user role and filter events accordingly
    if (req.user.role === 'client') {
      // Clients can only see events from their cases
      const clientCases = await Case.find({ client: req.user.id }).select('_id');
      const clientCaseIds = clientCases.map(c => c._id);
      filter.case = { $in: clientCaseIds };
    } else if (req.user.role === 'lawyer') {
      // Lawyers can see events from cases where they are assigned
      const lawyerCases = await Case.find({ lawyer: req.user.id }).select('_id');
      const lawyerCaseIds = lawyerCases.map(c => c._id);
      filter.case = { $in: lawyerCaseIds };
    }
    // Admins can see all events (no additional filter)

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
      filter.date = {};
      
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      
      if (endDate) {
        filter.date.$lte = new Date(endDate);
      }
    }

    // Query events with pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Execute query with populated fields
    const events = await Event.find(filter)
      .populate('case', 'title caseNumber')
      .populate('createdBy', 'name email')
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit);

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
      .populate('attendees', 'name email');

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
    const { title, date, time, type, location, description, caseId, attendees } = req.body;

    // Check if case exists if provided
    if (caseId) {
      const caseItem = await Case.findById(caseId);
      if (!caseItem) {
        return next(new AppError('Case not found', 404));
      }

      // Check if user has permission to add events to this case
      if (req.user.role === 'client' && caseItem.client.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to add events to this case', 403));
      }

      if (req.user.role === 'lawyer' && caseItem.lawyer.toString() !== req.user.id.toString()) {
        return next(new AppError('Not authorized to add events to this case', 403));
      }
    }

    // Create event
    const newEvent = await Event.create({
      title,
      date,
      time,
      type,
      location,
      description,
      case: caseId,
      attendees: attendees || [],
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
    logger.error(`Error creating event: ${error.message}`);
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
    const updatedEvent = await Event.findByIdAndUpdate(eventId, req.body, {
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
