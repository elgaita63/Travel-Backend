const UserSession = require('../models/UserSession');

class SessionCleanupService {
  constructor() {
    this.cleanupInterval = null;
    this.cleanupIntervalMs = 60 * 60 * 1000; // 1 hour
  }

  // Start the cleanup service
  start() {
    if (this.cleanupInterval) {
      console.log('Session cleanup service is already running');
      return;
    }

    console.log('Starting session cleanup service...');
    
    // Run cleanup immediately
    this.performCleanup();
    
    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs);

    console.log(`Session cleanup service started (interval: ${this.cleanupIntervalMs / 1000}s)`);
  }

  // Stop the cleanup service
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Session cleanup service stopped');
    }
  }

  // Perform the actual cleanup
  async performCleanup() {
    try {
      console.log('Starting session cleanup...');
      
      const result = await UserSession.cleanupExpiredSessions();
      
      if (result.modifiedCount > 0) {
        console.log(`Session cleanup completed: ${result.modifiedCount} expired sessions invalidated`);
      } else {
        console.log('Session cleanup completed: No expired sessions found');
      }
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  // Manual cleanup trigger
  async manualCleanup() {
    console.log('Manual session cleanup triggered...');
    await this.performCleanup();
  }
}

// Create singleton instance
const sessionCleanupService = new SessionCleanupService();

module.exports = sessionCleanupService;