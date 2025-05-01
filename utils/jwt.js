const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      jti: uuidv4()
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
      issuer: 'adhi-api'
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      jti: uuidv4()
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: 'adhi-api'
    }
  );
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret, { issuer: 'adhi-api' });
  } catch (error) {
    logger.error(`JWT verification error: ${error.message}`);
    return null;
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    logger.error(`JWT decoding error: ${error.message}`);
    return null;
  }
};

const generateTokens = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  decodeToken
};