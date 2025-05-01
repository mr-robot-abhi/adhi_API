// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./utils/logger'); // Add this line

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Database connections
connectDB(); // MongoDB

// Verify Firebase
const { admin } = require('./config/firebase');
logger.info(`Firebase initialized: ${admin ? '✅' : '❌'}`);

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/cases', require('./routes/case.routes'));
app.use('/api/documents', require('./routes/document.routes'));
app.use('/api/event', require('./routes/event.routes'));

// Basic error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));