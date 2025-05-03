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

// Admin only routes
router.use(authorize('admin'));

// Get all users
router.get('/', profileController.getUsers);

// Get single user
router.get('/:id', profileController.getUser);

// Create user (admin)
router.post('/', profileController.createUser);

// Update user (admin)
router.put('/:id', profileController.updateUser);

// Delete user (admin)
router.delete('/:id', profileController.deleteUser);

module.exports = router;
