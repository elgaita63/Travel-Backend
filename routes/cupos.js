const express = require('express');
const router = express.Router();
const {
  createCupo,
  getAllCupos,
  getCupo,
  updateCupo,
  deleteCupo,
  reserveSeats,
  getAvailableCupos,
  getCuposCalendar
} = require('../controllers/cupoController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');
const { uploadInvoices, handleUploadError } = require('../middlewares/saleUploadMiddleware');

// All cupo routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Cupo CRUD routes
router.post('/', activityLoggers.cupoCreate, createCupo);
router.get('/', getAllCupos);
router.get('/available', getAvailableCupos);
router.get('/calendar', getCuposCalendar);
router.get('/:id', getCupo);
router.put('/:id', activityLoggers.cupoUpdate, updateCupo);
router.delete('/:id', activityLoggers.cupoDelete, deleteCupo);

// Reservation route with file upload support
router.put('/:id/reserve', uploadInvoices, handleUploadError, activityLoggers.cupoUpdate, reserveSeats);

module.exports = router;