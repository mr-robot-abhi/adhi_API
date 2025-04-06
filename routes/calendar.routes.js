const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const { verify: authMiddleware } = require('../middleware/auth');

// Create calendar event
router.post('/', authMiddleware, calendarController.createEvent);

// Get all events
router.get('/', authMiddleware, calendarController.getAllEvents);

// Get events for case
router.get('/case/:caseId', authMiddleware, calendarController.getCaseEvents);

// Update event
router.put('/:id', authMiddleware, calendarController.updateEvent);

// Delete event
router.delete('/:id', authMiddleware, calendarController.deleteEvent);

module.exports = router;
