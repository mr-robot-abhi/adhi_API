const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateLogin, validateRegister } = require('../utils/validation');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

// Email/password authentication
router.post('/login', validateLogin, authController.login);
router.post('/register', validateRegister, authController.register);

// Google authentication
router.post('/google', authController.googleAuth);

// Token verification
router.get('/verify', auth.verify, authController.verifyToken);

// Session management
router.post('/logout', auth.verify, authController.logout);
router.post('/refresh', authController.refreshToken);

module.exports = router;