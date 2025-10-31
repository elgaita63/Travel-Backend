const express = require('express');
const router = express.Router();
const {
  createProvider,
  getAllProviders,
  getProvider,
  updateProvider,
  deleteProvider
} = require('../controllers/providerController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');
const { providerValidations } = require('../middlewares/validationMiddleware');

// All provider routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Provider CRUD routes
router.post('/', providerValidations.create, activityLoggers.providerCreate, createProvider);
router.get('/', getAllProviders);
router.get('/:id', providerValidations.getById, getProvider);
router.put('/:id', providerValidations.update, activityLoggers.providerUpdate, updateProvider);
router.delete('/:id', activityLoggers.providerDelete, deleteProvider);

module.exports = router;