const express = require('express');
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const Issue = require('../models/Issue');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { authenticate, authorize, authorizeOwnershipOrRole, optionalAuth, rateLimit } = require('../middleware/auth');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation rules
const createIssueValidation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
    
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
    
  body('category')
    .isIn(['roads', 'water', 'garbage', 'streetlights', 'drainage', 'parks', 'buildings', 'traffic', 'noise', 'other'])
    .withMessage('Invalid category'),
    
  body('location.coordinates.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
    
  body('location.coordinates.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
    
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority level')
];

// @route   GET /api/issues
// @desc    Get all issues with filtering, search, and pagination
// @access  Public (with optional auth for user-specific features)
router.get('/', optionalAuth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['submitted', 'acknowledged', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected']),
  query('category').optional().isIn(['roads', 'water', 'garbage', 'streetlights', 'drainage', 'parks', 'buildings', 'traffic', 'noise', 'other']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('search').optional().isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters')
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

    const {
      page = 1,
      limit = 20,
      status,
      category,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      lat,
      lng,
      radius = 5000 // 5km default radius
    } = req.query;

    // Build filter object
    const filter = { isPublic: true };
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    
    // Search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Location-based filtering
    let query = Issue.find(filter);
    
    if (lat && lng) {
      query = Issue.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            distanceField: 'distance',
            maxDistance: parseInt(radius),
            query: filter
          }
        }
      ]);
    }

    // Sorting
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    let issues;
    let total;

    if (lat && lng) {
      const pipeline = query.pipeline();
      pipeline.push({ $sort: sortObj });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: parseInt(limit) });
      
      const [issuesResult, countResult] = await Promise.all([
        Issue.aggregate(pipeline),
        Issue.aggregate([...query.pipeline(), { $count: 'total' }])
      ]);
      
      issues = issuesResult;
      total = countResult[0]?.total || 0;
    } else {
      [issues, total] = await Promise.all([
        Issue.find(filter)
          .populate('reportedBy', 'firstName lastName profilePhoto')
          .populate('assignedTo.user', 'firstName lastName role department')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit)),
        Issue.countDocuments(filter)
      ]);
    }

    // Add user-specific data if authenticated
    if (req.user) {
      issues = issues.map(issue => {
        const issueObj = issue.toObject ? issue.toObject() : issue;
        issueObj.isUpvoted = issue.upvotes?.some(upvote => 
          upvote.user.toString() === req.user._id.toString()
        ) || false;
        return issueObj;
      });
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        issues,
        pagination: {
          current: parseInt(page),
          pages: totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          status,
          category,
          priority,
          search
        }
      }
    });

  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch issues'
    });
  }
});

// @route   GET /api/issues/:id
// @desc    Get single issue by ID
// @access  Public (with optional auth for user-specific features)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'firstName lastName profilePhoto role')
      .populate('assignedTo.user', 'firstName lastName role department')
      .populate('relatedIssues', 'title status category createdAt');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Check if issue is private and user doesn't have access
    if (!issue.isPublic && (!req.user || 
        (req.user._id.toString() !== issue.reportedBy._id.toString() && 
         !['admin', 'department_head', 'field_officer'].includes(req.user.role)))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Increment view count
    issue.views += 1;
    await issue.save();

    // Add user-specific data if authenticated
    let issueData = issue.toObject();
    if (req.user) {
      issueData.isUpvoted = issue.upvotes.some(upvote => 
        upvote.user.toString() === req.user._id.toString()
      );
    }

    res.json({
      success: true,
      data: { issue: issueData }
    });

  } catch (error) {
    console.error('Get issue error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid issue ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch issue'
    });
  }
});

// @route   POST /api/issues
// @desc    Create new issue
// @access  Private
router.post('/', authenticate, rateLimit(20, 60 * 60 * 1000), upload.array('photos', 5), createIssueValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      category,
      subCategory,
      priority = 'medium',
      location,
      tags,
      isPublic = true
    } = req.body;

    // Create issue
    const issue = new Issue({
      title,
      description,
      category,
      subCategory,
      priority,
      location,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      isPublic,
      reportedBy: req.user._id
    });

    // Handle photo uploads
    if (req.files && req.files.length > 0) {
      const photoUploadPromises = req.files.map(async (file) => {
        const uploadResult = await uploadToCloudinary(file.buffer, 'issues');
        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          caption: file.originalname
        };
      });

      issue.photos = await Promise.all(photoUploadPromises);
    }

    // Add initial timeline entry
    issue.addTimelineEntry(
      'created',
      'Issue reported by citizen',
      req.user._id
    );

    await issue.save();

    // Update user stats
    await req.user.updateOne({
      $inc: { 'stats.issuesReported': 1, 'stats.contributionScore': 10 }
    });

    // Create notification for relevant department
    const departmentUsers = await User.find({
      department: category,
      role: { $in: ['department_head', 'field_officer'] },
      isActive: true
    });

    const notificationPromises = departmentUsers.map(user => 
      Notification.createNotification({
        recipient: user._id,
        sender: req.user._id,
        type: 'issue_created',
        title: 'New Issue Reported',
        message: `A new ${category} issue has been reported: "${title}"`,
        relatedIssue: issue._id,
        priority: priority === 'critical' ? 'urgent' : 'medium',
        actionUrl: `/issues/${issue._id}`,
        actionText: 'View Issue'
      })
    );

    await Promise.all(notificationPromises);

    // Populate the response
    await issue.populate('reportedBy', 'firstName lastName profilePhoto');

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      data: { issue }
    });

  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create issue'
    });
  }
});

// @route   PUT /api/issues/:id
// @desc    Update issue (for issue owner or authorized personnel)
// @access  Private
router.put('/:id', authenticate, authorizeOwnershipOrRole('admin', 'department_head', 'field_officer'), [
  body('title').optional().trim().isLength({ min: 5, max: 200 }),
  body('description').optional().trim().isLength({ min: 10, max: 2000 }),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
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

    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const allowedFields = ['title', 'description', 'priority', 'tags', 'isPublic'];
    const updates = {};

    // Only allow certain fields based on user role
    if (req.user.role === 'citizen' && issue.reportedBy.toString() === req.user._id.toString()) {
      // Citizens can only update basic info and only if issue is still submitted
      if (issue.status !== 'submitted') {
        return res.status(403).json({
          success: false,
          message: 'Cannot update issue after it has been processed'
        });
      }
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined && ['title', 'description', 'isPublic'].includes(field)) {
          updates[field] = req.body[field];
        }
      });
    } else {
      // Admin and department personnel can update more fields
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });
    }

    // Handle tags
    if (updates.tags) {
      updates.tags = updates.tags.split(',').map(tag => tag.trim());
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('reportedBy', 'firstName lastName profilePhoto')
     .populate('assignedTo.user', 'firstName lastName role department');

    // Add timeline entry
    updatedIssue.addTimelineEntry(
      'updated',
      'Issue details updated',
      req.user._id,
      { updatedFields: Object.keys(updates) }
    );

    await updatedIssue.save();

    res.json({
      success: true,
      message: 'Issue updated successfully',
      data: { issue: updatedIssue }
    });

  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update issue'
    });
  }
});

// @route   PATCH /api/issues/:id/status
// @desc    Update issue status (admin/department only)
// @access  Private
router.patch('/:id/status', authenticate, authorize('admin', 'department_head', 'field_officer'), [
  body('status')
    .isIn(['submitted', 'acknowledged', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected'])
    .withMessage('Invalid status'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
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

    const { status, notes, estimatedResolutionTime } = req.body;

    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Check department authorization for non-admin users
    if (req.user.role !== 'admin' && req.user.department !== issue.category) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Department mismatch.'
      });
    }

    const oldStatus = issue.status;
    issue.updateStatus(status, req.user._id, notes);

    if (estimatedResolutionTime) {
      issue.estimatedResolutionTime = new Date(estimatedResolutionTime);
    }

    await issue.save();

    // Create notification for issue reporter
    await Notification.createNotification({
      recipient: issue.reportedBy,
      sender: req.user._id,
      type: 'issue_updated',
      title: 'Issue Status Updated',
      message: `Your issue "${issue.title}" status has been changed from ${oldStatus} to ${status}${notes ? ': ' + notes : ''}`,
      relatedIssue: issue._id,
      priority: status === 'resolved' ? 'high' : 'medium',
      actionUrl: `/issues/${issue._id}`,
      actionText: 'View Issue'
    });

    await issue.populate('reportedBy', 'firstName lastName profilePhoto')
               .populate('assignedTo.user', 'firstName lastName role department');

    res.json({
      success: true,
      message: 'Issue status updated successfully',
      data: { issue }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update issue status'
    });
  }
});

// @route   PATCH /api/issues/:id/assign
// @desc    Assign issue to user/department (admin/department head only)
// @access  Private
router.patch('/:id/assign', authenticate, authorize('admin', 'department_head'), [
  body('assignedUserId').optional().isMongoId().withMessage('Invalid user ID'),
  body('department').isIn(['roads', 'water', 'garbage', 'streetlights', 'drainage', 'parks', 'general']).withMessage('Invalid department')
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

    const { assignedUserId, department } = req.body;

    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Verify assigned user if provided
    let assignedUser = null;
    if (assignedUserId) {
      assignedUser = await User.findById(assignedUserId);
      if (!assignedUser) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user not found'
        });
      }
      
      if (assignedUser.department !== department) {
        return res.status(400).json({
          success: false,
          message: 'User does not belong to the specified department'
        });
      }
    }

    issue.assignIssue(assignedUserId, department, req.user._id);
    await issue.save();

    // Create notifications
    const notifications = [
      // Notify issue reporter
      Notification.createNotification({
        recipient: issue.reportedBy,
        sender: req.user._id,
        type: 'issue_assigned',
        title: 'Issue Assigned',
        message: `Your issue "${issue.title}" has been assigned to the ${department} department`,
        relatedIssue: issue._id,
        actionUrl: `/issues/${issue._id}`,
        actionText: 'View Issue'
      })
    ];

    // Notify assigned user if specified
    if (assignedUser) {
      notifications.push(
        Notification.createNotification({
          recipient: assignedUser._id,
          sender: req.user._id,
          type: 'issue_assigned',
          title: 'New Issue Assigned',
          message: `You have been assigned a new ${issue.category} issue: "${issue.title}"`,
          relatedIssue: issue._id,
          priority: issue.priority === 'critical' ? 'urgent' : 'high',
          actionUrl: `/issues/${issue._id}`,
          actionText: 'View Issue'
        })
      );
    }

    await Promise.all(notifications);

    await issue.populate('reportedBy', 'firstName lastName profilePhoto')
               .populate('assignedTo.user', 'firstName lastName role department');

    res.json({
      success: true,
      message: 'Issue assigned successfully',
      data: { issue }
    });

  } catch (error) {
    console.error('Assign issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign issue'
    });
  }
});

// @route   POST /api/issues/:id/upvote
// @desc    Upvote/downvote an issue
// @access  Private
router.post('/:id/upvote', authenticate, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    const existingUpvoteIndex = issue.upvotes.findIndex(
      upvote => upvote.user.toString() === req.user._id.toString()
    );

    let message;
    if (existingUpvoteIndex > -1) {
      issue.upvotes.splice(existingUpvoteIndex, 1);
      message = 'Upvote removed';
    } else {
      issue.upvotes.push({ user: req.user._id });
      message = 'Issue upvoted';
      
      // Update user contribution score
      await req.user.updateOne({
        $inc: { 'stats.contributionScore': 1 }
      });
    }

    await issue.save();

    res.json({
      success: true,
      message,
      data: {
        upvoteCount: issue.upvotes.length,
        isUpvoted: existingUpvoteIndex === -1
      }
    });

  } catch (error) {
    console.error('Upvote issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upvote issue'
    });
  }
});

// @route   GET /api/issues/:id/timeline
// @desc    Get issue timeline
// @access  Public (respects issue privacy)
router.get('/:id/timeline', optionalAuth, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('timeline.performedBy', 'firstName lastName role')
      .select('timeline isPublic reportedBy');

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Check access permissions
    if (!issue.isPublic && (!req.user || 
        (req.user._id.toString() !== issue.reportedBy.toString() && 
         !['admin', 'department_head', 'field_officer'].includes(req.user.role)))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { timeline: issue.timeline }
    });

  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timeline'
    });
  }
});

// @route   DELETE /api/issues/:id
// @desc    Delete issue (admin only or issue owner if status is submitted)
// @access  Private
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Check permissions
    const isOwner = issue.reportedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && (!isOwner || issue.status !== 'submitted')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only submitted issues can be deleted by their owners.'
      });
    }

    await Issue.findByIdAndDelete(req.params.id);

    // Clean up related comments
    await Comment.deleteMany({ issue: req.params.id });

    // Clean up related notifications
    await Notification.deleteMany({ relatedIssue: req.params.id });

    res.json({
      success: true,
      message: 'Issue deleted successfully'
    });

  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete issue'
    });
  }
});

module.exports = router;
