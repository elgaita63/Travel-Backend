const express = require('express');
const router = express.Router();
const {
  getDestinations,
  getDestination,
  createDestination,
  updateDestination,
  deleteDestination,
  searchDestinations,
  searchCities,
  searchCountries
} = require('../controllers/destinationController');
const { authenticate } = require('../middlewares/authMiddleware');
const { requireAdminOrSeller, requireAdmin } = require('../middlewares/roleMiddleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/destinations - Get all destinations
router.get('/', getDestinations);

// GET /api/destinations/search - Search destinations with autocomplete
router.post('/search', searchDestinations);

// POST /api/destinations/search-cities - Search cities with autocomplete
router.post('/search-cities', searchCities);

// POST /api/destinations/search-countries - Search countries with autocomplete
router.post('/search-countries', searchCountries);

// GET /api/destinations/:id - Get destination by ID
router.get('/:id', getDestination);

// POST /api/destinations - Create new destination (admin/seller only)
router.post('/', requireAdminOrSeller, createDestination);

// PUT /api/destinations/:id - Update destination (admin/seller only)
router.put('/:id', requireAdminOrSeller, updateDestination);

// DELETE /api/destinations/:id - Delete destination (admin only)
router.delete('/:id', requireAdmin, deleteDestination);

module.exports = router;