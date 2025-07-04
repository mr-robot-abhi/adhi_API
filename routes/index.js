const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');
const documentRoutes = require('./document.routes');
const eventRoutes = require('./event.routes');
const profileRoutes = require('./profile.routes');
const dashboardRoutes = require('./dashboard.routes');
const notificationRoutes = require('./notification.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', documentRoutes);
router.use('/events', eventRoutes);
router.use('/profile', profileRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;