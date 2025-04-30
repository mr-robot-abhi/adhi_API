const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const admin = require('../config/firebase').admin;
const { validatePassword } = require('../utils/validation');

// Enhanced Google Auth
exports.googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    const decoded = await admin.auth().verifyIdToken(idToken);
    
    let user = await User.findOne({ uid: decoded.uid });
    if (!user) {
      user = new User({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || 'New User',
        role: 'client' // Default role for Google signups
      });
      await user.save();
    }

    const tokens = generateTokens(user);
    res.json({ user, ...tokens });
  } catch (error) {
    res.status(401).json({ message: 'Google auth failed' });
  }
};

// Email/Password Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().signInWithEmailAndPassword(email, password);

    const user = await User.findOne({ uid: userRecord.uid });
    if (!user) throw new Error('User not registered');

    const tokens = generateTokens(user);
    res.json({ 
      user,
      redirect: user.role === 'lawyer' ? '/lawyer-dashboard' : '/client-dashboard',
      ...tokens 
    });
  } catch (error) {
    res.status(401).json({ message: 'Login failed' });
  }
};

// Registration
exports.register = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    // Create Firebase user
    const userRecord = await admin.auth().createUser({ email, password });
    
    // Create database user
    const user = new User({
      uid: userRecord.uid,
      email,
      name,
      role
    });
    await user.save();

    const tokens = generateTokens(user);
    res.status(201).json({ 
      user,
      redirect: role === 'lawyer' ? '/lawyer-dashboard' : '/client-dashboard',
      ...tokens 
    });
  } catch (error) {
    res.status(400).json({ message: 'Registration failed' });
  }
};

// Token Verification
exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw new Error('User not found');
    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    // In a real implementation, you would invalidate the tokens here
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
};

// Token Refresh
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) throw new Error('User not found');

    const newTokens = generateTokens(user);
    res.json(newTokens);
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// Helper function
function generateTokens(user) {
  return {
    accessToken: jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    ),
    refreshToken: jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )
  };
}