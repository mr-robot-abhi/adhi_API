const jwt = require('jsonwebtoken');

const verify = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const checkRole = (role) => {
  return (req, res, next) => {
    if (req.userRole !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

module.exports = {
  verify,
  checkRole,
};
