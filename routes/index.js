const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const clientRoutes = require('./clients');
const passengerRoutes = require('./passengers');
const providerRoutes = require('./providers');
const serviceRoutes = require('./services');
const serviceTemplateRoutes = require('./serviceTemplates');
const serviceTypeRoutes = require('./serviceTypes');
const serviceProviderRoutes = require('./serviceProviders');
const saleRoutes = require('./sales');
const paymentRoutes = require('./payments');
const cupoRoutes = require('./cupos');
const reportRoutes = require('./reports');
const notificationRoutes = require('./notifications');
const systemRoutes = require('./system');
const activityLogRoutes = require('./activityLogs');
const receiptRoutes = require('./receipts');
const dailyReportRoutes = require('./dailyReports');
const vendorPaymentRoutes = require('./vendorPayments');
const adminInsightsRoutes = require('./adminInsights');
const destinationRoutes = require('./destinations');
const uploadRoutes = require('./upload');
const manageCurrenciesRoutes = require('./manageCurrencies');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clients', clientRoutes);
router.use('/passengers', passengerRoutes);
router.use('/providers', providerRoutes);
router.use('/services', serviceRoutes);
router.use('/service-templates', serviceTemplateRoutes);
router.use('/service-types', serviceTypeRoutes);
router.use('/service-providers', serviceProviderRoutes);
router.use('/sales', saleRoutes);
router.use('/payments', paymentRoutes);
router.use('/cupos', cupoRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/system', systemRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/receipts', receiptRoutes);
router.use('/daily-reports', dailyReportRoutes);
router.use('/vendor-payments', vendorPaymentRoutes);
router.use('/admin-insights', adminInsightsRoutes);
router.use('/destinations', destinationRoutes);
router.use('/upload', uploadRoutes);
router.use('/manage-currencies', manageCurrenciesRoutes);

module.exports = router;