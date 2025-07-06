const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get user profile
router.get('/profile', profileController.getProfile);

// Update user profile
router.put('/profile', profileController.updateProfile);

// Change password
router.post('/change-password', profileController.changePassword);

// Update notification settings
router.put('/notifications', profileController.updateNotifications);

// Update security settings
router.put('/security', profileController.updateSecurity);

// Update appearance settings
router.put('/appearance', profileController.updateAppearance);

module.exports = router;
