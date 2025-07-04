const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

router.use(protect);

// Get all notifications for the logged-in user
router.get('/', notificationController.getNotifications);

// Create a notification (system use)
router.post('/', notificationController.createNotification);

// Mark a notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Delete a notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router; 