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


module.exports = router;
