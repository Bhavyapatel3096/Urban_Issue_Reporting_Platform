const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    unique: true,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Issue title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Issue description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Issue category is required'],
    enum: {
      values: ['roads', 'water', 'garbage', 'streetlights', 'drainage', 'parks', 'buildings', 'traffic', 'noise', 'other'],
      message: 'Invalid issue category'
    }
  },
  subCategory: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['submitted', 'acknowledged', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected'],
    default: 'submitted'
  },
  location: {
    coordinates: {
      latitude: {
        type: Number,
        required: true,
        min: [-90, 'Invalid latitude'],
        max: [90, 'Invalid latitude']
      },
      longitude: {
        type: Number,
        required: true,
        min: [-180, 'Invalid longitude'],
        max: [180, 'Invalid longitude']
      }
    },
    address: {
      formatted: String,
      street: String,
      area: String,
      landmark: String,
      city: { type: String, default: 'Anand' },
      state: { type: String, default: 'Gujarat' },
      pincode: String
    },
    ward: String,
    zone: String
  },
  photos: [{
    url: String,
    publicId: String,
    caption: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    department: String,
    assignedAt: Date
  },
  timeline: [{
    action: {
      type: String,
      enum: ['created', 'acknowledged', 'assigned', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected', 'comment_added', 'priority_changed']
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }],
  estimatedResolutionTime: Date,
  actualResolutionTime: Date,
  resolutionNotes: String,
  resolutionPhotos: [{
    url: String,
    publicId: String,
    caption: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    submittedAt: Date
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  tags: [String],
  relatedIssues: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue'
  }],
  views: { type: Number, default: 0 },
  upvotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now }
  }],
  cost: {
    estimated: Number,
    actual: Number,
    currency: { type: String, default: 'INR' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
issueSchema.index({ trackingId: 1 });
issueSchema.index({ category: 1, status: 1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ 'assignedTo.department': 1, status: 1 });
issueSchema.index({ 'location.coordinates': '2dsphere' });
issueSchema.index({ priority: 1, status: 1, createdAt: -1 });
issueSchema.index({ tags: 1 });

// Virtual for upvote count
issueSchema.virtual('upvoteCount').get(function() {
  return this.upvotes ? this.upvotes.length : 0;
});

// Virtual for time since creation
issueSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return 'Less than an hour ago';
});

// Pre-save middleware to generate tracking ID
issueSchema.pre('save', function(next) {
  if (!this.trackingId) {
    this.trackingId = generateTrackingId();
  }
  next();
});

// Method to add timeline entry
issueSchema.methods.addTimelineEntry = function(action, description, performedBy, metadata = {}) {
  this.timeline.push({
    action,
    description,
    performedBy,
    metadata
  });
};

// Method to update status with timeline
issueSchema.methods.updateStatus = function(newStatus, performedBy, notes = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  
  this.addTimelineEntry(
    newStatus,
    `Status changed from ${oldStatus} to ${newStatus}${notes ? ': ' + notes : ''}`,
    performedBy,
    { oldStatus, newStatus, notes }
  );
  
  if (newStatus === 'resolved') {
    this.actualResolutionTime = new Date();
  }
};

// Method to assign issue
issueSchema.methods.assignIssue = function(assignedUser, department, performedBy) {
  this.assignedTo = {
    user: assignedUser,
    department,
    assignedAt: new Date()
  };
  
  this.addTimelineEntry(
    'assigned',
    `Issue assigned to ${department} department`,
    performedBy,
    { assignedUser, department }
  );
};

// Static method to generate tracking ID
function generateTrackingId() {
  const prefix = 'AMC';
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${random}`;
}

// Static method to get issues by location
issueSchema.statics.findNearbyIssues = function(latitude, longitude, radiusInMeters = 1000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusInMeters
      }
    }
  });
};

// Static method to get dashboard stats
issueSchema.statics.getDashboardStats = async function(filters = {}) {
  const pipeline = [
    { $match: filters },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $in: ['$status', ['acknowledged', 'in_progress']] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        avgResolutionTime: { $avg: { $subtract: ['$actualResolutionTime', '$createdAt'] } }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {
    total: 0,
    submitted: 0,
    inProgress: 0,
    resolved: 0,
    avgResolutionTime: 0
  };
};

module.exports = mongoose.model('Issue', issueSchema);
