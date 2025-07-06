const Profile = require('../models/profile.model');
const User = require('../models/user.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get user profile
 * @route   GET /api/profile/profile
 * @access  Private
 */
exports.getProfile = async (req, res, next) => {
  try {
    // First get the user profile
    let profile = await Profile.findOne({ user: req.user.id });
    
    // If profile doesn't exist, create one
    if (!profile) {
      profile = await Profile.create({
        user: req.user.id,
        name: req.user.name,
        email: req.user.email
      });
    }
    
    // Get user data and merge with profile
    const user = await User.findById(req.user.id).select('-password');
    
    const profileData = {
      ...user.toObject(),
      ...profile.toObject(),
      // Remove duplicate fields
      _id: user._id,
      user: undefined
    };
    
    res.status(200).json({
      success: true,
      data: profileData
    });
  } catch (error) {
    logger.error(`Error getting user profile: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/profile/profile
 * @access  Private
 */
exports.updateProfile = async (req, res, next) => {
  try {
    // Don't allow direct password updates
    const { password, role, _id, ...updateData } = req.body;
    
    // Update user basic info
    const userUpdateData = {
      name: updateData.name,
      email: updateData.email
    };
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      userUpdateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!updatedUser) {
      return next(new AppError('User not found', 404));
    }
    
    // Update or create profile
    const profileData = {
      phone: updateData.phone,
      address: updateData.address,
      bio: updateData.bio,
      barCouncilNumber: updateData.barCouncilNumber,
      specialization: updateData.specialization,
      yearsOfExperience: updateData.yearsOfExperience
    };
    
    let profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      profileData,
      { new: true, upsert: true, runValidators: true }
    );
    
    logger.info(`User profile updated: ${updatedUser.email}`);
    
    // Return combined data
    const responseData = {
      ...updatedUser.toObject(),
      ...profile.toObject(),
      _id: updatedUser._id,
      user: undefined
    };
    
    res.status(200).json({
      success: true,
      data: responseData
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
 * @desc    Update notification settings
 * @route   PUT /api/users/notifications
 * @access  Private
 */
exports.updateNotifications = async (req, res, next) => {
  try {
    const notificationSettings = req.body;
    
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { notificationSettings },
      { new: true, upsert: true, runValidators: true }
    );
    
    logger.info(`Notification settings updated for user: ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: profile.notificationSettings
    });
  } catch (error) {
    logger.error(`Error updating notification settings: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update security settings
 * @route   PUT /api/users/security
 * @access  Private
 */
exports.updateSecurity = async (req, res, next) => {
  try {
    const securitySettings = req.body;
    
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { securitySettings },
      { new: true, upsert: true, runValidators: true }
    );
    
    logger.info(`Security settings updated for user: ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: profile.securitySettings
    });
  } catch (error) {
    logger.error(`Error updating security settings: ${error.message}`);
    next(error);
  }
};

/**
 * @desc    Update appearance settings
 * @route   PUT /api/users/appearance
 * @access  Private
 */
exports.updateAppearance = async (req, res, next) => {
  try {
    const appearanceSettings = req.body;
    
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { appearanceSettings },
      { new: true, upsert: true, runValidators: true }
    );
    
    logger.info(`Appearance settings updated for user: ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      data: profile.appearanceSettings
    });
  } catch (error) {
    logger.error(`Error updating appearance settings: ${error.message}`);
    next(error);
  }
};