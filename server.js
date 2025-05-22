const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const routes = require('./routes');
const logger = require('./utils/logger');

// Load environment variables
dotenv.config();

// Debug: Confirm server.js execution
console.log('Executing server.js');

// Create Express app
const app = express();

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Clear existing listeners
    mongoose.connection.removeAllListeners('connected');
    mongoose.connection.removeAllListeners('error');

    // Register listeners
    mongoose.connection.once('connected', () => {
      logger.info('MongoDB connected');
    });
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    // Connect without deprecated options
    console.log('Connecting to MongoDB with URI:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

// Call connection function
connectDB();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://adhivakta.netlify.app',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API Routes
console.log('Mounting routes');
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  res.status(statusCode).json({
    status,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log('Starting server on port', PORT);
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle nodemon restarts
process.on('SIGUSR2', () => {
  logger.info('Nodemon restart detected, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.kill(process.pid, 'SIGUSR2');
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});