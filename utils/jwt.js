const jwt = require('jsonwebtoken');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

// Generate JWT access token
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

// Generate JWT refresh token
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

// Generate both access and refresh tokens
const generateTokens = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};

// Verify JWT token (either access or refresh)
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret, { issuer: 'adhi-api' });
  } catch (error) {
    logger.error(`JWT verification error: ${error.message}`);
    return null;
  }
};

// Decode JWT token without verification (useful for extracting payload)
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    logger.error(`JWT decoding error: ${error.message}`);
    return null;
  }
};

// Generate JWT token (for older style token generation)
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  decodeToken,
  generateToken
};
