const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

// Register new user
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Get current user
router.get('/me', authMiddleware, authController.getMe);

// Refresh token
router.post('/refresh', authController.refreshToken);

// Logout
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
