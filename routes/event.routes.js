const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get all events or filtered events
router.get('/', eventController.getEvents);

// Get single event by ID
router.get('/:id', eventController.getEvent);

// Create new event
router.post('/', eventController.createEvent);

// Update event
router.put('/:id', eventController.updateEvent);

// Delete event
router.delete('/:id', eventController.deleteEvent);

module.exports = router;