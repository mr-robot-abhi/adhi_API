const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AppError = require('../utils/appError');

// Protect routes - verify token and set req.user
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header, cookies, or query params
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query.token) {
      token = req.query.token;
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({ 
        errors: [{ msg: 'No token provided' }] 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        errors: [{ msg: 'User no longer exists' }] 
      });
    }

    // Check if user changed password after token was issued
      /*if (user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({ 
          errors: [{ msg: 'Password changed. Please log in again' }] 
        });
      }
    }*/
    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    console.error(err.message);
    return res.status(401).json({ 
      errors: [{ msg: 'Invalid token' }] 
    });
  }
};

// Role-based access control (authorize by roles)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        errors: [{ msg: `Role ${req.user.role} is not authorized to access this route` }] 
      });
    }
    next();
  };
};
