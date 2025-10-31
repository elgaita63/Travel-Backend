const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  loginTime: {
    type: Date,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create a new session
userSessionSchema.statics.createSession = function(userId, token, tokenId, ipAddress, userAgent, expiresAt) {
  return this.create({
    userId,
    token,
    tokenId,
    ipAddress,
    userAgent,
    expiresAt
  });
};

// Static method to invalidate all sessions for a user
userSessionSchema.statics.invalidateUserSessions = function(userId, excludeTokenId = null) {
  const query = { userId, isActive: true };
  if (excludeTokenId) {
    query.tokenId = { $ne: excludeTokenId };
  }
  
  return this.updateMany(query, {
    isActive: false,
    logoutTime: new Date()
  });
};

// Static method to invalidate a specific session
userSessionSchema.statics.invalidateSession = function(tokenId) {
  return this.updateOne(
    { tokenId },
    {
      isActive: false,
      logoutTime: new Date()
    }
  );
};

// Static method to check if a session is valid
userSessionSchema.statics.isValidSession = function(tokenId) {
  return this.findOne({
    tokenId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to update last activity
userSessionSchema.statics.updateActivity = function(tokenId) {
  return this.updateOne(
    { tokenId, isActive: true },
    { lastActivity: new Date() }
  );
};

// Static method to cleanup expired sessions
userSessionSchema.statics.cleanupExpiredSessions = function() {
  return this.updateMany(
    {
      isActive: true,
      expiresAt: { $lte: new Date() }
    },
    {
      isActive: false,
      logoutTime: new Date()
    }
  );
};

// Static method to get active sessions for a user
userSessionSchema.statics.getUserActiveSessions = function(userId) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

// Instance method to check if session is expired
userSessionSchema.methods.isExpired = function() {
  return this.expiresAt <= new Date();
};

// Transform output to remove sensitive data
userSessionSchema.methods.toJSON = function() {
  const sessionObject = this.toObject();
  delete sessionObject.token;
  delete sessionObject.__v;
  return sessionObject;
};

module.exports = mongoose.model('UserSession', userSessionSchema);