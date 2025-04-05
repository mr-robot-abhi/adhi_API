const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { generateTokens } = require('../utils/jwt');

exports.register = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({ email, password, role });
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({ 
      user: { id: user._id, email: user.email, role: user.role },
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    res.json({ 
      user: { id: user._id, email: user.email, role: user.role },
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Other auth controller methods...
