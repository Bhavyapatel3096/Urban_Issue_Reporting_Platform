const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.query?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Department-based authorization
const authorizeDepartment = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  // Admin can access all departments
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user belongs to the required department
  const requiredDepartment = req.params.department || req.body.department || req.query.department;
  
  if (req.user.role === 'department_head' || req.user.role === 'field_officer') {
    if (req.user.department !== requiredDepartment) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Department mismatch.',
        userDepartment: req.user.department,
        requiredDepartment
      });
    }
  }

  next();
};

// Check if user owns the resource or has appropriate permissions
const authorizeOwnershipOrRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }

      // Admin and specified roles can access any resource
      if (allowedRoles.includes(req.user.role) || req.user.role === 'admin') {
        return next();
      }

      // Check ownership - resource ID should be in params
      const resourceId = req.params.id || req.params.issueId || req.params.userId;
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID is required.'
        });
      }

      // For issues, check if user is the reporter
      if (req.baseUrl.includes('/issues')) {
        const Issue = require('../models/Issue');
        const issue = await Issue.findById(resourceId);
        
        if (!issue) {
          return res.status(404).json({
            success: false,
            message: 'Issue not found.'
          });
        }

        if (issue.reportedBy.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only access your own issues.'
          });
        }
      }

      // For users, check if accessing own profile
      if (req.baseUrl.includes('/users')) {
        if (resourceId !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only access your own profile.'
          });
        }
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during authorization.'
      });
    }
  };
};

// Rate limiting per user
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip;
    const now = Date.now();
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    
    // Remove expired requests
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    validRequests.push(now);
    requests.set(userId, validRequests);
    
    next();
  };
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.cookies?.token ||
                  req.query?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeDepartment,
  authorizeOwnershipOrRole,
  rateLimit,
  optionalAuth
};
