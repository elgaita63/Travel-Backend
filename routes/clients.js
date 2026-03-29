const express = require('express');
const router = express.Router();
const {
  createClient,
  getClient,
  getAllClients,
  getAllClientsWithSales,
  updateClient,
  deleteClient,
  extractPassportData,
  getPassportImage,
  createClientWithCompanions,
  promoteCompanionToMain,
  getAllPassengers,
  getClientCompanions,
  getAllForSelection
} = require('../controllers/clientController');
const {
  addPassenger,
  getClientPassengers
} = require('../controllers/passengerController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const { uploadPassportImage, handleUploadError } = require('../middlewares/uploadMiddleware');
const { activityLoggers } = require('../middlewares/activityLogMiddleware');
const { passengerValidations } = require('../middlewares/validationMiddleware');

// All client routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// Client CRUD routes
router.post('/', activityLoggers.clientCreate, createClient);
router.post('/bulk', activityLoggers.clientCreate, createClientWithCompanions);
router.get('/', getAllClients);
router.get('/all-passengers', getAllPassengers);
router.get('/with-sales', getAllClientsWithSales);
router.get('/all-for-selection', getAllForSelection);

router.get('/:clientId', getClient);

// MODIFICACIÓN: Conectamos el "caño" de memoria para la edición de clientes
router.put(
  '/:clientId', 
  uploadPassportImage, // Ataja la imagen en RAM
  handleUploadError,   // Gestiona errores de formato/peso
  activityLoggers.clientUpdate, 
  updateClient
);

router.post('/:clientId/promote', activityLoggers.clientUpdate, promoteCompanionToMain);
router.delete('/:clientId', activityLoggers.clientDelete, deleteClient);

// OCR route for passport data extraction
router.post('/ocr', uploadPassportImage, handleUploadError, activityLoggers.passportOcr, extractPassportData);

// Passport image route
router.get('/:clientId/passport-image', getPassportImage);

// Passenger routes for specific client
router.post('/:clientId/passengers', passengerValidations.create, activityLoggers.passengerCreate, addPassenger);
router.get('/:clientId/passengers', getClientPassengers);

// Companion routes for specific client
router.get('/:clientId/companions', getClientCompanions);

module.exports = router;