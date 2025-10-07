const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const validator = require('validator');

// Advanced rate limiting with different limits for different routes
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Specific rate limits for different operations
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts. Please try again in 15 minutes.'
);

const issueRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 issues per hour
  'Too many issues reported. Please wait before reporting another issue.'
);

const fileUploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  50, // 50 uploads per hour
  'Too many file uploads. Please try again later.'
);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Sanitize MongoDB injection
  mongoSanitize()(req, res, () => {
    // Sanitize XSS
    xss()(req, res, () => {
      // Prevent HTTP Parameter Pollution
      hpp()(req, res, next);
    });
  });
};

// Validate common input fields
const validateInput = {
  email: (email) => {
    if (!email || !validator.isEmail(email)) {
      throw new Error('Invalid email address');
    }
    return validator.normalizeEmail(email);
  },

  phone: (phone) => {
    if (!phone || !validator.isMobilePhone(phone, 'en-IN')) {
      throw new Error('Invalid phone number');
    }
    return phone.replace(/\s+/g, '');
  },

  password: (password) => {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!validator.isStrongPassword(password, {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0
    })) {
      throw new Error('Password must contain uppercase, lowercase, and number');
    }
    
    return password;
  },

  name: (name) => {
    if (!name || name.length < 2 || name.length > 50) {
      throw new Error('Name must be between 2 and 50 characters');
    }
    
    if (!validator.isAlpha(name.replace(/\s/g, ''))) {
      throw new Error('Name can only contain letters and spaces');
    }
    
    return validator.escape(name.trim());
  },

  text: (text, minLength = 1, maxLength = 1000) => {
    if (!text || text.length < minLength || text.length > maxLength) {
      throw new Error(`Text must be between ${minLength} and ${maxLength} characters`);
    }
    
    return validator.escape(text.trim());
  },

  coordinates: (lat, lng) => {
    if (!validator.isFloat(lat.toString(), { min: -90, max: 90 })) {
      throw new Error('Invalid latitude');
    }
    
    if (!validator.isFloat(lng.toString(), { min: -180, max: 180 })) {
      throw new Error('Invalid longitude');
    }
    
    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lng)
    };
  }
};

// File upload security
const validateFileUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const maxFiles = 5;

  if (req.files.length > maxFiles) {
    return res.status(400).json({
      success: false,
      message: `Maximum ${maxFiles} files allowed`
    });
  }

  for (const file of req.files) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed (JPEG, PNG, GIF, WebP)'
      });
    }

    if (file.size > maxFileSize) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} is too large. Maximum size is 10MB`
      });
    }

    // Check for malicious file signatures
    if (file.buffer && file.buffer.length > 0) {
      const fileSignature = file.buffer.subarray(0, 4).toString('hex');
      const validSignatures = [
        'ffd8ffe0', // JPEG
        'ffd8ffe1', // JPEG
        'ffd8ffe2', // JPEG
        '89504e47', // PNG
        '47494638', // GIF
        '52494646'  // WebP (RIFF)
      ];

      if (!validSignatures.some(sig => fileSignature.startsWith(sig))) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} appears to be corrupted or invalid`
        });
      }
    }
  }

  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict transport security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), location=()');
  
  next();
};

// IP-based blocking middleware
const ipBlocking = {
  blockedIPs: new Set(),
  
  block: function(ip, duration = 24 * 60 * 60 * 1000) { // 24 hours default
    this.blockedIPs.add(ip);
    setTimeout(() => {
      this.blockedIPs.delete(ip);
    }, duration);
  },
  
  middleware: function(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (this.blockedIPs.has(clientIP)) {
      return res.status(403).json({
        success: false,
        message: 'Your IP address has been temporarily blocked due to suspicious activity'
      });
    }
    
    next();
  }
};

// Suspicious activity detection
const suspiciousActivityDetector = {
  activities: new Map(),
  
  track: function(userId, activity) {
    const key = userId || 'anonymous';
    if (!this.activities.has(key)) {
      this.activities.set(key, []);
    }
    
    const userActivities = this.activities.get(key);
    userActivities.push({
      activity,
      timestamp: Date.now(),
      ip: activity.ip
    });
    
    // Keep only last 100 activities per user
    if (userActivities.length > 100) {
      userActivities.shift();
    }
    
    this.detectSuspiciousPatterns(key, userActivities);
  },
  
  detectSuspiciousPatterns: function(userId, activities) {
    const recentActivities = activities.filter(
      a => Date.now() - a.timestamp < 60 * 60 * 1000 // Last hour
    );
    
    // Too many failed login attempts
    const failedLogins = recentActivities.filter(
      a => a.activity.type === 'failed_login'
    );
    
    if (failedLogins.length > 5) {
      console.warn(`Suspicious activity detected: Multiple failed logins for ${userId}`);
      if (failedLogins[0].ip) {
        ipBlocking.block(failedLogins[0].ip, 2 * 60 * 60 * 1000); // 2 hours
      }
    }
    
    // Too many API requests
    if (recentActivities.length > 200) {
      console.warn(`Suspicious activity detected: High API usage for ${userId}`);
    }
    
    // Multiple IPs for same user
    const uniqueIPs = new Set(recentActivities.map(a => a.ip));
    if (uniqueIPs.size > 5) {
      console.warn(`Suspicious activity detected: Multiple IPs for ${userId}`);
    }
  },
  
  middleware: function(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Track activity based on response
      const userId = req.user?._id?.toString() || 'anonymous';
      const activity = {
        type: res.statusCode >= 400 ? 'error' : 'success',
        statusCode: res.statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip
      };
      
      if (res.statusCode === 401 || res.statusCode === 403) {
        activity.type = 'failed_login';
      }
      
      suspiciousActivityDetector.track(userId, activity);
      
      return originalSend.call(this, data);
    };
    
    next();
  }
};

// Request logging for security audit
const securityLogger = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id?.toString(),
    referer: req.get('Referer')
  };
  
  // Log sensitive operations
  const sensitiveRoutes = ['/auth/', '/admin/', '/issues/', '/users/'];
  const isSensitive = sensitiveRoutes.some(route => req.url.includes(route));
  
  if (isSensitive || req.method !== 'GET') {
    console.log('Security Log:', JSON.stringify(logData));
  }
  
  next();
};

// Content Security Policy
const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'", 
      "'unsafe-inline'", 
      'https://cdnjs.cloudflare.com',
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net'
    ],
    fontSrc: [
      "'self'", 
      'https://cdnjs.cloudflare.com',
      'https://fonts.gstatic.com'
    ],
    scriptSrc: [
      "'self'", 
      "'unsafe-inline'",
      'https://cdnjs.cloudflare.com',
      'https://cdn.jsdelivr.net'
    ],
    imgSrc: [
      "'self'", 
      'data:', 
      'https:', 
      'blob:',
      'https://res.cloudinary.com',
      'https://images.unsplash.com'
    ],
    connectSrc: [
      "'self'",
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'https://api.cloudinary.com'
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'", 'https:', 'blob:'],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"]
  }
};

// Session security
const sessionSecurity = (req, res, next) => {
  // Check for session hijacking
  const userAgent = req.get('User-Agent');
  const storedUserAgent = req.session?.userAgent;
  
  if (storedUserAgent && storedUserAgent !== userAgent) {
    console.warn('Potential session hijacking detected:', {
      userId: req.user?._id,
      storedUA: storedUserAgent,
      currentUA: userAgent
    });
    
    // Clear session
    if (req.session) {
      req.session.destroy();
    }
    
    return res.status(401).json({
      success: false,
      message: 'Session security violation detected'
    });
  }
  
  // Store user agent for future checks
  if (req.session && !req.session.userAgent) {
    req.session.userAgent = userAgent;
  }
  
  next();
};

// API key validation for external integrations
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  const validApiKeys = process.env.VALID_API_KEYS ? 
    process.env.VALID_API_KEYS.split(',') : [];
  
  if (req.path.startsWith('/api/external/')) {
    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        message: 'Valid API key required'
      });
    }
  }
  
  next();
};

// Request size limiting
const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length')) || 0;
  const maxSize = 15 * 1024 * 1024; // 15MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request too large'
    });
  }
  
  next();
};

// CSRF protection for state-changing operations
const csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const token = req.header('X-CSRF-Token') || req.body.csrfToken;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || token !== sessionToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token validation failed'
      });
    }
  }
  
  next();
};

// Generate CSRF token
const generateCSRFToken = (req, res, next) => {
  if (!req.session?.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

module.exports = {
  // Rate limiting
  authRateLimit,
  issueRateLimit,
  fileUploadRateLimit,
  createRateLimit,
  
  // Input validation and sanitization
  sanitizeInput,
  validateInput,
  validateFileUpload,
  
  // Security headers and policies
  securityHeaders,
  contentSecurityPolicy,
  
  // Advanced security
  ipBlocking,
  suspiciousActivityDetector,
  sessionSecurity,
  validateApiKey,
  requestSizeLimit,
  csrfProtection,
  generateCSRFToken,
  
  // Logging
  securityLogger
};
