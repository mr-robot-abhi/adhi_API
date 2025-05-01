// users.routes.js
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/user.model');
const UserService = require('../services/user.service');

// Validation rules
const profileUpdateRules = [
  check('name').optional().trim().escape(),
  check('phone').optional().isMobilePhone(),
  check('address').optional().trim().escape(),
  check('bio').optional().trim().escape(),
  check('specialization').optional().trim().escape(),
  check('yearsOfExperience').optional().isInt({ min: 0 })
];

const passwordChangeRules = [
  check('currentPassword').not().isEmpty(),
  check('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/)
    .withMessage('Password must contain at least 8 characters, one uppercase, one lowercase and one number')
];

// @route    GET api/users/profile
// @desc     Get current user's profile
// @access   Private
router.get('/profile', auth.verify, async (req, res) => {
  try {
    const user = await UserService.getUserProfile(req.user.id);
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: [{ msg: 'Server error' }] });
  }
});

// @route    PUT api/users/profile
// @desc     Update profile
// @access   Private
router.put('/profile', 
  auth.verify,
  profileUpdateRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Don't allow direct role or email updates
      const { role, email, password, ...updateData } = req.body;
      
      const updatedUser = await UserService.updateUserProfile(
        req.user.id,
        updateData
      );

      res.json(updatedUser);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

// @route    POST api/users/change-password
// @desc     Change password
// @access   Private
router.post('/change-password',
  auth.verify,
  passwordChangeRules,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      
      await UserService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );

      res.json({ msg: 'Password updated successfully' });
    } catch (err) {
      console.error(err.message);
      if (err.message.includes('Current password is incorrect')) {
        return res.status(400).json({ errors: [{ msg: err.message }] });
      }
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  }
);

module.exports = router;