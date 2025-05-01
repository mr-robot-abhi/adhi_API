// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const verify = async (req, res, next) => {
  try {
    // Check for token in headers, cookies, or query params
    const token = req.headers.authorization?.split(' ')[1] || 
                 req.cookies?.token || 
                 req.query?.token;
    
    if (!token) {
      return res.status(401).json({ 
        errors: [{ msg: 'No token provided' }] 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        errors: [{ msg: 'User no longer exists' }] 
      });
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({ 
        errors: [{ msg: 'Password changed. Please log in again' }] 
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ 
      errors: [{ msg: 'Invalid token' }] 
    });
  }
};

// Role-based access control
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        errors: [{ msg: 'Unauthorized access' }] 
      });
    }
    next();
  };
};

module.exports = {
  verify,
  checkRole
};