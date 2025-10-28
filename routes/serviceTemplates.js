const express = require('express');
const router = express.Router();
const {
  getAllServiceTemplates,
  getServiceTemplatesForSaleWizard,
  cleanupServiceTemplates,
  getServiceTemplate,
  createServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  getServiceTemplateCategories
} = require('../controllers/serviceTemplateController');
const { authenticate, requireAdmin } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');
const { serviceTemplateValidations } = require('../middlewares/validationMiddleware');

// All service template routes require authentication
router.use(authenticate);

// Service template CRUD routes
router.post('/', serviceTemplateValidations.create, activityLoggers.serviceTemplateCreate, createServiceTemplate);
router.get('/', getAllServiceTemplates);
router.get('/sale-wizard', getServiceTemplatesForSaleWizard);
router.post('/cleanup', requireAdmin, cleanupServiceTemplates);
router.get('/categories', requireAdmin, getServiceTemplateCategories); // Admin only
router.get('/:id', serviceTemplateValidations.getById, getServiceTemplate);
router.put('/:id', serviceTemplateValidations.update, activityLoggers.serviceTemplateUpdate, updateServiceTemplate);
router.delete('/:id', activityLoggers.serviceTemplateDelete, deleteServiceTemplate);

module.exports = router;