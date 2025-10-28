const express = require('express');
const router = express.Router();
const manageCurrenciesController = require('../controllers/manageCurrenciesController');
const { authenticate } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticate);

// GET /api/manage-currencies - Get all currency units and payment methods
router.get('/', manageCurrenciesController.getAll);

// POST /api/manage-currencies/currency - Add new currency unit
router.post('/currency', manageCurrenciesController.addCurrencyUnit);

// PUT /api/manage-currencies/currency/:id - Update currency unit
router.put('/currency/:id', manageCurrenciesController.updateCurrencyUnit);

// DELETE /api/manage-currencies/currency/:id - Delete currency unit
router.delete('/currency/:id', manageCurrenciesController.deleteCurrencyUnit);

// POST /api/manage-currencies/payment-method - Add new payment method
router.post('/payment-method', manageCurrenciesController.addPaymentMethod);

// PUT /api/manage-currencies/payment-method/:id - Update payment method
router.put('/payment-method/:id', manageCurrenciesController.updatePaymentMethod);

// DELETE /api/manage-currencies/payment-method/:id - Delete payment method
router.delete('/payment-method/:id', manageCurrenciesController.deletePaymentMethod);

module.exports = router;