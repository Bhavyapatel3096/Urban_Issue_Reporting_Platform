const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.firstName} ${socket.user.lastName} (${socket.userId})`);
    
    // Join user-specific room for notifications
    socket.join(`user_${socket.userId}`);
    
    // Join role-based rooms
    socket.join(`role_${socket.user.role}`);
    
    // Join department room if applicable
    if (socket.user.department && socket.user.department !== 'general') {
      socket.join(`dept_${socket.user.department}`);
    }

    // Handle joining specific issue rooms for real-time updates
    socket.on('join_issue', (issueId) => {
      socket.join(`issue_${issueId}`);
      console.log(`User ${socket.userId} joined issue room: ${issueId}`);
    });

    socket.on('leave_issue', (issueId) => {
      socket.leave(`issue_${issueId}`);
      console.log(`User ${socket.userId} left issue room: ${issueId}`);
    });

    // Handle real-time typing indicators for comments
    socket.on('typing_start', (data) => {
      socket.to(`issue_${data.issueId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.firstName + ' ' + socket.user.lastName,
        issueId: data.issueId
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`issue_${data.issueId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        issueId: data.issueId
      });
    });

    // Handle location tracking for field officers
    socket.on('update_location', (location) => {
      if (socket.user.role === 'field_officer') {
        socket.to(`dept_${socket.user.department}`).emit('officer_location_update', {
          userId: socket.userId,
          userName: socket.user.firstName + ' ' + socket.user.lastName,
          location: location,
          timestamp: new Date()
        });
      }
    });

    // Handle issue status updates
    socket.on('issue_status_update', (data) => {
      // Broadcast to all users watching this issue
      socket.to(`issue_${data.issueId}`).emit('issue_updated', {
        issueId: data.issueId,
        status: data.status,
        updatedBy: {
          id: socket.userId,
          name: socket.user.firstName + ' ' + socket.user.lastName
        },
        timestamp: new Date()
      });
    });

    // Handle new comments
    socket.on('new_comment', (data) => {
      socket.to(`issue_${data.issueId}`).emit('comment_added', {
        issueId: data.issueId,
        comment: data.comment,
        author: {
          id: socket.userId,
          name: socket.user.firstName + ' ' + socket.user.lastName,
          role: socket.user.role
        },
        timestamp: new Date()
      });
    });

    // Handle direct messages between users
    socket.on('direct_message', (data) => {
      socket.to(`user_${data.recipientId}`).emit('new_message', {
        senderId: socket.userId,
        senderName: socket.user.firstName + ' ' + socket.user.lastName,
        message: data.message,
        timestamp: new Date()
      });
    });

    // Handle emergency alerts
    socket.on('emergency_alert', (data) => {
      if (socket.user.role === 'admin') {
        // Broadcast emergency alert to all connected users
        io.emit('emergency_notification', {
          title: data.title,
          message: data.message,
          severity: data.severity || 'high',
          timestamp: new Date()
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.user.firstName} ${socket.user.lastName} - Reason: ${reason}`);
      
      // Notify users in the same issue rooms that this user went offline
      socket.rooms.forEach(room => {
        if (room.startsWith('issue_')) {
          socket.to(room).emit('user_offline', {
            userId: socket.userId,
            userName: socket.user.firstName + ' ' + socket.user.lastName
          });
        }
      });
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // Handle server-side events
  io.engine.on('connection_error', (err) => {
    console.error('Socket connection error:', err);
  });

  return io;
};

// Utility functions for emitting events from other parts of the application

const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

const emitToRole = (role, event, data) => {
  if (io) {
    io.to(`role_${role}`).emit(event, data);
  }
};

const emitToDepartment = (department, event, data) => {
  if (io) {
    io.to(`dept_${department}`).emit(event, data);
  }
};

const emitToIssue = (issueId, event, data) => {
  if (io) {
    io.to(`issue_${issueId}`).emit(event, data);
  }
};

const broadcastNotification = (notification) => {
  if (io) {
    // Send to specific user
    if (notification.recipient) {
      emitToUser(notification.recipient, 'notification', notification);
    }
    
    // Also broadcast to relevant groups based on notification type
    if (notification.type === 'system_announcement') {
      io.emit('system_notification', notification);
    } else if (notification.type === 'department_update' && notification.department) {
      emitToDepartment(notification.department, 'department_notification', notification);
    }
  }
};

const getConnectedUsers = () => {
  if (io) {
    const users = [];
    io.sockets.sockets.forEach((socket) => {
      if (socket.user) {
        users.push({
          id: socket.userId,
          name: socket.user.firstName + ' ' + socket.user.lastName,
          role: socket.user.role,
          department: socket.user.department,
          connectedAt: socket.connectedAt || new Date()
        });
      }
    });
    return users;
  }
  return [];
};

const getIO = () => io;

module.exports = {
  initializeSocket,
  emitToUser,
  emitToRole,
  emitToDepartment,
  emitToIssue,
  broadcastNotification,
  getConnectedUsers,
  getIO
};
