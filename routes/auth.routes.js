const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.register); // Changed from signup to register to match controller
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:oobCode', authController.resetPassword); // The param should match 'oobCode' as per your controller
// router.post('/google', authController.googleLogin); // Commented out as googleLogin not implemented

// Protected routes
router.use(protect); // Ensure all below routes are protected by the 'protect' middleware

router.get('/me', authController.getMe); // Changed from getUserProfile to getMe to match controller
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword); // Exists in controller

// Verify token route for checking token validity
router.post('/verify', authController.verifyToken); // Matches controller

module.exports = router;
