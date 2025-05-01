const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  // Authentication Fields (from Vercel template)
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  
  // Profile Fields (from your original schema)
  name: { 
    type: String, 
    required: [true, 'Please provide your name'] 
  },
  phone: { 
    type: String,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: { type: String },
  bio: { type: String },
  
  // Professional Fields
  barCouncilNumber: { 
    type: String,
    required: function() { return this.role === 'lawyer'; }
  },
  specialization: { 
    type: String,
    required: function() { return this.role === 'lawyer'; }
  },
  yearsOfExperience: { 
    type: Number,
    min: 0,
    required: function() { return this.role === 'lawyer'; }
  },
  profileImage: { 
    type: String,
    default: 'https://example.com/default-profile.jpg'
  },

  // Role Management
  role: {
    type: String,
    enum: ['client', 'lawyer', 'admin'],
    default: 'client',
    required: true
  },

  // Settings (from your original schema)
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    caseUpdates: { type: Boolean, default: true },
    hearingReminders: { type: Boolean, default: true },
    documentUploads: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },
  securitySettings: {
    twoFactorAuth: { type: Boolean, default: false },
    loginAlerts: { type: Boolean, default: true },
    sessionTimeout: { 
      type: Number, 
      default: 30,
      min: 5,
      max: 1440 
    }
  },
  appearanceSettings: {
    theme: { 
      type: String, 
      enum: ['light', 'dark', 'system'],
      default: 'system' 
    },
    fontSize: { 
      type: String, 
      enum: ['small', 'medium', 'large'],
      default: 'medium' 
    },
    language: { 
      type: String, 
      enum: ['english', 'hindi', 'marathi'],
      default: 'english' 
    }
  },

  // System Fields
  firebaseUID: { type: String }, // For Firebase integration
  isEmailVerified: { type: Boolean, default: false },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for cases (will be populated when needed)
UserSchema.virtual('cases', {
  ref: 'Case',
  localField: '_id',
  foreignField: 'user'
});

// Password Hashing Middleware
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Update timestamp on save
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Password Comparison Method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// JWT Generation Method
UserSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role,
      email: this.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Profile sanitization method for responses
UserSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.securitySettings;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', UserSchema);