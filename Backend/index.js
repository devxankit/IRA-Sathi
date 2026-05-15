require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const userRoutes = require('./routes/user');
const vendorRoutes = require('./routes/vendor');
const sellerRoutes = require('./routes/seller');
const adminRoutes = require('./routes/admin');
const fcmRoutes = require('./routes/fcm');
// const utilsRoutes = require('./routes/utils');

// Import config
const { connectDB } = require('./config/database');
const { initializeRealtimeServer } = require('./config/realtime');

const app = express();

// Middleware
app.use(helmet()); // Security headers

// CORS configuration - Environment-aware
// CORS configuration - Environment-aware
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://www.iraagritech.com',
  'https://iraagritech.com'
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? [...process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()), ...defaultOrigins]
  : defaultOrigins;

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow localhost origins even if not in CORS_ORIGINS
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      if (isLocalhost || allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
    }

    // In production, only allow origins from CORS_ORIGINS
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
})); // Enable CORS
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'IRA SATHI Backend Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Import error handler
const errorHandler = require('./middleware/errorHandler');

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fcm', fcmRoutes);
// app.use('/api/utils', utilsRoutes); // Deprecated: Frontend uses Google Cloud Translation API directly

// 404 handler (must come before error handler)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// Server setup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Connect to MongoDB
connectDB()
  .then(() => {
    // Initialize Firebase Admin SDK for push notifications
    const { initializeFirebaseAdmin } = require('./services/firebaseAdmin');
    initializeFirebaseAdmin();

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 IRA SATHI Backend Server running on http://${HOST}:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 MongoDB: ${process.env.MONGO_URI ? 'Connected' : 'Not configured'}`);
    });

    // Initialize real-time server (WebSocket/SSE) for push notifications
    // This will be implemented when push notifications are added
    initializeRealtimeServer(server);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed');
          process.exit(0);
        });
      });
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

module.exports = app;
