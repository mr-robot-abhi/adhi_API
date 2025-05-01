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
    required: [true, 'Please add a description']
  },

  // Legal Identification
  caseNumber: {
    type: String,
    unique: true,
    required: [true, 'Case number is required'],
    match: [/^[A-Z0-9\-_]+$/, 'Invalid case number format']
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
    enum: ['karnataka', 'maharashtra', 'delhi'] // Add more as needed
  },
  district: {
    type: String,
    default: 'bengaluru_urban',
    enum: ['bengaluru_urban', 'bengaluru_rural'] // Add more districts
  },
  courtType: {
    type: String,
    enum: ['high_court', 'district_court', 'supreme_court', 'tribunal']
  },
  court: { type: String },
  bench: { type: String },
  courtHall: { type: String },
  courtComplex: { type: String },

  // Case Timeline
  filingDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v <= new Date();
      },
      message: 'Filing date cannot be in the future'
    }
  },
  hearingDate: { type: Date },
  nextHearingDate: { type: Date },

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
    minlength: [3, 'Name too short']
  }],
  opposingRole: {
    type: String,
    default: 'defendant',
    enum: ['defendant', 'respondent', 'accused']
  },
  opposingPartyNames: [{
    type: String,
    required: true,
    minlength: [3, 'Name too short']
  }],
  opposingCounsel: { type: String },

  // Case Management
  status: {
    type: String,
    default: 'active',
    enum: ['draft', 'active', 'inactive', 'closed', 'archived']
  },
  priority: {
    type: String,
    default: 'normal',
    enum: ['low', 'normal', 'high', 'urgent']
  },
  isUrgent: { type: Boolean, default: false },
  caseStage: {
    type: String,
    default: 'filing',
    enum: ['filing', 'evidence', 'arguments', 'judgment', 'execution', 'appeal']
  },
  actSections: { type: String },
  reliefSought: { type: String },
  notes: { type: String },

  // Relationships
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
  toObject: { virtuals: true }
});

// Virtual for hearing count
CaseSchema.virtual('hearingCount').get(function() {
  return this.events?.filter(e => e.type === 'hearing').length || 0;
});

// Update timestamp before saving
CaseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-generate case number if not provided
  if (!this.caseNumber) {
    this.caseNumber = `${this.courtType?.substr(0, 3) || 'GEN'}-${Date.now().toString().slice(-6)}`;
  }
  
  next();
});

// Cascade deletes
CaseSchema.pre('remove', async function(next) {
  await this.model('Document').deleteMany({ case: this._id });
  await this.model('Event').deleteMany({ case: this._id });
  await this.model('Task').deleteMany({ case: this._id });
  next();
});

// Indexes for faster queries
CaseSchema.index({ caseNumber: 1 });
CaseSchema.index({ status: 1 });
CaseSchema.index({ hearingDate: 1 });
CaseSchema.index({ user: 1 });
CaseSchema.index({ client: 1 });

// Static method for case statistics
CaseSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { user: userId } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      urgent: { $sum: { $cond: [{ $eq: ['$isUrgent', true] }, 1, 0] } }
    }}
  ]);
  
  return stats.reduce((acc, curr) => {
    acc[curr._id] = { total: curr.count, urgent: curr.urgent };
    return acc;
  }, {});
};

module.exports = mongoose.model('Case', CaseSchema);