// models/profile.model.js
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  // Reference to User
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Professional Fields
  barCouncilNumber: { 
    type: String,
    required: function() { 
      return this.role === 'lawyer'; 
    }
  },
  specialization: { 
    type: String,
    required: function() { 
      return this.role === 'lawyer'; 
    }
  },
  yearsOfExperience: { 
    type: Number,
    min: 0,
    required: function() { 
      return this.role === 'lawyer'; 
    }
  },
  
  // Contact Information
  phone: { 
    type: String,
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: { 
    type: String 
  },
  bio: { 
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  profileImage: { 
    type: String,
    default: 'https://example.com/default-profile.jpg'
  },
  
  // Settings
  notificationSettings: {
    emailNotifications: { 
      type: Boolean, 
      default: true 
    },
    caseUpdates: { 
      type: Boolean, 
      default: true 
    },
    hearingReminders: { 
      type: Boolean, 
      default: true 
    },
    documentUploads: { 
      type: Boolean, 
      default: true 
    },
    marketingEmails: { 
      type: Boolean, 
      default: false 
    }
  },
  
  securitySettings: {
    twoFactorAuth: { 
      type: Boolean, 
      default: false 
    },
    loginAlerts: { 
      type: Boolean, 
      default: true 
    },
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
      enum: ['english', 'hindi', 'kannada', 'tamil', 'telugu', 'marathi'],
      default: 'english' 
    }
  },
  
  // System Fields
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
ProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create profile when a new user is created
ProfileSchema.statics.createProfileForUser = async function(userId, profileData = {}) {
  try {
    const profile = await this.create({
      user: userId,
      ...profileData
    });
    return profile;
  } catch (error) {
    throw new Error(`Error creating profile: ${error.message}`);
  }
};

// Get profile by user ID
ProfileSchema.statics.getProfileByUserId = async function(userId) {
  try {
    const profile = await this.findOne({ user: userId });
    return profile;
  } catch (error) {
    throw new Error(`Error getting profile: ${error.message}`);
  }
};

module.exports = mongoose.model('Profile', ProfileSchema);