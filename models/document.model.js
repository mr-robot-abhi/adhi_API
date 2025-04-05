const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a document name'],
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'png'],
    required: true
  },
  case: {
    type: mongoose.Schema.ObjectId,
    ref: 'Case',
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  size: {
    type: Number,
    required: true
  }
});

// Add text index for search functionality
DocumentSchema.index({ name: 'text' });

module.exports = mongoose.model('Document', DocumentSchema);
