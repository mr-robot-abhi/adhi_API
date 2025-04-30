exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

exports.checkOwnership = (model) => {
  return async (req, res, next) => {
    let resource = await model.findById(req.params.id);
    
    if (!resource) {
      return res.status(404).json({
        message: 'Resource not found'
      });
    }

    // Check if user is admin or the creator of the resource
    if (req.user.role !== 'admin' && resource.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized to modify this resource'
      });
    }

    next();
  };
};
