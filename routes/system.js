const express = require('express');
const router = express.Router();
const { 
  getSystemHealth, 
  backupDatabase, 
  resetDatabase, 
  clearCache, 
  listBackups,
  getPaymentMethods,
  testOpenAI,
  testOpenAIReceipt
} = require('../controllers/systemController');
const { authenticate, requireAdmin, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');

// All system routes require authentication
router.use(authenticate);

// Payment methods route - available to both admin and seller
router.get('/payment-methods', getPaymentMethods);

// OpenAI test routes - available to both admin and seller
router.get('/test-openai', testOpenAI);
router.get('/test-openai-receipt', testOpenAIReceipt);

// Admin-only system management routes
router.use(requireAdmin);
router.get('/health', activityLoggers.systemHealthCheck, getSystemHealth);
router.post('/backup', activityLoggers.systemBackup, backupDatabase);
router.post('/reset', activityLoggers.systemReset, resetDatabase);
router.post('/clear-cache', activityLoggers.systemCacheClear, clearCache);
router.get('/backups', listBackups);

module.exports = router;