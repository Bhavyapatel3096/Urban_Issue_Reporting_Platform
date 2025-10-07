const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Import configurations
const connectDB = require('./config/database');
const { initializeSocket } = require('./utils/socket');
const { validateEmailConfig } = require('./utils/email');

// Import routes
const authRoutes = require('./routes/auth');
const issuesRoutes = require('./routes/issues');

// Import models for cleanup tasks
const Notification = require('./models/Notification');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5500' // For local development
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('short'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for better user experience
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static files
    return req.url.startsWith('/uploads') || req.url.startsWith('/public');
  }
});
app.use(limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issuesRoutes);

// Health check endpoint with detailed status
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      email: await validateEmailConfig() ? 'configured' : 'not configured'
    }
  };
  
  res.status(200).json(health);
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Anand Municipal Corporation API is running',
    version: '2.0.0',
    features: {
      authentication: true,
      issueReporting: true,
      realTimeNotifications: true,
      fileUploads: true,
      geolocation: true,
      emailNotifications: true
    }
  });
});

// Serve frontend files (for production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
    availableRoutes: [
      '/api/auth/*',
      '/api/issues/*',
      '/health',
      '/api/status'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 10MB.'
    });
  }
  
  // Default server error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Initialize server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connected successfully');
    
    // Validate email configuration (optional)
    const emailConfigured = await validateEmailConfig();
    if (emailConfigured) {
      console.log('✅ Email service configured');
    } else {
      console.log('⚠️ Email service not configured (optional)');
    }
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
    
    // Initialize WebSocket
    const io = initializeSocket(server);
    console.log('✅ WebSocket server initialized');
    
    // Setup scheduled tasks
    setupScheduledTasks();
    console.log('✅ Scheduled tasks initialized');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Scheduled tasks
const setupScheduledTasks = () => {
  // Clean up old notifications daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      const result = await Notification.cleanup();
      console.log(`Cleaned up ${result.deletedCount} old notifications`);
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  });
  
  // Health check every 5 minutes in production
  if (process.env.NODE_ENV === 'production') {
    cron.schedule('*/5 * * * *', () => {
      console.log('System health check:', {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });
  }
};

// Start the server
startServer();

module.exports = app;
