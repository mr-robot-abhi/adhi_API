require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { admin } = require('./config/firebase');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connections
connectDB(); // MongoDB
console.log('Firebase initialized:', !!admin); // Verify Firebase

// Routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);
app.use('/api/cases', require('./routes/case.routes'));
app.use('/api/documents', require('./routes/document.routes'));
app.use('/api/calendar', require('./routes/calendar.routes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
