const Notification = require('../models/notification.model');
const AppError = require('../utils/appError');

// Get all notifications for the logged-in user
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return next(new AppError('Notification not found', 404));
    res.status(200).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

// Create a notification (for system use)
exports.createNotification = async (req, res, next) => {
  try {
    const { user, type, message, link, meta } = req.body;
    const notification = await Notification.create({ user, type, message, link, meta });
    res.status(201).json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

// Delete a notification
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!notification) return next(new AppError('Notification not found', 404));
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}; 