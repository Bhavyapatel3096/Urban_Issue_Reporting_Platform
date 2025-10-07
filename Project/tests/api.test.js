const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Issue = require('../models/Issue');
const bcrypt = require('bcryptjs');

// Test database
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/municipal_test';

describe('Municipal Corporation API Tests', () => {
  let adminToken, citizenToken, officerToken;
  let adminUser, citizenUser, officerUser;
  let testIssue;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(MONGODB_TEST_URI);
    
    // Clear test database
    await User.deleteMany({});
    await Issue.deleteMany({});
    
    // Create test users
    const hashedPassword = await bcrypt.hash('TestPass123', 12);
    
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      phone: '9876543210',
      password: hashedPassword,
      role: 'admin',
      isVerified: true
    });
    
    citizenUser = await User.create({
      name: 'Citizen User',
      email: 'citizen@test.com',
      phone: '9876543211',
      password: hashedPassword,
      role: 'citizen',
      isVerified: true
    });
    
    officerUser = await User.create({
      name: 'Officer User',
      email: 'officer@test.com',
      phone: '9876543212',
      password: hashedPassword,
      role: 'department_head',
      department: 'roads',
      isVerified: true
    });
  });

  afterAll(async () => {
    // Clean up and disconnect
    await User.deleteMany({});
    await Issue.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Authentication Tests', () => {
    describe('POST /api/auth/register', () => {
      test('should register a new user successfully', async () => {
        const userData = {
          name: 'New User',
          email: 'newuser@test.com',
          phone: '9876543213',
          password: 'NewPass123',
          role: 'citizen'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('registered successfully');
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user.password).toBeUndefined();
      });

      test('should reject registration with invalid email', async () => {
        const userData = {
          name: 'Test User',
          email: 'invalid-email',
          phone: '9876543214',
          password: 'TestPass123',
          role: 'citizen'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid email');
      });

      test('should reject weak password', async () => {
        const userData = {
          name: 'Test User',
          email: 'test@example.com',
          phone: '9876543215',
          password: 'weak',
          role: 'citizen'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Password');
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login with valid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'citizen@test.com',
            password: 'TestPass123'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe('citizen@test.com');
        
        citizenToken = response.body.token;
      });

      test('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'citizen@test.com',
            password: 'WrongPassword'
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid credentials');
      });

      test('should login admin user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'admin@test.com',
            password: 'TestPass123'
          })
          .expect(200);

        adminToken = response.body.token;
      });

      test('should login officer user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'officer@test.com',
            password: 'TestPass123'
          })
          .expect(200);

        officerToken = response.body.token;
      });
    });
  });

  describe('Issue Management Tests', () => {
    describe('POST /api/issues', () => {
      test('should create a new issue as citizen', async () => {
        const issueData = {
          title: 'Broken Streetlight',
          description: 'The streetlight on Main Street is not working',
          category: 'infrastructure',
          subcategory: 'streetlights',
          location: {
            address: 'Main Street, Anand',
            latitude: 22.5646,
            longitude: 72.9289
          },
          priority: 'medium'
        };

        const response = await request(app)
          .post('/api/issues')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send(issueData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.issue.title).toBe(issueData.title);
        expect(response.body.issue.reportedBy).toBe(citizenUser._id.toString());
        expect(response.body.issue.status).toBe('reported');
        
        testIssue = response.body.issue;
      });

      test('should reject issue creation without authentication', async () => {
        const issueData = {
          title: 'Test Issue',
          description: 'Test Description',
          category: 'infrastructure',
          location: {
            address: 'Test Address',
            latitude: 22.5646,
            longitude: 72.9289
          }
        };

        const response = await request(app)
          .post('/api/issues')
          .send(issueData)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      test('should reject issue with invalid location', async () => {
        const issueData = {
          title: 'Test Issue',
          description: 'Test Description',
          category: 'infrastructure',
          location: {
            address: 'Test Address',
            latitude: 'invalid',
            longitude: 72.9289
          }
        };

        const response = await request(app)
          .post('/api/issues')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send(issueData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/issues', () => {
      test('should get all issues for admin', async () => {
        const response = await request(app)
          .get('/api/issues')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.issues)).toBe(true);
        expect(response.body.pagination).toBeDefined();
      });

      test('should filter issues by category', async () => {
        const response = await request(app)
          .get('/api/issues?category=infrastructure')
          .set('Authorization', `Bearer ${citizenToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.issues.forEach(issue => {
          expect(issue.category).toBe('infrastructure');
        });
      });

      test('should filter issues by status', async () => {
        const response = await request(app)
          .get('/api/issues?status=reported')
          .set('Authorization', `Bearer ${citizenToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.issues.forEach(issue => {
          expect(issue.status).toBe('reported');
        });
      });
    });

    describe('PUT /api/issues/:id', () => {
      test('should allow citizen to update their own issue', async () => {
        const updateData = {
          description: 'Updated description with more details'
        };

        const response = await request(app)
          .put(`/api/issues/${testIssue._id}`)
          .set('Authorization', `Bearer ${citizenToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.issue.description).toBe(updateData.description);
      });

      test('should not allow citizen to update other users issue', async () => {
        // Create issue as admin first
        const issueData = {
          title: 'Admin Issue',
          description: 'Issue created by admin',
          category: 'infrastructure',
          location: {
            address: 'Admin Street',
            latitude: 22.5646,
            longitude: 72.9289
          }
        };

        const createResponse = await request(app)
          .post('/api/issues')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(issueData);

        const adminIssue = createResponse.body.issue;

        // Try to update as citizen
        const response = await request(app)
          .put(`/api/issues/${adminIssue._id}`)
          .set('Authorization', `Bearer ${citizenToken}`)
          .send({ description: 'Trying to update admin issue' })
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      test('should allow officer to assign issue', async () => {
        const response = await request(app)
          .put(`/api/issues/${testIssue._id}/assign`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ assignedTo: officerUser._id.toString() })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.issue.assignedTo).toBe(officerUser._id.toString());
        expect(response.body.issue.status).toBe('in_progress');
      });

      test('should allow status update by assigned officer', async () => {
        const response = await request(app)
          .put(`/api/issues/${testIssue._id}/status`)
          .set('Authorization', `Bearer ${officerToken}`)
          .send({ 
            status: 'resolved',
            resolutionNote: 'Streetlight has been repaired'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.issue.status).toBe('resolved');
        expect(response.body.issue.resolutionNote).toBe('Streetlight has been repaired');
      });
    });

    describe('POST /api/issues/:id/upvote', () => {
      test('should allow user to upvote issue', async () => {
        const response = await request(app)
          .post(`/api/issues/${testIssue._id}/upvote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.issue.upvotes).toBe(1);
        expect(response.body.issue.upvotedBy).toContain(adminUser._id.toString());
      });

      test('should not allow duplicate upvotes', async () => {
        const response = await request(app)
          .post(`/api/issues/${testIssue._id}/upvote`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already upvoted');
      });
    });
  });

  describe('User Management Tests', () => {
    describe('GET /api/users/profile', () => {
      test('should get user profile', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${citizenToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.user.email).toBe('citizen@test.com');
        expect(response.body.user.password).toBeUndefined();
      });

      test('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/users/profile', () => {
      test('should update user profile', async () => {
        const updateData = {
          name: 'Updated Citizen Name',
          phone: '9876543299'
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.user.name).toBe(updateData.name);
        expect(response.body.user.phone).toBe(updateData.phone);
      });

      test('should reject invalid phone number', async () => {
        const updateData = {
          phone: 'invalid-phone'
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Admin Routes Tests', () => {
    describe('GET /api/admin/dashboard', () => {
      test('should get dashboard data for admin', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.stats).toBeDefined();
        expect(response.body.recentIssues).toBeDefined();
        expect(response.body.analytics).toBeDefined();
      });

      test('should reject non-admin access', async () => {
        const response = await request(app)
          .get('/api/admin/dashboard')
          .set('Authorization', `Bearer ${citizenToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/admin/users', () => {
      test('should get all users for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body.users.length).toBeGreaterThan(0);
      });

      test('should filter users by role', async () => {
        const response = await request(app)
          .get('/api/admin/users?role=citizen')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        response.body.users.forEach(user => {
          expect(user.role).toBe('citizen');
        });
      });
    });
  });

  describe('Security Tests', () => {
    test('should reject requests with MongoDB injection', async () => {
      const maliciousData = {
        email: { $ne: null },
        password: 'TestPass123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should sanitize XSS in issue creation', async () => {
      const xssData = {
        title: '<script>alert("xss")</script>Clean Title',
        description: 'Normal description',
        category: 'infrastructure',
        location: {
          address: 'Test Address',
          latitude: 22.5646,
          longitude: 72.9289
        }
      };

      const response = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(xssData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.issue.title).not.toContain('<script>');
      expect(response.body.issue.title).toContain('Clean Title');
    });

    test('should enforce rate limiting on auth routes', async () => {
      // Make multiple rapid requests
      const promises = Array(10).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'wrong'
          })
      );

      const responses = await Promise.all(promises);
      
      // Some should be rate limited
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('File Upload Tests', () => {
    test('should reject oversized files', async () => {
      // Create a large buffer (simulate file > 10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
      
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${citizenToken}`)
        .attach('photos', largeBuffer, 'large.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('too large');
    });

    test('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${citizenToken}`)
        .attach('photos', Buffer.from('test'), 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only image files');
    });
  });

  describe('Search and Filtering Tests', () => {
    beforeAll(async () => {
      // Create additional test issues for search
      await Issue.create([
        {
          title: 'Road Pothole Issue',
          description: 'Large pothole on highway',
          category: 'roads',
          reportedBy: citizenUser._id,
          location: {
            address: 'Highway Road',
            latitude: 22.5646,
            longitude: 72.9289
          },
          status: 'reported'
        },
        {
          title: 'Water Supply Problem',
          description: 'No water supply since morning',
          category: 'water',
          reportedBy: citizenUser._id,
          location: {
            address: 'Water Street',
            latitude: 22.5646,
            longitude: 72.9289
          },
          status: 'in_progress'
        }
      ]);
    });

    test('should search issues by title', async () => {
      const response = await request(app)
        .get('/api/issues?search=pothole')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.issues.length).toBeGreaterThan(0);
      expect(response.body.issues[0].title.toLowerCase()).toContain('pothole');
    });

    test('should filter by multiple criteria', async () => {
      const response = await request(app)
        .get('/api/issues?category=roads&status=reported')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.issues.forEach(issue => {
        expect(issue.category).toBe('roads');
        expect(issue.status).toBe('reported');
      });
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/issues?page=1&limit=2')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.issues.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('Authorization Tests', () => {
    test('should allow admin to access all routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should allow officer to access department routes', async () => {
      const response = await request(app)
        .get('/api/issues?department=roads')
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should restrict citizen access to admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle invalid MongoDB ObjectId', async () => {
      const response = await request(app)
        .get('/api/issues/invalid-id')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid ID');
    });

    test('should handle non-existent issue', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/issues/${nonExistentId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/issues')
        .set('Authorization', `Bearer ${citizenToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const promises = Array(20).fill().map(() =>
        request(app)
          .get('/api/issues')
          .set('Authorization', `Bearer ${citizenToken}`)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Either success or rate limited
      });
    });

    test('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/issues')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});
