const jwt = require('jsonwebtoken');
const logger = require('./logger');

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    logger.error(`JWT verification error: ${error.message}`);
    return null;
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error(`JWT decoding error: ${error.message}`);
    return null;
  }
};

module.exports = {
  generateTokens,
  verifyToken,
  decodeToken
};
