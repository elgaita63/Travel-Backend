const express = require('express');
const router = express.Router();
const {
  getPassenger,
  updatePassenger,
  deletePassenger,
  extractPassengerPassportData,
  getPassengerPassportImage
} = require('../controllers/passengerController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { uploadPassportImage, handleUploadError } = require('../middlewares/uploadMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');
const { passengerValidations } = require('../middlewares/validationMiddleware');
const path = require('path');

// All passenger routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Passenger CRUD routes
router.get('/:passengerId', passengerValidations.getById, getPassenger);

// MODIFICACIÓN: Agregamos el middleware de subida a la edición de pasajeros
router.put(
  '/:passengerId', 
  uploadPassportImage, // Ataja la imagen en memoria
  handleUploadError,   // Maneja errores de tamaño/tipo
  passengerValidations.update, 
  activityLoggers.passengerUpdate, 
  updatePassenger
);

router.delete('/:passengerId', activityLoggers.passengerDelete, deletePassenger);

// OCR route for passenger passport data extraction
router.post('/ocr', uploadPassportImage, handleUploadError, activityLoggers.passengerCreate, extractPassengerPassportData);

// Passenger passport image route
router.get('/:passengerId/passport-image', getPassengerPassportImage);

module.exports = router;