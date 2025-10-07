const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  issue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['public', 'internal', 'system'],
    default: 'public'
  },
  isOfficial: {
    type: Boolean,
    default: false
  },
  attachments: [{
    url: String,
    type: String, // 'image', 'document', 'video'
    name: String,
    size: Number
  }],
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notified: { type: Boolean, default: false }
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: { type: Date, default: Date.now }
  }],
  replies: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      required: true,
      maxlength: 500
    },
    timestamp: { type: Date, default: Date.now },
    isOfficial: { type: Boolean, default: false }
  }],
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    content: String,
    editedAt: { type: Date, default: Date.now },
    reason: String
  }],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
commentSchema.index({ issue: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ type: 1, isOfficial: 1 });

// Virtual for like count
commentSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Virtual for reply count
commentSchema.virtual('replyCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

// Method to add reply
commentSchema.methods.addReply = function(authorId, content, isOfficial = false) {
  this.replies.push({
    author: authorId,
    content,
    isOfficial
  });
};

// Method to toggle like
commentSchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.findIndex(like => like.user.toString() === userId.toString());
  
  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1);
    return false; // unliked
  } else {
    this.likes.push({ user: userId });
    return true; // liked
  }
};

// Method to edit comment
commentSchema.methods.editContent = function(newContent, reason = '') {
  this.editHistory.push({
    content: this.content,
    reason
  });
  this.content = newContent;
  this.isEdited = true;
};

// Static method to get comments for issue with pagination
commentSchema.statics.getCommentsForIssue = function(issueId, page = 1, limit = 20) {
  return this.find({ 
    issue: issueId, 
    isDeleted: false 
  })
    .populate('author', 'firstName lastName profilePhoto role')
    .populate('replies.author', 'firstName lastName profilePhoto role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

module.exports = mongoose.model('Comment', commentSchema);
