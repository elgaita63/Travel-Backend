const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, logout, logoutAll, getActiveSessions, forceLogout } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.put('/password', authenticate, changePassword);
router.post('/logout', authenticate, activityLoggers.userLogout, logout);
router.post('/logout-all', authenticate, activityLoggers.userLogout, logoutAll);
router.get('/sessions', authenticate, getActiveSessions);
router.post('/force-logout', authenticate, requireAdmin, forceLogout);

module.exports = router;