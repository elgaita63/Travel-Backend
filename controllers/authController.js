const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { logActivityManually } = require('../middlewares/activityLogMiddleware');

// Generate JWT token with unique token ID
const generateToken = (userId, role, tokenId) => {
  return jwt.sign(
    { userId, role, tokenId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Generate unique token ID
const generateTokenId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password, role = 'seller' } = req.body;
    
    // Debug logging
    console.log('Registration request body:', { username, email, password: password ? '***' : 'undefined', role });

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    if (role && !['admin', 'seller'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either admin or seller'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      role
    });
    
    // Set password using virtual field to trigger hashing
    user.password = password;

    await user.save();

    // Generate token and session
    const tokenId = generateTokenId();
    const token = generateToken(user._id, user.role, tokenId);
    
    // Create session
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await UserSession.createSession(user._id, token, tokenId, ipAddress, userAgent, expiresAt);

    // Manually log the registration activity since req.user is not set in middleware
    try {
      await logActivityManually(
        {
          id: user._id,
          username: user.username,
          email: user.email
        },
        'user_registration',
        'user',
        `New user registered: ${user.username}`,
        {
          ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          referer: req.get('Referer'),
          requestBody: req.body,
          queryParams: req.query,
          responseStatus: 201,
          sessionId: req.sessionID,
          contentType: req.get('Content-Type'),
          acceptLanguage: req.get('Accept-Language')
        }
      );
    } catch (logError) {
      console.error('Failed to log registration activity:', logError);
      // Don't fail the registration if logging fails
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed login attempts'
      });
    }

    // Allow multiple sessions - no session validation needed
    // Users can now log in from multiple browsers/devices simultaneously

    // Generate new token and session
    const tokenId = generateTokenId();
    const token = generateToken(user._id, user.role, tokenId);
    
    // Create new session
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await UserSession.createSession(user._id, token, tokenId, ipAddress, userAgent, expiresAt);
    
    // Reset login attempts and update last login
    await user.resetLoginAttempts();

    // Manually log the login activity since req.user is not set in middleware
    try {
      await logActivityManually(
        {
          id: user._id,
          username: user.username,
          email: user.email
        },
        'user_login',
        'user',
        'User logged in',
        {
          ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          referer: req.get('Referer'),
          requestBody: req.body,
          queryParams: req.query,
          responseStatus: 200,
          sessionId: req.sessionID,
          contentType: req.get('Content-Type'),
          acceptLanguage: req.get('Accept-Language')
        }
      );
    } catch (logError) {
      console.error('Failed to log login activity:', logError);
      // Don't fail the login if logging fails
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, firstName, lastName, phone, timezone } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({ email, _id: { $ne: userId } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already taken by another user'
      });
    }

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        username,
        email,
        firstName,
        lastName,
        phone,
        'preferences.timezone': timezone
      },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          timezone: user.preferences?.timezone || 'UTC',
          role: user.role,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during profile update'
    });
  }
};

// PUT /api/auth/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during password change'
    });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const tokenId = req.user.tokenId;
    
    // Invalidate the current session
    if (tokenId) {
      await UserSession.invalidateSession(tokenId);
    }

    // Log the logout activity
    await logActivityManually(
      {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      },
      'user_logout',
      'user',
      'User logged out',
      {
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        referer: req.get('Referer'),
        requestBody: req.body,
        queryParams: req.query,
        responseStatus: 200,
        responseTime: Date.now() - req.startTime,
        sessionId: req.sessionID,
        contentType: req.get('Content-Type'),
        acceptLanguage: req.get('Accept-Language'),
        timestamp: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};

// POST /api/auth/logout-all
const logoutAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Invalidate all sessions for this user
    await UserSession.invalidateUserSessions(userId);

    // Log the logout all activity
    await logActivityManually(
      {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
      },
      'user_logout_all',
      'user',
      'User logged out from all devices',
      {
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        referer: req.get('Referer'),
        requestBody: req.body,
        queryParams: req.query,
        responseStatus: 200,
        responseTime: Date.now() - req.startTime,
        sessionId: req.sessionID,
        contentType: req.get('Content-Type'),
        acceptLanguage: req.get('Accept-Language'),
        timestamp: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout all'
    });
  }
};

// GET /api/auth/sessions
const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessions = await UserSession.getUserActiveSessions(userId);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session._id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          loginTime: session.loginTime,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          isCurrent: session.tokenId === req.user.tokenId
        }))
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching sessions'
    });
  }
};

// POST /api/auth/force-logout - Force logout a user (Admin only)
const forceLogout = async (req, res) => {
  try {
    const { userId } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Invalidate all sessions for the user
    const result = await UserSession.invalidateUserSessions(userId);

    res.json({
      success: true,
      message: `Successfully logged out user ${user.username} from all devices`,
      data: {
        userId: user._id,
        username: user.username,
        sessionsInvalidated: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during force logout'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  logoutAll,
  getActiveSessions,
  forceLogout
};