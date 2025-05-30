const mongoose = require('mongoose');
const path = require('path');

const DocumentSchema = new mongoose.Schema({
  // ========== File Identification ==========
  name: {
    type: String,
    required: [true, 'Document name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // ========== File Metadata ==========
  type: {
    type: String,
    required: true,
    enum: [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'txt', 'jpg', 'jpeg', 'png', 'gif', 'csv', 'zip', 'rar'
    ]
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [1, 'File size must be at least 1 byte']
  },
  extension: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: [true, 'Storage path is required']
  },
  thumbnailPath: {
    type: String
  },

  // ========== Document Metadata ==========
  category: {
    type: String,
    enum: [
      'pleading', 'affidavit', 'evidence', 'contract',
      'judgment', 'order', 'notice', 'memo', 'report'
    ]
  },
  tags: [{
    type: String,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'deleted'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  isConfidential: {
    type: Boolean,
    default: false
  },

  // ========== Ownership & Permissions ==========
  case: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    required: true
  },
  caseTitle: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedByName: {
    type: String,
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessibleTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'download', 'edit'],
      default: 'view'
    }
  }],

  // ========== Auditing ==========
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  accessLogs: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['view', 'download', 'edit'] },
    timestamp: { type: Date, default: Date.now }
  }],

  // ========== Timestamps ==========
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== Virtuals ==========
DocumentSchema.virtual('downloadUrl').get(function () {
  return `/api/v1/documents/${this._id}/download`;
});

DocumentSchema.virtual('thumbnailUrl').get(function () {
  return this.thumbnailPath ? `/api/v1/documents/${this._id}/thumbnail` : null;
});

// ========== Hooks ==========
DocumentSchema.pre('save', function (next) {
  if (this.originalName) {
    this.extension = path.extname(this.originalName).toLowerCase().replace('.', '');
  }
  this.updatedAt = Date.now();
  next();
});

// ========== Instance Methods ==========
DocumentSchema.methods.softDelete = async function () {
  this.status = 'deleted';
  this.deletedAt = Date.now();
  await this.save();
};

DocumentSchema.methods.hasAccess = function (userId, requiredPermission = 'view') {
  if (this.owner.equals(userId)) return true;

  const access = this.accessibleTo.find(a => a.user.equals(userId));
  if (!access) return false;

  const permissionLevels = { view: 1, download: 2, edit: 3 };
  return permissionLevels[access.permission] >= permissionLevels[requiredPermission];
};

// ========== Static Methods ==========
DocumentSchema.statics.getStatsByCase = async function (caseId) {
  return this.aggregate([
    { $match: { case: caseId, status: { $ne: 'deleted' } } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        totalSize: 1,
        _id: 0
      }
    }
  ]);
};

// ========== Indexes ==========
DocumentSchema.index({ name: 'text', description: 'text', tags: 'text' });
DocumentSchema.index({ case: 1 });
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ owner: 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ createdAt: -1 });
DocumentSchema.index({ isConfidential: 1 });

module.exports = mongoose.model('Document', DocumentSchema);
