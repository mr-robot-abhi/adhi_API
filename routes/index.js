const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');
const documentRoutes = require('./document.routes');
const eventRoutes = require('./event.routes');
const userRoutes = require('./users.routes');
const dashboardRoutes = require('./dashboard.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', documentRoutes);
router.use('/events', eventRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;