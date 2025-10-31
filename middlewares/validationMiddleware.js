const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * Handle validation results
 */
const handleValidationResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== VALIDATION ERRORS ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Validation errors:', errors.array());
    console.log('========================');
    
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    throw new ValidationError('Validation failed', errorMessages);
  }
  next();
};

/**
 * Common validation rules
 */
const commonValidations = {
  // ObjectId validation
  objectId: (field) => param(field).isMongoId().withMessage('Invalid ID format'),
  
  // Email validation
  email: (field = 'email') => body(field)
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation
  password: (field = 'password') => body(field)
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  // Phone validation
  phone: (field = 'phone') => body(field)
    .optional()
    .custom((value) => {
      if (!value) return true; // Optional field
      
      // Remove all non-digit characters except + at the beginning
      const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
      
      // Check if it starts with + and has 10-15 digits, or just has 10-15 digits
      const phoneRegex = /^(\+?[1-9]\d{9,14})$/;
      
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Please provide a valid phone number (10-15 digits, optionally starting with +)');
      }
      
      return true;
    }),
  
  // Date validation
  date: (field) => body(field)
    .isISO8601()
    .withMessage('Please provide a valid date in ISO format'),
  
  // Currency validation
  currency: (field) => body(field)
    .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
    .withMessage('Please provide a valid currency code'),
  
  // Positive number validation
  positiveNumber: (field) => body(field)
    .isFloat({ min: 0 })
    .withMessage('Value must be a positive number'),
  
  // Required string validation
  requiredString: (field, minLength = 1, maxLength = 255) => body(field)
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`Field must be between ${minLength} and ${maxLength} characters`),
  
  // Optional string validation
  optionalString: (field, minLength = 0, maxLength = 255) => body(field)
    .optional()
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`Field must be between ${minLength} and ${maxLength} characters`),
  
  // Role validation
  role: (field = 'role') => body(field)
    .isIn(['admin', 'seller', 'viewer'])
    .withMessage('Role must be admin, seller, or viewer'),
  
  // Status validation
  status: (field, allowedStatuses = ['active', 'inactive', 'pending']) => body(field)
    .optional()
    .isIn(allowedStatuses)
    .withMessage(`Status must be one of: ${allowedStatuses.join(', ')}`),
  
  // Pagination validation
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

/**
 * User validation rules
 */
const userValidations = {
  register: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores'),
    
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.role(),
    
    handleValidationResults
  ],
  
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    
    handleValidationResults
  ],
  
  updateProfile: [
    commonValidations.optionalString('username', 30),
    commonValidations.email('email').optional(),
    commonValidations.phone(),
    
    handleValidationResults
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    commonValidations.password('newPassword'),
    
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      }),
    
    handleValidationResults
  ]
};

/**
 * Client validation rules
 */
const clientValidations = {
  create: [
    commonValidations.requiredString('name', 1, 50),
    commonValidations.requiredString('surname', 1, 50),
    
    body('dob')
      .isISO8601()
      .withMessage('Please provide a valid date of birth')
      .custom((value) => {
        const dob = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        if (age < 0 || age > 120) {
          throw new Error('Please provide a valid date of birth');
        }
        return true;
      }),
    
    commonValidations.email(),
    commonValidations.phone(),
    
    body('passportNumber')
      .trim()
      .isLength({ min: 5, max: 20 })
      .withMessage('Passport number must be between 5 and 20 characters'),
    
    body('nationality')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Nationality must be between 2 and 50 characters'),
    
    body('expirationDate')
      .isISO8601()
      .withMessage('Please provide a valid passport expiration date')
      .custom((value) => {
        const expDate = new Date(value);
        const today = new Date();
        if (expDate <= today) {
          throw new Error('Passport expiration date must be in the future');
        }
        return true;
      }),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('id'),
    commonValidations.optionalString('name', 1, 50),
    commonValidations.optionalString('surname', 1, 50),
    commonValidations.email('email').optional(),
    commonValidations.phone(),
    
    body('dob')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date of birth'),
    
    body('passportNumber')
      .optional()
      .trim()
      .isLength({ min: 5, max: 20 })
      .withMessage('Passport number must be between 5 and 20 characters'),
    
    body('nationality')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Nationality must be between 2 and 50 characters'),
    
    body('expirationDate')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid passport expiration date'),
    
    body('preferences.specialRequests')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Special requests cannot exceed 500 characters'),
    
    handleValidationResults
  ],
  
  getById: [
    commonValidations.objectId('id'),
    handleValidationResults
  ]
};

/**
 * Sale validation rules
 */
const saleValidations = {
  create: [
    body('clientId')
      .isMongoId()
      .withMessage('Please provide a valid client ID'),
    
    body('passengers')
      .isArray({ min: 1 })
      .withMessage('At least one passenger is required'),
    
    body('passengers.*.passengerId')
      .optional()
      .isMongoId()
      .withMessage('Please provide valid passenger IDs'),
    
    body('passengers.*.isMainClient')
      .optional()
      .isBoolean()
      .withMessage('isMainClient must be a boolean'),
    
    body('passengers.*.clientId')
      .optional()
      .isMongoId()
      .withMessage('Please provide valid client ID'),
    
    body('passengers.*.price')
      .isFloat({ min: 0 })
      .withMessage('Passenger price must be a positive number'),
    
    body('passengers').custom((passengers) => {
      for (const passenger of passengers) {
        if (!passenger.passengerId && !passenger.isMainClient) {
          throw new Error('Each passenger must have either a passengerId or isMainClient flag');
        }
        if (passenger.passengerId && passenger.isMainClient) {
          throw new Error('Passenger cannot have both passengerId and isMainClient flag');
        }
        if (passenger.isMainClient && !passenger.clientId) {
          throw new Error('Main client passenger must have a clientId');
        }
      }
      return true;
    }),
    
    body('services')
      .isArray({ min: 1 })
      .withMessage('At least one service is required'),
    
    body('services.*.serviceId')
      .isMongoId()
      .withMessage('Please provide valid service IDs'),
    
    body('services.*.priceClient')
      .isFloat({ min: 0 })
      .withMessage('Client price must be a positive number'),
    
    body('services.*.costProvider')
      .isFloat({ min: 0 })
      .withMessage('Provider cost must be a positive number'),
    
    body('services.*.currency')
      .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
      .withMessage('Please provide a valid currency code'),
    
    body('saleCurrency')
      .optional()
      .isIn(['USD', 'ARS', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
      .withMessage('Please provide a valid sale currency code'),
    
    body('status')
      .optional()
      .isIn(['open', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Invalid status'),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('id'),
    
    body('clientId')
      .optional()
      .isMongoId()
      .withMessage('Please provide a valid client ID'),
    
    body('saleCurrency')
      .optional()
      .isIn(['USD', 'ARS', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
      .withMessage('Please provide a valid sale currency code'),
    
    body('status')
      .optional()
      .isIn(['open', 'confirmed', 'cancelled', 'completed'])
      .withMessage('Invalid status'),
    
    handleValidationResults
  ],
  
  getById: [
    commonValidations.objectId('id'),
    handleValidationResults
  ]
};

/**
 * Payment validation rules
 */
const paymentValidations = {
  create: [
    body('saleId')
      .isMongoId()
      .withMessage('Please provide a valid sale ID'),
    
    body('type')
      .isIn(['client', 'provider'])
      .withMessage('Payment type must be client or provider'),
    
    body('method')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Payment method is required'),
    
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    
    body('currency')
      .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
      .withMessage('Please provide a valid currency code'),
    
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date'),
    
    handleValidationResults
  ],
  
  getBySale: [
    commonValidations.objectId('saleId'),
    handleValidationResults
  ]
};

/**
 * Provider validation rules
 */
const providerValidations = {
  create: [
    // Only validate the name field as required
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Provider name is required and must be between 1 and 100 characters'),
    
    // All other fields are optional with minimal validation
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    
    body('contactInfo.phone')
      .optional()
      .isLength({ max: 20 })
      .withMessage('Phone number must not exceed 20 characters'),
    
    body('contactInfo.email')
      .optional()
      .custom((value) => {
        if (!value || value === '') return true;
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        return emailRegex.test(value);
      })
      .withMessage('Please provide a valid email address'),
    
    body('contactInfo.website')
      .optional()
      .custom((value) => {
        if (!value || value === '') return true;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      })
      .withMessage('Please provide a valid website URL'),
    
    body('contactInfo.address.street')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Street address must not exceed 100 characters'),
    
    body('contactInfo.address.city')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('City must not exceed 50 characters'),
    
    body('contactInfo.address.state')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('State must not exceed 50 characters'),
    
    body('contactInfo.address.country')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Country must not exceed 50 characters'),
    
    body('contactInfo.address.zipCode')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Zip code must not exceed 20 characters'),
    
    body('commissionRate')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Commission rate must be between 0 and 100'),
    
    body('paymentTerms')
      .optional()
      .isIn(['immediate', 'net_15', 'net_30', 'net_45', 'net_60'])
      .withMessage('Payment terms must be immediate, net_15, net_30, net_45, or net_60'),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('id'),
    
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Provider name must be between 1 and 100 characters'),
    
    body('type')
      .optional()
      .custom(async (value) => {
        if (!value || value === '') return true;
        // Allow any non-empty string for dynamic provider types
        // The actual validation will be done in the controller
        return typeof value === 'string' && value.trim().length > 0;
      })
      .withMessage('Provider type must be a non-empty string'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    
    body('contactInfo.phone')
      .optional()
      .isLength({ min: 0, max: 20 })
      .withMessage('Phone number must not exceed 20 characters'),
    
    body('contactInfo.email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('contactInfo.website')
      .optional()
      .isURL()
      .withMessage('Please provide a valid website URL'),
    
    body('contactInfo.address.street')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Street address must not exceed 100 characters'),
    
    body('contactInfo.address.city')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('City must not exceed 50 characters'),
    
    body('contactInfo.address.state')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('State must not exceed 50 characters'),
    
    body('contactInfo.address.country')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Country must not exceed 50 characters'),
    
    body('contactInfo.address.zipCode')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Zip code must not exceed 20 characters'),
    
    body('commissionRate')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Commission rate must be between 0 and 100'),
    
    body('paymentTerms')
      .optional()
      .isIn(['immediate', 'net_15', 'net_30', 'net_45', 'net_60'])
      .withMessage('Payment terms must be immediate, net_15, net_30, net_45, or net_60'),
    
    handleValidationResults
  ],
  
  getById: [
    commonValidations.objectId('id'),
    handleValidationResults
  ]
};

/**
 * Service Template validation rules
 */
const serviceTemplateValidations = {
  create: [
    commonValidations.requiredString('name', 1, 100),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    
    body('category')
      .isIn(['Package', 'Hotel', 'Air', 'Transfers', 'Assistance', 'Cruise', 'Car Rental', 'Tour', 'Other'])
      .withMessage('Category must be one of: Package, Hotel, Air, Transfers, Assistance, Cruise, Car Rental, Tour, Other'),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('id'),
    
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),
    
    body('category')
      .optional()
      .isIn(['Package', 'Hotel', 'Air', 'Transfers', 'Assistance', 'Cruise', 'Car Rental', 'Tour', 'Other'])
      .withMessage('Category must be one of: Package, Hotel, Air, Transfers, Assistance, Cruise, Car Rental, Tour, Other'),
    
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    
    handleValidationResults
  ],
  
  getById: [
    commonValidations.objectId('id'),
    handleValidationResults
  ]
};

/**
 * Service validation rules
 */
const serviceValidations = {
  create: [
    commonValidations.requiredString('destino', 1, 100),
    
    body('type')
      .custom(async (value) => {
        if (!value || value === '') return true;
        // Allow any non-empty string for dynamic service types
        // The actual validation will be done in the controller
        return typeof value === 'string' && value.trim().length > 0;
      })
      .withMessage('Service type must be a non-empty string'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description must not exceed 1000 characters'),
    
    body('providerId')
      .isMongoId()
      .withMessage('Please provide a valid provider ID'),
    
    body('costProvider')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Provider cost must be a positive number'),
    
    body('currency')
      .optional()
      .isIn(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'])
      .withMessage('Please provide a valid currency code'),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('id'),
    commonValidations.optionalString('destino', 1, 100),
    
    body('type')
      .optional()
      .custom(async (value) => {
        if (!value || value === '') return true;
        // Allow any non-empty string for dynamic service types
        // The actual validation will be done in the controller
        return typeof value === 'string' && value.trim().length > 0;
      })
      .withMessage('Service type must be a non-empty string'),
    
    body('costProvider')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Provider cost must be a positive number'),
    
    handleValidationResults
  ]
};

/**
 * Cupo validation rules
 */
const cupoValidations = {
  create: [
    body('serviceId')
      .isMongoId()
      .withMessage('Please provide a valid service ID'),
    
    body('totalSeats')
      .isInt({ min: 1 })
      .withMessage('Total seats must be a positive integer'),
    
    body('metadata.date')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date'),
    
    body('metadata.flightName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Flight name cannot exceed 100 characters'),
    
    body('metadata.destination')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Destination cannot exceed 200 characters'),
    
    body('metadata.value')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Value must be a non-negative number'),
    
    body('metadata.currency')
      .optional()
      .trim()
      .isLength({ min: 3, max: 3 })
      .withMessage('Currency must be a 3-character code'),
    
    handleValidationResults
  ],
  
  reserve: [
    commonValidations.objectId('id'),
    
    body('seats')
      .isInt({ min: 1 })
      .withMessage('Number of seats must be a positive integer'),
    
    handleValidationResults
  ]
};

/**
 * Notification validation rules
 */
const notificationValidations = {
  send: [
    body('clientId')
      .isMongoId()
      .withMessage('Please provide a valid client ID'),
    
    body('type')
      .isIn(['trip_reminder', 'return_notification', 'passport_expiry', 'custom'])
      .withMessage('Invalid notification type'),
    
    body('subject')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Subject is required and must not exceed 200 characters'),
    
    body('emailContent')
      .optional()
      .trim()
      .isLength({ max: 10000 })
      .withMessage('Email content must not exceed 10000 characters'),
    
    body('whatsappContent')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('WhatsApp content must not exceed 1000 characters'),
    
    handleValidationResults
  ],
  
  updatePreferences: [
    commonValidations.objectId('id'),
    
    body('notificationPreferences.email')
      .optional()
      .isBoolean()
      .withMessage('Email preference must be a boolean'),
    
    body('notificationPreferences.whatsapp')
      .optional()
      .isBoolean()
      .withMessage('WhatsApp preference must be a boolean'),
    
    body('notificationPreferences.tripReminders')
      .optional()
      .isBoolean()
      .withMessage('Trip reminders preference must be a boolean'),
    
    body('notificationPreferences.returnNotifications')
      .optional()
      .isBoolean()
      .withMessage('Return notifications preference must be a boolean'),
    
    body('notificationPreferences.passportExpiry')
      .optional()
      .isBoolean()
      .withMessage('Passport expiry preference must be a boolean'),
    
    handleValidationResults
  ]
};

/**
 * Report validation rules
 */
const reportValidations = {
  sales: [
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
      .withMessage('Period must be daily, weekly, monthly, quarterly, or yearly'),
    
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be in ISO format'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be in ISO format'),
    
    handleValidationResults
  ],
  
  profit: [
    query('sellerId')
      .optional()
      .isMongoId()
      .withMessage('Please provide a valid seller ID'),
    
    query('period')
      .optional()
      .isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
      .withMessage('Invalid period'),
    
    handleValidationResults
  ]
};

/**
 * Passenger validation rules
 */
const passengerValidations = {
  create: [
    commonValidations.requiredString('name', 1, 50),
    commonValidations.requiredString('surname', 1, 50),
    
    body('dni')
      .trim()
      .isLength({ min: 7, max: 20 })
      .withMessage('DNI/CUIT must be between 7 and 20 characters')
      .matches(/^[0-9]+$/)
      .withMessage('DNI/CUIT must contain only numbers'),
    
    commonValidations.email('email').optional(),
    commonValidations.phone('phone').optional(),
    
    body('dob')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error('Please provide a valid date of birth');
        }
        const dob = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        if (age < 0 || age > 120) {
          throw new Error('Please provide a valid date of birth');
        }
        return true;
      }),
    
    body('passportNumber')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length < 5 || trimmed.length > 20) {
          throw new Error('Passport number must be between 5 and 20 characters');
        }
        return true;
      }),
    
    body('nationality')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length < 2 || trimmed.length > 50) {
          throw new Error('Nationality must be between 2 and 50 characters');
        }
        return true;
      }),
    
    body('expirationDate')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error('Please provide a valid passport expiration date');
        }
        const expDate = new Date(value);
        const today = new Date();
        if (expDate <= today) {
          throw new Error('Passport expiration date must be in the future');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const validGenders = ['male', 'female', 'other'];
        if (!validGenders.includes(value)) {
          throw new Error('Gender must be male, female, or other');
        }
        return true;
      }),
    
    body('specialRequests')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length > 1000) {
          throw new Error('Special requests must not exceed 1000 characters');
        }
        return true;
      }),
    
    body('passportImage')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Passport image filename must be between 1 and 255 characters'),
    
    handleValidationResults
  ],
  
  update: [
    commonValidations.objectId('passengerId'),
    commonValidations.optionalString('name', 1, 50),
    commonValidations.optionalString('surname', 1, 50),
    
    body('dni')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length < 7 || trimmed.length > 20) {
          throw new Error('DNI/CUIT must be between 7 and 20 characters');
        }
        if (!/^[0-9]+$/.test(trimmed)) {
          throw new Error('DNI/CUIT must contain only numbers');
        }
        return true;
      }),
    
    commonValidations.email('email').optional(),
    commonValidations.phone('phone').optional(),
    
    body('dob')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error('Please provide a valid date of birth');
        }
        const dob = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        if (age < 0 || age > 120) {
          throw new Error('Please provide a valid date of birth');
        }
        return true;
      }),
    
    body('passportNumber')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length < 5 || trimmed.length > 20) {
          throw new Error('Passport number must be between 5 and 20 characters');
        }
        return true;
      }),
    
    body('nationality')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        const trimmed = value.trim();
        if (trimmed.length < 2 || trimmed.length > 50) {
          throw new Error('Nationality must be between 2 and 50 characters');
        }
        return true;
      }),
    
    body('expirationDate')
      .optional()
      .custom((value) => {
        if (!value || value.trim() === '') return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new Error('Please provide a valid passport expiration date');
        }
        const expDate = new Date(value);
        const today = new Date();
        if (expDate <= today) {
          throw new Error('Passport expiration date must be in the future');
        }
        return true;
      }),
    
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other'])
      .withMessage('Invalid gender'),
    
    body('specialRequests')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Special requests must not exceed 1000 characters'),
    
    body('passportImage')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Passport image filename must be between 1 and 255 characters'),
    
    handleValidationResults
  ],
  
  getById: [
    commonValidations.objectId('id'),
    handleValidationResults
  ]
};

/**
 * File upload validation
 */
const fileUploadValidations = {
  passport: [
    body('type')
      .isIn(['passport'])
      .withMessage('Invalid file type for passport upload'),
    
    handleValidationResults
  ],
  
  saleDocument: [
    body('type')
      .isIn(['ticket', 'invoice', 'receipt', 'contract', 'other'])
      .withMessage('Invalid document type'),
    
    handleValidationResults
  ],
  
  paymentReceipt: [
    body('type')
      .isIn(['receipt', 'invoice', 'proof'])
      .withMessage('Invalid receipt type'),
    
    handleValidationResults
  ]
};

module.exports = {
  // Common validations
  commonValidations,
  
  // Specific validation sets
  userValidations,
  clientValidations,
  passengerValidations,
  saleValidations,
  paymentValidations,
  providerValidations,
  serviceValidations,
  serviceTemplateValidations,
  cupoValidations,
  notificationValidations,
  reportValidations,
  fileUploadValidations,
  
  // Utility functions
  handleValidationResults
};