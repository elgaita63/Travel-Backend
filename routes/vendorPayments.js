const express = require('express');
const router = express.Router();
const {
  createVendorPayment,
  getVendorPayments,
  getVendorPaymentsByProvider,
  getVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  getProviderPaymentSummary
} = require('../controllers/vendorPaymentController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');

// All vendor payment routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Vendor payment CRUD routes
router.post('/', createVendorPayment);
router.get('/', getVendorPayments);
router.get('/provider/:providerId', getVendorPaymentsByProvider);
router.get('/provider/:providerId/summary', getProviderPaymentSummary);
router.get('/:id', getVendorPayment);
router.put('/:id', updateVendorPayment);
router.delete('/:id', deleteVendorPayment);

module.exports = router;