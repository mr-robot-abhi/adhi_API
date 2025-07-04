const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['case', 'event', 'document', 'other'], required: true },
  message: { type: String, required: true },
  link: { type: String }, // e.g., /dashboard/cases/123
  read: { type: Boolean, default: false },
  meta: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema); 