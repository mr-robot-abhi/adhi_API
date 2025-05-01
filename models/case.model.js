const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
  // Core Case Information
  title: {
    type: String,
    required: [true, 'Please add a case title'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: false, // Made optional
    default: 'No description provided'
  },

  // Legal Identification
  caseNumber: {
    type: String,
    required: [true, 'Case number is required'],
    match: [/^[A-Z0-9\-_]+$/, 'Invalid case number format'],
    index: true
  },
  caseType: {
    type: String,
    required: true,
    enum: ['civil', 'criminal', 'family', 'commercial', 'writ', 'arbitration']
  },

  // Court Information
  courtState: {
    type: String,
    default: 'karnataka',
    enum: ['karnataka', 'maharashtra', 'delhi']
  },
  district: {
    type: String,
    default: 'bengaluru_urban',
    enum: ['bengaluru_urban', 'bengaluru_rural']
  },
  courtType: {
    type: String,
    enum: ['high_court', 'district_court', 'supreme_court', 'tribunal'],
    default: 'district_court'
  },
  court: { 
    type: String,
    default: 'Bangalore Urban District Court'
  },
  bench: { 
    type: String,
    default: ''
  },
  courtHall: { 
    type: String,
    default: '1'
  },
  courtComplex: { 
    type: String,
    default: 'City Civil Court Complex'
  },

  // Case Timeline
  filingDate: {
    type: Date,
    required: true,
    default: Date.now,
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Filing date cannot be in the future'
    }
  },
  hearingDate: { 
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 1 week from now
  },
  nextHearingDate: { 
    type: Date,
    required: false
  },

  // Parties Information
  petitionerRole: {
    type: String,
    default: 'petitioner',
    enum: ['petitioner', 'appellant', 'complainant']
  },
  petitionerType: {
    type: String,
    default: 'individual',
    enum: ['individual', 'company', 'government']
  },
  petitionerNames: [{
    type: String,
    required: true,
    minlength: [3, 'Name too short'],
    default: ['Anonymous Petitioner']
  }],
  opposingPartyNames: [{
    type: String,
    required: false,
    minlength: [3, 'Name too short'],
    default: []
  }],
  opposingCounsel: { 
    type: String,
    required: false
  },

  // Case Management
  status: {
    type: String,
    default: 'active',
    enum: ['draft', 'active', 'inactive', 'closed', 'archived'],
    index: true
  },
  priority: {
    type: String,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent']
  },
  isUrgent: { 
    type: Boolean, 
    default: false 
  },
  caseStage: {
    type: String,
    default: 'filing',
    enum: ['filing', 'evidence', 'arguments', 'judgment', 'execution', 'appeal']
  },
  actSections: { 
    type: String,
    required: false
  },
  reliefSought: { 
    type: String,
    required: false
  },
  notes: { 
    type: String,
    required: false
  },

  // Relationships
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },
  lawyers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],

  // System Fields
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true
});

// Virtual for hearing count
CaseSchema.virtual('hearingCount').get(function() {
  return this.events?.filter(e => e.type === 'hearing').length || 0;
});

// Auto-generate case number if not provided
CaseSchema.pre('save', function(next) {
  if (!this.caseNumber) {
    const prefix = this.courtType ? this.courtType.substring(0, 3).toUpperCase() : 'GEN';
    this.caseNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
  }
  next();
});

// Cascade deletes
CaseSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    await mongoose.model('Document').deleteMany({ case: this._id });
    await mongoose.model('Event').deleteMany({ case: this._id });
    await mongoose.model('Task').deleteMany({ case: this._id });
    next();
  } catch (err) {
    next(err);
  }
});

// Compound indexes for better query performance
CaseSchema.index({ 
  status: 1,
  hearingDate: 1 
});
CaseSchema.index({
  user: 1,
  isUrgent: 1 
});

// Static method for case statistics
CaseSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
    { 
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        urgent: { 
          $sum: { 
            $cond: [{ $eq: ['$isUrgent', true] }, 1, 0] 
          } 
        }
      }
    }
  ]);
  
  return stats.reduce((acc, curr) => {
    acc[curr._id] = { 
      total: curr.count, 
      urgent: curr.urgent 
    };
    return acc;
  }, {});
};

// Text index for search functionality
CaseSchema.index({
  title: 'text',
  description: 'text',
  caseNumber: 'text',
  petitionerNames: 'text',
  opposingPartyNames: 'text'
});

module.exports = mongoose.model('Case', CaseSchema);