const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { uploadPassportImage, handleUploadError } = require('../middlewares/uploadMiddleware');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/provider-documents');
    
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter to allow certain file types
const fileFilter = (req, file, cb) => {
  // Allow images, PDFs, and common document types
  const allowedMimeTypes = [
    'image/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];
  
  const isAllowed = allowedMimeTypes.some(type => 
    file.mimetype.startsWith(type) || file.mimetype === type
  );
  
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: images, PDF, Word documents, Excel files, and text files`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload provider document endpoint
router.post('/provider-document', upload.single('file'), async (req, res) => {
  try {
    console.log('📁 Upload request received:', {
      hasFile: !!req.file,
      providerId: req.body.providerId,
      saleId: req.body.saleId,
      fileInfo: req.file ? {
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { providerId, saleId } = req.body;
    
    if (!providerId) {
      console.log('❌ No providerId in request body');
      return res.status(400).json({
        success: false,
        message: 'Provider ID is required'
      });
    }

    // Create relative URL for the uploaded file
    const fileUrl = `/uploads/provider-documents/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

    console.log('✅ File uploaded successfully:', {
      filename: req.file.filename,
      url: fullUrl,
      providerId
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      providerId: providerId,
      saleId: saleId
    });

  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  }
});

// Serve uploaded files
router.get('/provider-documents/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/provider-documents', filename);
  
  // Check if file exists
  fs.access(filePath)
    .then(() => {
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    });
});

// Passport image upload endpoint
router.post('/passport', uploadPassportImage, handleUploadError, async (req, res) => {
  try {
    console.log('📁 Passport upload request received:', {
      hasFile: !!req.file,
      fileInfo: req.file ? {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    if (!req.file) {
      console.log('❌ No passport file in request');
      return res.status(400).json({
        success: false,
        message: 'No passport image uploaded'
      });
    }

    // Create relative URL for the uploaded file
    const fileUrl = `/uploads/passports/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

    console.log('✅ Passport image uploaded successfully:', {
      filename: req.file.filename,
      url: fullUrl
    });

    res.json({
      success: true,
      message: 'Passport image uploaded successfully',
      url: fullUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

  } catch (error) {
    console.error('❌ Passport upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Passport upload failed',
      error: error.message
    });
  }
});

// Serve passport images
router.get('/passports/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads/passports', filename);
  
  // Check if file exists
  fs.access(filePath)
    .then(() => {
      res.sendFile(filePath);
    })
    .catch(() => {
      res.status(404).json({
        success: false,
        message: 'Passport image not found'
      });
    });
});

module.exports = router;