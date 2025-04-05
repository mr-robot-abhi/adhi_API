const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'closed'],
    default: 'open'
  },
  client: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
CaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Cascade delete documents when a case is deleted
CaseSchema.pre('remove', async function(next) {
  await this.model('Document').deleteMany({ case: this._id });
  await this.model('CalendarEvent').deleteMany({ case: this._id });
  next();
});

module.exports = mongoose.model('Case', CaseSchema);
