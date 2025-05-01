const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get user profile
router.get('/profile', userController.getProfile);

// Update user profile
router.put('/profile', userController.updateProfile);

// Change password
router.post('/change-password', userController.changePassword);

// Admin only routes
router.use(authorize('admin'));

// Get all users
router.get('/', userController.getUsers);

// Get single user
router.get('/:id', userController.getUser);

// Create user (admin)
router.post('/', userController.createUser);

// Update user (admin)
router.put('/:id', userController.updateUser);

// Delete user (admin)
router.delete('/:id', userController.deleteUser);

module.exports = router;