const express = require('express');
const router = express.Router();
const {
  createSale,
  createSaleNewFlow,
  createSaleServiceTemplateFlow,
  updateServiceTemplateInstance,
  removeServiceTemplateInstance,
  addServiceToSale,
  addServiceFromTemplateToSale,
  getSale,
  getAllSales,
  getVendorSales,
  updateSale,
  deleteSale,
  uploadDocuments,
  uploadTempDocuments,
  getSaleDocuments,
  getSalesStats,
  getCurrencyStats,
  getSellerMonthlyStats,
  getSellerMonthlySales,
  getAvailableQuotas,
  checkSaleStatus,
  searchSales
} = require('../controllers/saleController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { filterByOwnership } = require('../middlewares/roleMiddleware');
const { uploadMultiple, handleUploadError } = require('../middlewares/saleUploadMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');

// All sale routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Sale CRUD routes
router.post('/', activityLoggers.saleCreate, createSale);
router.post('/new-flow', activityLoggers.saleCreate, createSaleNewFlow);
router.post('/service-template-flow', activityLoggers.saleCreate, createSaleServiceTemplateFlow);

// Granular service template instance editing routes
router.patch('/:id/service-instance/:instanceId', updateServiceTemplateInstance);
router.delete('/:id/service-instance/:instanceId', removeServiceTemplateInstance);
router.get('/', filterByOwnership('createdBy'), getAllSales);
router.get('/search', filterByOwnership('createdBy'), searchSales);
router.get('/stats', filterByOwnership('createdBy'), getSalesStats);
router.get('/currency-stats', filterByOwnership('createdBy'), getCurrencyStats);
router.get('/available-quotas', getAvailableQuotas);
router.get('/seller/monthly-stats', getSellerMonthlyStats);
router.get('/seller/monthly-sales', getSellerMonthlySales);
router.get('/vendor/:providerId', getVendorSales);
router.get('/:id', getSale);
router.put('/:id', (req, res, next) => {
  console.log('🔥 Sales PUT route hit with ID:', req.params.id);
  next();
}, activityLoggers.saleUpdate, updateSale);
router.put('/:id/check-status', checkSaleStatus);
router.delete('/:id', activityLoggers.saleDelete, deleteSale);
router.post('/:id/services', activityLoggers.saleUpdate, addServiceToSale);
router.post('/:id/services-from-template', activityLoggers.saleUpdate, addServiceFromTemplateToSale);

// Document upload routes
router.post('/upload-temp', uploadMultiple, handleUploadError, uploadTempDocuments);
router.post('/:id/upload', uploadMultiple, handleUploadError, activityLoggers.documentUpload, uploadDocuments);
router.get('/:id/documents', getSaleDocuments);

module.exports = router;