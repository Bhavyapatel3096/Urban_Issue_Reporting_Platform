const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticate, rateLimit } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
    
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
    
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .custom(async (email) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error('Email already registered');
      }
    }),
    
  body('phone')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number'),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
    
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', rateLimit(5, 15 * 60 * 1000), registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, phone, password, profilePhoto, address } = req.body;

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      password,
      profilePhoto,
      address,
      verificationToken: crypto.randomBytes(32).toString('hex')
    });

    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to Anand Municipal Corporation Portal',
        template: 'welcome',
        data: {
          firstName: user.firstName,
          verificationToken: user.verificationToken
        }
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Generate token
    const token = user.generateAuthToken();

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: user.toSafeObject(),
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', rateLimit(10, 15 * 60 * 1000), loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = user.generateAuthToken();

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: user.toSafeObject()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
    
  body('phone')
    .optional()
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedFields = ['firstName', 'lastName', 'phone', 'profilePhoto', 'address', 'preferences'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toSafeObject()
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticate, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
    
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', rateLimit(3, 15 * 60 * 1000), [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        data: {
          firstName: user.firstName,
          resetToken,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        }
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', rateLimit(5, 15 * 60 * 1000), [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
    
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, password } = req.body;

    // Hash token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Reset password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.post('/verify-email', [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token } = req.body;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email'
    });
  }
});

module.exports = router;
