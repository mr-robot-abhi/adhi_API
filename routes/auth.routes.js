const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');
const User = require('../models/user.model');

// Validation rules
const loginRules = [
  check('email').isEmail().normalizeEmail(),
  check('password').isLength({ min: 6 })
];

const registerRules = [
  check('name').not().isEmpty().trim().escape(),
  check('email').isEmail().normalizeEmail(),
  check('password').isLength({ min: 8 })
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
    .withMessage('Password must contain at least 8 characters, one uppercase, one lowercase and one number'),
  check('role').optional().isIn(['client', 'lawyer', 'admin'])
];

const googleAuthRules = [
  check('idToken').not().isEmpty()
];

// @route    POST api/auth/login
// @desc     Authenticate user & get token
// @access   Public
router.post('/login', loginRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    
    // Authenticate user
    const { user, token, refreshToken } = await AuthService.loginWithEmail(email, password);
    
    // Set HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      user: user.getPublicProfile(), 
      token 
    });
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ 
      errors: [{ msg: err.message || 'Invalid credentials' }] 
    });
  }
});

// @route    POST api/auth/register
// @desc     Register new user
// @access   Public
router.post('/register', registerRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password, role = 'client' } = req.body;
    
    // Register new user
    const { user, token, refreshToken } = await AuthService.registerWithEmail(
      name, email, password, role
    );
    
    // Set HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ 
      user: user.getPublicProfile(), 
      token 
    });
  } catch (err) {
    console.error(err.message);
    
    if (err.message.includes('already exists')) {
      return res.status(400).json({ 
        errors: [{ msg: err.message }] 
      });
    }
    
    res.status(500).json({ 
      errors: [{ msg: 'Server error' }] 
    });
  }
});

// @route    POST api/auth/google
// @desc     Authenticate with Google
// @access   Public
router.post('/google', googleAuthRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { idToken } = req.body;
    
    // Authenticate with Google
    const { user, token, refreshToken } = await GoogleAuthService.authenticate(idToken);
    
    // Set HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      user: user.getPublicProfile(), 
      token 
    });
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ 
      errors: [{ msg: err.message || 'Google authentication failed' }] 
    });
  }
});

// @route    GET api/auth/verify
// @desc     Verify authentication token
// @access   Private
router.get('/verify', auth.verify, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -securitySettings -__v');
      
    if (!user) {
      return res.status(404).json({ 
        errors: [{ msg: 'User not found' }] 
      });
    }

    res.json({ user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ 
      errors: [{ msg: 'Server error' }] 
    });
  }
});

// @route    POST api/auth/logout
// @desc     Logout user (invalidate token)
// @access   Private
router.post('/logout', auth.verify, async (req, res) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    // Invalidate refresh token
    await TokenService.invalidateRefreshToken(req.user.id);
    
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ 
      errors: [{ msg: 'Server error' }] 
    });
  }
});

// @route    POST api/auth/refresh
// @desc     Refresh access token
// @access   Public (requires valid refresh token)
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        errors: [{ msg: 'No refresh token provided' }] 
      });
    }
    
    // Verify and refresh token
    const { newToken, newRefreshToken } = await TokenService.refreshAccessToken(refreshToken);
    
    // Set new HTTP-only cookie if using cookies
    if (req.cookies.refreshToken) {
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    res.json({ token: newToken });
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ 
      errors: [{ msg: err.message || 'Invalid refresh token' }] 
    });
  }
});

module.exports = router;