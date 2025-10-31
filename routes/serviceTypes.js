const express = require('express');
const router = express.Router();
const serviceTypeController = require('../controllers/serviceTypeController');
const { authenticate } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/service-types - Get all service types
router.get('/', serviceTypeController.getAllServiceTypes);

// GET /api/service-types/stats - Get service type statistics
router.get('/stats', serviceTypeController.getServiceTypeStats);

// GET /api/service-types/:id - Get service type by ID
router.get('/:id', serviceTypeController.getServiceTypeById);

// POST /api/service-types - Create new service type
router.post('/', serviceTypeController.createServiceType);

// PUT /api/service-types/:id - Update service type
router.put('/:id', serviceTypeController.updateServiceType);

// DELETE /api/service-types/:id - Delete service type (soft delete)
router.delete('/:id', serviceTypeController.deleteServiceType);

module.exports = router;
