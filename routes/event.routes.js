const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Event = require('../models/event.model');
const Case = require('../models/case.model');
const auth = require('../middleware/auth');
const authorize = require('../middleware/roles');


// Validation rules
const eventRules = [
  check('title').not().isEmpty().trim().escape(),
  check('start').isISO8601(),
  check('end').isISO8601(),
  check('type').isIn([
    'hearing', 'case_filing', 'evidence_submission',
    'client_meeting', 'court_visit', 'mediation',
    'arbitration', 'judgment', 'appeal'
  ]),
  check('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  check('participants.*.user').optional().isMongoId(),
  check('participants.*.role').optional().isIn(['lawyer', 'client', 'witness', 'judge', 'opposing_counsel'])
];

// @route    POST api/events
// @desc     Create new event
// @access   Private
router.post('/', 
  auth.verify,
  eventRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
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

      // Create event
      const eventData = {
        ...req.body,
        createdBy: req.user.id,
        caseTitle: caseDetails?.title,
        caseNumber: caseDetails?.caseNumber
      };

      const event = await EventService.createEvent(eventData);

      // Schedule reminders
      if (req.body.reminders) {
        await NotificationService.scheduleEventReminders(event);
      }

      res.status(201).json(event);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    GET api/events
// @desc     Get events with filters
// @access   Private
router.get('/', auth.verify, async (req, res) => {
  try {
    let query = {
      $or: [
        { createdBy: req.user.id },
        { 'participants.user': req.user.id }
      ]
    };

    // Date range filter
    if (req.query.start && req.query.end) {
      query.start = {
        $gte: new Date(req.query.start),
        $lte: new Date(req.query.end)
      };
    }

    // Single date filter
    if (req.query.date) {
      const start = new Date(req.query.date);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(req.query.date);
      end.setHours(23, 59, 59, 999);
      
      query.start = { $gte: start, $lte: end };
    }

    // Type filter
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Case filter
    if (req.query.case) {
      query.case = req.query.case;
    }

    // Status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Priority filter
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    const events = await Event.find(query)
      .sort({ start: 1 })
      .populate('case', 'title caseNumber')
      .populate('participants.user', 'name email role');

    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/events/case/:caseId
// @desc     Get events for a specific case
// @access   Private
router.get('/case/:caseId', auth.verify, async (req, res) => {
  try {
    // Verify case access
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

    const events = await Event.find({ case: req.params.caseId })
      .sort({ start: 1 })
      .populate('participants.user', 'name email');

    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    GET api/events/:id
// @desc     Get single event
// @access   Private
router.get('/:id', auth.verify, async (req, res) => {
  try {
    const event = await Event.findOne({
      _id: req.params.id,
      $or: [
        { createdBy: req.user.id },
        { 'participants.user': req.user.id }
      ]
    })
    .populate('case', 'title caseNumber')
    .populate('participants.user', 'name email role');

    if (!event) {
      return res.status(404).json({ errors: [{ msg: 'Event not found or unauthorized' }] });
    }

    res.json(event);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    PUT api/events/:id
// @desc     Update event
// @access   Private
router.put('/:id',
  auth.verify,
  eventRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Verify event exists and user has access
      const existingEvent = await Event.findOne({
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'participants.user': req.user.id, 'participants.role': 'lawyer' }
        ]
      });

      if (!existingEvent) {
        return res.status(404).json({ errors: [{ msg: 'Event not found or unauthorized' }] });
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

      const updateData = {
        ...req.body,
        updatedAt: Date.now(),
        caseTitle: caseDetails?.title,
        caseNumber: caseDetails?.caseNumber
      };

      const updatedEvent = await EventService.updateEvent(
        req.params.id,
        updateData
      );

      // Update scheduled reminders
      if (req.body.reminders) {
        await NotificationService.cancelEventReminders(req.params.id);
        await NotificationService.scheduleEventReminders(updatedEvent);
      }

      res.json(updatedEvent);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    DELETE api/events/:id
// @desc     Delete event
// @access   Private
router.delete('/:id', 
  auth.verify,
  async (req, res) => {
    try {
      // Verify event exists and user has access
      const event = await Event.findOne({
        _id: req.params.id,
        $or: [
          { createdBy: req.user.id },
          { 'participants.user': req.user.id, 'participants.role': 'lawyer' }
        ]
      });

      if (!event) {
        return res.status(404).json({ errors: [{ msg: 'Event not found or unauthorized' }] });
      }

      // Cancel any scheduled reminders
      await NotificationService.cancelEventReminders(req.params.id);

      await EventService.deleteEvent(req.params.id);

      res.json({ msg: 'Event deleted successfully' });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

module.exports = router;