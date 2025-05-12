const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  // Event Identification
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },

  // Event Timing
  start: {
    type: Date,
    required: [true, 'Start date/time is required'],
    validate: {
      validator: function(v) {
        // Allow dates within 1 hour of now to account for time zone issues
        return v > new Date(Date.now() - 60 * 60 * 1000);
      },
      message: 'Start date must be in the near future'
    }
  },
  end: {
    type: Date,
    required: [true, 'End date/time is required']
  },
  allDay: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },

  // Event Type Details
  type: {
    type: String,
    required: true,
    enum: [
      'hearing', 'case_filing', 'evidence_submission',
      'client_meeting', 'court_visit', 'mediation',
      'arbitration', 'judgment', 'appeal'
    ],
    default: 'hearing'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'cancelled', 'completed', 'adjourned'],
    default: 'scheduled'
  },

  // Location Information
  location: {
    type: String,
    required: function() {
      return this.type === 'court_visit' || this.type === 'hearing';
    }
  },
  address: {
    type: String
  },
  isVirtual: {
    type: Boolean,
    default: false
  },
  meetingLink: {
    type: String,
    validate: {
      validator: function(v) {
        return this.isVirtual ? /^https?:\/\//.test(v) : true;
      },
      message: 'Virtual events require a valid meeting link'
    }
  },

  // Related Case
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: function() {
      return this.type !== 'client_meeting';
    }
  },
  caseTitle: {
    type: String
    // Removed required to avoid validation errors
  },
  caseNumber: {
    type: String
    // Removed required to avoid validation errors
  },

  // Participants
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['lawyer', 'client', 'witness', 'judge', 'opposing_counsel']
    },
    status: {
      type: String,
      enum: ['invited', 'confirmed', 'declined'],
      default: 'invited'
    }
  }],

  // Reminders and Notifications
  reminders: [{
    method: {
      type: String,
      enum: ['email', 'sms', 'push'],
      required: true
    },
    minutesBefore: {
      type: Number,
      required: true,
      min: [1, 'Reminder must be at least 1 minute before']
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  lastReminderSent: {
    type: Date
  },

  // System Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for event duration (in minutes)
EventSchema.virtual('duration').get(function() {
  return (this.end - this.start) / (1000 * 60);
});

// Virtual for upcoming status
EventSchema.virtual('isUpcoming').get(function() {
  return this.start > new Date() && this.status === 'scheduled';
});

// Validate end date after start date
EventSchema.pre('save', function(next) {
  if (this.end <= this.start) {
    throw new Error('End date must be after start date');
  }

  // Auto-set case number if not provided
  if (this.case && !this.caseNumber) {
    this.caseNumber = this.case.caseNumber;
  }

  this.updatedAt = Date.now();
  next();
});

// Cascade updates to case when hearing events change
EventSchema.post('save', async function(doc) {
  if (doc.type === 'hearing' && doc.case) {
    await mongoose.model('Case').updateOne(
      { _id: doc.case },
      { $set: { nextHearingDate: doc.start } }
    );
  }
});

// Indexes for optimized queries
EventSchema.index({ start: 1 });
EventSchema.index({ end: 1 });
EventSchema.index({ type: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ case: 1 });
EventSchema.index({ createdBy: 1 });
EventSchema.index({ 'participants.user': 1 });

// Static method for calendar view
EventSchema.statics.getCalendarEvents = async function(userId, startDate, endDate) {
  return this.find({
    $or: [
      { createdBy: userId },
      { 'participants.user': userId }
    ],
    start: { $gte: startDate },
    end: { $lte: endDate },
    status: { $ne: 'cancelled' }
  }).sort({ start: 1 });
};

// Static method for case timeline
EventSchema.statics.getCaseTimeline = async function(caseId) {
  return this.find({ case: caseId })
    .sort({ start: 1 })
    .select('-reminders -participants.status');
};

module.exports = mongoose.model('Event', EventSchema);