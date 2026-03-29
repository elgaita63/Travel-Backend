const multer = require('multer');

// 1. Configuramos el almacenamiento en MEMORIA
// El archivo no se guarda en disco, queda disponible en req.file.buffer
const storage = multer.memoryStorage();

// 2. Filtro de archivos para imágenes de pasaportes/perfil
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff/;
  const isAllowed = allowedTypes.test(file.mimetype) || allowedTypes.test(file.originalname.toLowerCase());
  
  if (isAllowed) {
    return cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, BMP, TIFF)'));
  }
};

// 3. Configuración de Multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Límite de 5MB
    files: 1 
  },
  fileFilter: fileFilter
});

// 4. Middleware para la subida de una sola imagen
const uploadPassportImage = upload.single('passportImage');

// 5. Manejo de errores personalizado
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        message: 'El archivo es muy pesado (Máximo 5MB).' 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        success: false, 
        message: 'Solo se permite subir una imagen a la vez.' 
      });
    }
  }
  
  if (error.message && error.message.includes('Solo se permiten imágenes')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  uploadPassportImage,
  handleUploadError
};