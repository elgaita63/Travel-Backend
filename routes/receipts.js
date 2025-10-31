const express = require('express');
const router = express.Router();
const { extractReceiptData, generateReceipt, getReceipts, markAsSent, markAsResponded } = require('../controllers/receiptController');
const { authenticate, requireAdminOrSeller } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const { ensureUploadDirectory } = require('../utils/uploadUtils');

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/receipts/';
    // Ensure directory exists before saving file
    ensureUploadDirectory(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadReceipt = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) and PDF files are allowed'));
    }
  }
});

// Error handling middleware for file uploads
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
  }
  
  if (error.message === 'Only image files (JPEG, PNG, GIF) and PDF files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only image files (JPEG, PNG, GIF) and PDF files are allowed.'
    });
  }
  
  next(error);
};

// All receipt routes require authentication
router.use(authenticate);
router.use(requireAdminOrSeller);

// GET /api/receipts - Get receipts with optional filtering
router.get('/', getReceipts);

// POST /api/receipts/extract - Extract data from receipt
router.post('/extract', uploadReceipt.single('receipt'), handleUploadError, extractReceiptData);

// POST /api/receipts/generate - Generate a provisional receipt
router.post('/generate', generateReceipt);

// PUT /api/receipts/:id/mark-sent - Mark a receipt as sent via WhatsApp
router.put('/:id/mark-sent', markAsSent);

// PUT /api/receipts/:id/mark-responded - Mark a receipt as responded to
router.put('/:id/mark-responded', markAsResponded);

module.exports = router;