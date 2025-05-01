const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get dashboard summary
router.get('/summary', dashboardController.getSummary);

// Get recent cases
router.get('/recent-cases', dashboardController.getRecentCases);

// Get upcoming events
router.get('/upcoming-events', dashboardController.getUpcomingEvents);

module.exports = router;