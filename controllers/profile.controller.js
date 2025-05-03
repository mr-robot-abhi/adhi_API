const User = require('../models/profile.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error getting user profile: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // Don't allow direct password updates
    const { password, role, ...updateData } = req.body;
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return next(new AppError('User not found', 404));
    }
    
    logger.info(`User profile updated: ${updatedUser.email}`);
    
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error updating user profile: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   POST /api/users/change-password
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
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error(`Error changing password: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private (Admin only)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    logger.error(`Error getting users: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private (Admin only)
 */
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error getting user: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Create user
 * @route   POST /api/users
 * @access  Private (Admin only)
 */
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      return next(new AppError('User already exists with this email', 400));
    }
    
    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client'
    });
    
    logger.info(`User created by admin: ${email}`);
    
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin only)
 */
exports.updateUser = async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return next(new AppError('User not found', 404));
    }
    
    logger.info(`User updated by admin: ${updatedUser.email}`);
    
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Admin only)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    logger.info(`User deleted by admin: ${user.email}`);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`);
    next(error);
  }
};