const express = require('express');
const router = express.Router();
const {
  generateDailyReport,
  getDailyReports,
  getTodayReport,
  getDailyReport,
  getDailyReportByDate,
  updatePassengerStatus,
  markReportAsSent,
  markReportAsResponded,
  getWhatsAppShareUrl,
  getDailyReportStatistics,
  populateSampleData,
  getTodayArrivals
} = require('../controllers/dailyReportController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');

// All daily report routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Daily report CRUD routes
router.post('/generate', activityLoggers.reportCreate, generateDailyReport);
router.get('/', getDailyReports);
router.get('/today', getTodayReport);
router.get('/today-arrivals', getTodayArrivals);
router.get('/date/:date', getDailyReportByDate);
router.get('/statistics', getDailyReportStatistics);

// ID-based routes (must come after specific routes)
router.get('/:id', getDailyReport);
router.get('/:id/whatsapp-url', getWhatsAppShareUrl);
router.put('/:id/mark-sent', activityLoggers.reportUpdate, markReportAsSent);
router.put('/:id/mark-responded', activityLoggers.reportUpdate, markReportAsResponded);
router.put('/:id/passenger/:passengerId/status', activityLoggers.reportUpdate, updatePassengerStatus);
router.put('/:id/populate-sample', populateSampleData);

module.exports = router;