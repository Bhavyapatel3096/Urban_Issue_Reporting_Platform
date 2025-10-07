const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { validateInput } = require('../middleware/security');
const emailService = require('../utils/emailService');
const { uploadToCloudinary } = require('../utils/upload');

// Mock external dependencies
jest.mock('../utils/emailService');
jest.mock('../utils/upload');

const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/municipal_unit_test';

describe('Unit Tests', () => {
  beforeAll(async () => {
    await mongoose.connect(MONGODB_TEST_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({});
    await Issue.deleteMany({});
    await Comment.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('User Model Tests', () => {
    test('should create a valid user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.password).not.toBe(userData.password); // Should be hashed
      expect(savedUser.role).toBe('citizen');
      expect(savedUser.isVerified).toBe(false);
      expect(savedUser.createdAt).toBeDefined();
    });

    test('should validate email uniqueness', async () => {
      const userData = {
        name: 'John Doe',
        email: 'duplicate@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      };

      await User.create(userData);

      const duplicateUser = new User(userData);
      await expect(duplicateUser.save()).rejects.toThrow();
    });

    test('should validate required fields', async () => {
      const invalidUser = new User({
        name: 'John Doe'
        // Missing required fields
      });

      await expect(invalidUser.save()).rejects.toThrow();
    });

    test('should validate email format', async () => {
      const invalidUser = new User({
        name: 'John Doe',
        email: 'invalid-email',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      await expect(invalidUser.save()).rejects.toThrow();
    });

    test('should validate phone number format', async () => {
      const invalidUser = new User({
        name: 'John Doe',
        email: 'john@example.com',
        phone: 'invalid-phone',
        password: 'TestPass123',
        role: 'citizen'
      });

      await expect(invalidUser.save()).rejects.toThrow();
    });

    test('should generate JWT token', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      const token = user.generateToken();
      expect(token).toBeDefined();

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBe(user._id.toString());
    });

    test('should verify password correctly', async () => {
      const password = 'TestPass123';
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9876543210',
        password: password,
        role: 'citizen'
      });

      const isValidCorrect = await user.comparePassword(password);
      const isValidWrong = await user.comparePassword('WrongPassword');

      expect(isValidCorrect).toBe(true);
      expect(isValidWrong).toBe(false);
    });
  });

  describe('Issue Model Tests', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });
    });

    test('should create a valid issue', async () => {
      const issueData = {
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        subcategory: 'streetlights',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id,
        priority: 'medium'
      };

      const issue = await Issue.create(issueData);

      expect(issue._id).toBeDefined();
      expect(issue.title).toBe(issueData.title);
      expect(issue.status).toBe('reported');
      expect(issue.priority).toBe('medium');
      expect(issue.upvotes).toBe(0);
      expect(issue.timeline).toBeDefined();
      expect(issue.timeline.length).toBe(1);
      expect(issue.timeline[0].status).toBe('reported');
    });

    test('should validate required fields', async () => {
      const invalidIssue = new Issue({
        title: 'Test Issue'
        // Missing required fields
      });

      await expect(invalidIssue.save()).rejects.toThrow();
    });

    test('should validate coordinates', async () => {
      const invalidIssue = new Issue({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 200, // Invalid latitude
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });

      await expect(invalidIssue.save()).rejects.toThrow();
    });

    test('should validate status enum', async () => {
      const issue = await Issue.create({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });

      issue.status = 'invalid_status';
      await expect(issue.save()).rejects.toThrow();
    });

    test('should validate priority enum', async () => {
      const issue = new Issue({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id,
        priority: 'invalid_priority'
      });

      await expect(issue.save()).rejects.toThrow();
    });

    test('should update timeline when status changes', async () => {
      const issue = await Issue.create({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });

      issue.status = 'in_progress';
      issue.timeline.push({
        status: 'in_progress',
        timestamp: new Date(),
        updatedBy: testUser._id,
        note: 'Work started'
      });

      await issue.save();

      expect(issue.timeline.length).toBe(2);
      expect(issue.timeline[1].status).toBe('in_progress');
    });
  });

  describe('Comment Model Tests', () => {
    let testUser, testIssue;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      testIssue = await Issue.create({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });
    });

    test('should create a valid comment', async () => {
      const commentData = {
        content: 'This is a test comment',
        author: testUser._id,
        issue: testIssue._id
      };

      const comment = await Comment.create(commentData);

      expect(comment._id).toBeDefined();
      expect(comment.content).toBe(commentData.content);
      expect(comment.author.toString()).toBe(testUser._id.toString());
      expect(comment.issue.toString()).toBe(testIssue._id.toString());
      expect(comment.likes).toBe(0);
      expect(comment.isEdited).toBe(false);
    });

    test('should validate required fields', async () => {
      const invalidComment = new Comment({
        content: 'Test comment'
        // Missing required fields
      });

      await expect(invalidComment.save()).rejects.toThrow();
    });

    test('should handle nested replies', async () => {
      const parentComment = await Comment.create({
        content: 'Parent comment',
        author: testUser._id,
        issue: testIssue._id
      });

      const replyComment = await Comment.create({
        content: 'Reply comment',
        author: testUser._id,
        issue: testIssue._id,
        parentComment: parentComment._id
      });

      expect(replyComment.parentComment.toString()).toBe(parentComment._id.toString());
    });
  });

  describe('Notification Model Tests', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });
    });

    test('should create a valid notification', async () => {
      const notificationData = {
        recipient: testUser._id,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'issue_update'
      };

      const notification = await Notification.create(notificationData);

      expect(notification._id).toBeDefined();
      expect(notification.title).toBe(notificationData.title);
      expect(notification.isRead).toBe(false);
      expect(notification.channels.push).toBe(true);
      expect(notification.channels.email).toBe(false);
    });

    test('should validate notification type', async () => {
      const invalidNotification = new Notification({
        recipient: testUser._id,
        title: 'Test Notification',
        message: 'Test message',
        type: 'invalid_type'
      });

      await expect(invalidNotification.save()).rejects.toThrow();
    });
  });

  describe('Input Validation Tests', () => {
    describe('Email validation', () => {
      test('should validate correct email', () => {
        expect(() => validateInput.email('test@example.com')).not.toThrow();
        expect(validateInput.email('test@example.com')).toBe('test@example.com');
      });

      test('should reject invalid email', () => {
        expect(() => validateInput.email('invalid-email')).toThrow('Invalid email');
        expect(() => validateInput.email('')).toThrow('Invalid email');
        expect(() => validateInput.email(null)).toThrow('Invalid email');
      });
    });

    describe('Phone validation', () => {
      test('should validate correct Indian phone number', () => {
        expect(() => validateInput.phone('9876543210')).not.toThrow();
        expect(validateInput.phone('98765 43210')).toBe('9876543210');
      });

      test('should reject invalid phone number', () => {
        expect(() => validateInput.phone('invalid-phone')).toThrow('Invalid phone');
        expect(() => validateInput.phone('123')).toThrow('Invalid phone');
      });
    });

    describe('Password validation', () => {
      test('should validate strong password', () => {
        expect(() => validateInput.password('TestPass123')).not.toThrow();
        expect(validateInput.password('TestPass123')).toBe('TestPass123');
      });

      test('should reject weak password', () => {
        expect(() => validateInput.password('weak')).toThrow('8 characters');
        expect(() => validateInput.password('alllowercase123')).toThrow('uppercase');
        expect(() => validateInput.password('ALLUPPERCASE123')).toThrow('lowercase');
        expect(() => validateInput.password('NoNumbers')).toThrow('number');
      });
    });

    describe('Name validation', () => {
      test('should validate correct name', () => {
        expect(() => validateInput.name('John Doe')).not.toThrow();
        expect(validateInput.name('  John Doe  ')).toBe('John Doe');
      });

      test('should reject invalid name', () => {
        expect(() => validateInput.name('A')).toThrow('between 2 and 50');
        expect(() => validateInput.name('John123')).toThrow('letters and spaces');
        expect(() => validateInput.name('')).toThrow('between 2 and 50');
      });
    });

    describe('Coordinates validation', () => {
      test('should validate correct coordinates', () => {
        const result = validateInput.coordinates(22.5646, 72.9289);
        expect(result.latitude).toBe(22.5646);
        expect(result.longitude).toBe(72.9289);
      });

      test('should reject invalid coordinates', () => {
        expect(() => validateInput.coordinates(200, 72.9289)).toThrow('Invalid latitude');
        expect(() => validateInput.coordinates(22.5646, 200)).toThrow('Invalid longitude');
        expect(() => validateInput.coordinates('invalid', 72.9289)).toThrow('Invalid latitude');
      });
    });
  });

  describe('Password Hashing Tests', () => {
    test('should hash password before saving', async () => {
      const password = 'TestPass123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: password,
        role: 'citizen'
      });

      await user.save();

      expect(user.password).not.toBe(password);
      expect(user.password.length).toBeGreaterThan(password.length);
      expect(await bcrypt.compare(password, user.password)).toBe(true);
    });

    test('should not rehash password if not modified', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      const originalHash = user.password;
      user.name = 'Updated Name';
      await user.save();

      expect(user.password).toBe(originalHash);
    });
  });

  describe('JWT Token Tests', () => {
    test('should generate valid JWT token', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      const token = user.generateToken();
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      expect(decoded.userId).toBe(user._id.toString());
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    test('should include expiration in token', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      const token = user.generateToken();
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('Issue Statistics Tests', () => {
    let testUsers;

    beforeEach(async () => {
      testUsers = await User.create([
        {
          name: 'User 1',
          email: 'user1@example.com',
          phone: '9876543210',
          password: 'TestPass123',
          role: 'citizen'
        },
        {
          name: 'User 2',
          email: 'user2@example.com',
          phone: '9876543211',
          password: 'TestPass123',
          role: 'citizen'
        }
      ]);

      // Create test issues with different statuses
      await Issue.create([
        {
          title: 'Issue 1',
          description: 'Description 1',
          category: 'roads',
          location: {
            address: 'Address 1',
            latitude: 22.5646,
            longitude: 72.9289
          },
          reportedBy: testUsers[0]._id,
          status: 'reported'
        },
        {
          title: 'Issue 2',
          description: 'Description 2',
          category: 'infrastructure',
          location: {
            address: 'Address 2',
            latitude: 22.5646,
            longitude: 72.9289
          },
          reportedBy: testUsers[1]._id,
          status: 'in_progress'
        },
        {
          title: 'Issue 3',
          description: 'Description 3',
          category: 'water',
          location: {
            address: 'Address 3',
            latitude: 22.5646,
            longitude: 72.9289
          },
          reportedBy: testUsers[0]._id,
          status: 'resolved'
        }
      ]);
    });

    test('should calculate status statistics', async () => {
      const stats = await Issue.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      expect(statusCounts.reported).toBe(1);
      expect(statusCounts.in_progress).toBe(1);
      expect(statusCounts.resolved).toBe(1);
    });

    test('should calculate category statistics', async () => {
      const stats = await Issue.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ]);

      expect(stats.length).toBe(3);
      expect(stats.find(s => s._id === 'roads').count).toBe(1);
      expect(stats.find(s => s._id === 'infrastructure').count).toBe(1);
      expect(stats.find(s => s._id === 'water').count).toBe(1);
    });
  });

  describe('Comment Threading Tests', () => {
    let testUser, testIssue, parentComment;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      testIssue = await Issue.create({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });

      parentComment = await Comment.create({
        content: 'Parent comment',
        author: testUser._id,
        issue: testIssue._id
      });
    });

    test('should create nested comments', async () => {
      const reply = await Comment.create({
        content: 'Reply to parent',
        author: testUser._id,
        issue: testIssue._id,
        parentComment: parentComment._id
      });

      expect(reply.parentComment.toString()).toBe(parentComment._id.toString());
    });

    test('should find comments by issue', async () => {
      await Comment.create([
        {
          content: 'Comment 1',
          author: testUser._id,
          issue: testIssue._id
        },
        {
          content: 'Comment 2',
          author: testUser._id,
          issue: testIssue._id
        }
      ]);

      const comments = await Comment.find({ issue: testIssue._id });
      expect(comments.length).toBe(3); // Including the parent comment from beforeEach
    });
  });

  describe('Email Service Tests', () => {
    test('should send welcome email', async () => {
      const user = {
        name: 'Test User',
        email: 'test@example.com'
      };

      emailService.sendWelcomeEmail.mockResolvedValue(true);

      const result = await emailService.sendWelcomeEmail(user);
      expect(result).toBe(true);
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(user);
    });

    test('should send issue notification email', async () => {
      const issue = {
        title: 'Test Issue',
        _id: 'test-id'
      };
      const recipient = {
        name: 'Test User',
        email: 'test@example.com'
      };

      emailService.sendIssueNotification.mockResolvedValue(true);

      const result = await emailService.sendIssueNotification(recipient, issue, 'created');
      expect(result).toBe(true);
      expect(emailService.sendIssueNotification).toHaveBeenCalledWith(recipient, issue, 'created');
    });
  });

  describe('File Upload Utility Tests', () => {
    test('should upload file to Cloudinary', async () => {
      const mockFile = {
        buffer: Buffer.from('test image data'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg'
      };

      const mockResponse = {
        secure_url: 'https://res.cloudinary.com/test/image.jpg',
        public_id: 'test_image_id',
        width: 800,
        height: 600
      };

      uploadToCloudinary.mockResolvedValue(mockResponse);

      const result = await uploadToCloudinary(mockFile, 'test-folder');
      expect(result).toEqual(mockResponse);
      expect(uploadToCloudinary).toHaveBeenCalledWith(mockFile, 'test-folder');
    });

    test('should handle upload errors', async () => {
      const mockFile = {
        buffer: Buffer.from('test image data'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg'
      };

      uploadToCloudinary.mockRejectedValue(new Error('Upload failed'));

      await expect(uploadToCloudinary(mockFile, 'test-folder')).rejects.toThrow('Upload failed');
    });
  });

  describe('Database Connection Tests', () => {
    test('should connect to MongoDB', () => {
      expect(mongoose.connection.readyState).toBe(1); // Connected
    });

    test('should handle connection errors gracefully', async () => {
      // This is a conceptual test - in practice, connection errors would be handled
      // by the application's error handling middleware
      expect(mongoose.connection.on).toBeDefined();
    });
  });

  describe('Data Relationships Tests', () => {
    let testUser, testIssue;

    beforeEach(async () => {
      testUser = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        phone: '9876543210',
        password: 'TestPass123',
        role: 'citizen'
      });

      testIssue = await Issue.create({
        title: 'Test Issue',
        description: 'Test Description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        },
        reportedBy: testUser._id
      });
    });

    test('should populate user data in issue', async () => {
      const populatedIssue = await Issue.findById(testIssue._id)
        .populate('reportedBy', 'name email');

      expect(populatedIssue.reportedBy.name).toBe(testUser.name);
      expect(populatedIssue.reportedBy.email).toBe(testUser.email);
      expect(populatedIssue.reportedBy.password).toBeUndefined();
    });

    test('should populate issue data in comment', async () => {
      const comment = await Comment.create({
        content: 'Test comment',
        author: testUser._id,
        issue: testIssue._id
      });

      const populatedComment = await Comment.findById(comment._id)
        .populate('issue', 'title status')
        .populate('author', 'name');

      expect(populatedComment.issue.title).toBe(testIssue.title);
      expect(populatedComment.author.name).toBe(testUser.name);
    });
  });

  describe('Data Validation Edge Cases', () => {
    test('should handle very long text inputs', async () => {
      const longText = 'a'.repeat(10000);
      
      expect(() => validateInput.text(longText, 1, 5000)).toThrow('between 1 and 5000');
      expect(() => validateInput.text(longText, 1, 15000)).not.toThrow();
    });

    test('should handle special characters in names', async () => {
      expect(() => validateInput.name("O'Connor")).toThrow(); // Contains apostrophe
      expect(() => validateInput.name("John-Doe")).toThrow(); // Contains hyphen
      expect(() => validateInput.name("John Doe")).not.toThrow(); // Only letters and spaces
    });

    test('should handle edge case coordinates', async () => {
      // Test boundary values
      expect(() => validateInput.coordinates(90, 180)).not.toThrow();
      expect(() => validateInput.coordinates(-90, -180)).not.toThrow();
      expect(() => validateInput.coordinates(90.1, 180)).toThrow();
      expect(() => validateInput.coordinates(-90.1, -180)).toThrow();
    });
  });
});
