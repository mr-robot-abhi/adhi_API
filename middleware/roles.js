// middleware/roles.js
const Case = require('../models/case.model');
const Document = require('../models/document.model');
const Event = require('../models/event.model');

// Higher-order function for role authorization
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        errors: [{ 
          msg: `Role ${req.user.role} is not authorized to access this resource` 
        }]
      });
    }
    next();
  };
};

// Resource ownership checker
exports.checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params.id);
      
      if (!resource) {
        return res.status(404).json({
          errors: [{ msg: 'Resource not found' }]
        });
      }

      // Check ownership based on model type
      let isOwner = false;
      
      if (model.modelName === 'Case') {
        isOwner = resource.user.equals(req.user._id) || 
                 resource.lawyers.includes(req.user._id);
      } 
      else if (model.modelName === 'Document') {
        isOwner = resource.owner.equals(req.user._id) ||
                 resource.accessibleTo.some(a => a.user.equals(req.user._id));
      }
      else if (model.modelName === 'Event') {
        isOwner = resource.createdBy.equals(req.user._id) ||
                 resource.participants.some(p => p.user.equals(req.user._id));
      }
      else {
        // Default ownership check
        isOwner = resource.user.equals(req.user._id);
      }

      if (!isOwner) {
        return res.status(403).json({
          errors: [{ msg: 'Not authorized to access this resource' }]
        });
      }

      req.resource = resource;
      next();
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
  };
};