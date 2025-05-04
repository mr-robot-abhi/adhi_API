const User = require('../models/user.model');
const Profile = require('../models/profile.model');
const { generateToken, verifyToken } = require('../utils/jwt');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

// Firebase Admin SDK init (recommended to move to its own module)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * @desc    Google login
 */
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return next(new AppError('No ID token provided', 400));

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    let user = await User.findOne({ firebaseUID: uid }) || await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || 'Google User',
        email,
        password: Math.random().toString(36).slice(-8),
        firebaseUID: uid,
        role: 'client',
        isEmailVerified: true,
      });

      await Profile.create({
        user: user._id,
        profileImage: picture || undefined,
      });
    } else if (!user.firebaseUID) {
      user.firebaseUID = uid;
      await user.save();
    }

    const token = user.generateAuthToken();

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.status(200).json({ success: true, token, user: userData });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Register new user
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address, bio } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return next(new AppError('User already exists with this email', 400));

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'lawyer',
    });

    await Profile.create({
      user: user._id,
      phone,
      address,
      bio,
    });

    const token = generateToken(user._id);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    logger.info(`New user registered: ${email}`);
    res.status(201).json({ success: true, token, user: userData });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
};


/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Check if password matches
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Update last login timestamp
    user.lastLogin = Date.now();
    await user.save();

    // Return user data without password
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    logger.info(`User logged in: ${email}`);

    res.status(200).json({
      success: true,
      token,
      user: userData,
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * @desc    Verify JWT token
 * @route   GET /api/auth/verify
 * @access  Public
 */
exports.verifyToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('No token provided', 400));
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new AppError('Invalid token or user not found', 401));
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(new AppError('Invalid token', 401));
  }
};

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return a success response even if the email doesn't exist
    // This is to prevent email enumeration attacks
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;

    // In a real application, you would send an email with the reset URL
    // For this example, we'll just log it
    logger.info(`Password reset URL for ${email}: ${resetUrl}`);

    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError('Invalid or expired token', 400));
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new JWT token
    const jwtToken = generateToken(user._id);

    logger.info(`Password reset successful for user: ${user.email}`);

    res.status(200).json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if current password is correct
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordMatch) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error(`Change password error: ${error.message}`);
    next(error);
  }
};