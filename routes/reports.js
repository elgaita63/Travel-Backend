const express = require('express');
const router = express.Router();
const {
  getBankTransferPaymentsReport,
  getSellerPaymentSummary,
  getReconciliationReport,
  getKPIs,
  getSalesData,
  getProfitData,
  getBalancesData,
  getClientBalanceData,
  getProviderBalanceData,
  getTopServicesData,
  getPaymentMethodsReport,
  getCurrencySummary,
  getClientPaymentsReport,
  getSupplierPaymentsReport
} = require('../controllers/reportController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { filterByOwnership } = require('../middlewares/roleMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');

// All report routes require authentication and admin access
router.use(authenticate);
router.use(requireAdminOrSeller);
// Filter data by ownership for sellers (admins see all data)
router.use(filterByOwnership('createdBy'));

// Dashboard KPI routes
router.get('/kpis', activityLoggers.reportView, getKPIs);
router.get('/sales', activityLoggers.reportView, getSalesData);
router.get('/profit', activityLoggers.reportView, getProfitData);
router.get('/balances', activityLoggers.reportView, getBalancesData);
router.get('/client-balance', activityLoggers.reportView, getClientBalanceData);
router.get('/provider-balance', activityLoggers.reportView, getProviderBalanceData);
router.get('/top-services', activityLoggers.reportView, getTopServicesData);

// Payment reports routes
router.get('/payments/bank-transfers', activityLoggers.reportView, getBankTransferPaymentsReport);
router.get('/payments/seller-summary', activityLoggers.reportView, getSellerPaymentSummary);
router.get('/payments/reconciliation', activityLoggers.reportView, getReconciliationReport);
router.get('/payment-methods', activityLoggers.reportView, getPaymentMethodsReport);

// Dedicated payment type reports
router.get('/payments/client', activityLoggers.reportView, getClientPaymentsReport);
router.get('/payments/supplier', activityLoggers.reportView, getSupplierPaymentsReport);

// Currency-specific reports
router.get('/currency-summary', activityLoggers.reportView, getCurrencySummary);

module.exports = router;