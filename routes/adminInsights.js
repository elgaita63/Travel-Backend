const express = require('express');
const router = express.Router();
const {
  getAdminOverview,
  getSellerPerformance,
  getTransactionDetails,
  getMonthlyTrends,
  exportInsights,
  generateInsights,
  getPaymentAnalytics,
  getCustomerPayments,
  getSupplierPayments
} = require('../controllers/adminInsightsController');
const { authenticate, requireAdmin } = require('../middlewares/authMiddleware');

// All admin insights routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin-insights/overview - Get comprehensive admin overview
router.get('/overview', getAdminOverview);

// GET /api/admin-insights/seller-performance - Get detailed seller performance
router.get('/seller-performance', getSellerPerformance);

// GET /api/admin-insights/transaction-details - Get detailed transaction data
router.get('/transaction-details', getTransactionDetails);

// GET /api/admin-insights/monthly-trends - Get monthly performance trends
router.get('/monthly-trends', getMonthlyTrends);

// GET /api/admin-insights/export - Export insights data
router.get('/export', exportInsights);

// POST /api/admin-insights/generate - Manually generate insights
router.post('/generate', generateInsights);

// GET /api/admin-insights/payments - Get comprehensive payment analytics
router.get('/payments', getPaymentAnalytics);

// GET /api/admin-insights/customer-payments - Get customer payments with payment method filtering
router.get('/customer-payments', getCustomerPayments);

// GET /api/admin-insights/supplier-payments - Get supplier payments with filtering
router.get('/supplier-payments', getSupplierPayments);

module.exports = router;