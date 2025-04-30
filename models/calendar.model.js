const mongoose = require('mongoose');

const CalendarEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add an event title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: false
  },
  start: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  end: {
    type: Date,
    required: [true, 'Please add an end date']
  },
  case: {
    type: mongoose.Schema.ObjectId,
    ref: 'Case',
    required: false
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure end date is after start date
CalendarEventSchema.pre('save', function(next) {
  if (this.end < this.start) {
    throw new Error('End date must be after start date');
  }
  next();
});

module.exports = mongoose.model('CalendarEvent', CalendarEventSchema);
