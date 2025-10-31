const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cronJobs = require('./services/cronJobs');
const sessionCleanupService = require('./services/sessionCleanupService');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { ensureAllUploadDirectories } = require('./scripts/ensureUploadDirs');

// Import models to ensure they're registered with Mongoose
require('./models/CurrencyUnit');
require('./models/PaymentMethod');
// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './env.local' });
} else {
  // In production, load from environment variables or .env.production if it exists
  try {
    require('dotenv').config({ path: './.env.production' });
  } catch (error) {
    // .env.production doesn't exist, use environment variables from Railway
    console.log('Using environment variables from Railway');
  }
  
  // Ensure production environment variables are set
  if (!process.env.MONGODB_URL) {
    console.error('❌ MONGODB_URL environment variable is not set in production');
  }
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET environment variable is not set in production');
  }
}

// Load configuration based on environment
// Default to local development unless explicitly set to production
const config = process.env.NODE_ENV === 'production' 
  ? require('./config.production') 
  : require('./config.local');

// Apply configuration to environment variables
Object.keys(config).forEach(key => {
  if (!process.env[key]) {
    process.env[key] = config[key];
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Access-Control-Allow-Origin', 'https://travel-management-system1.netlify.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// CORS configuration - Production-ready with comprehensive origin handling
const allowedOrigins = [
  'https://travel-management-system1.netlify.app',
  'https://travel-management-system1.netlify.app/', // With trailing slash
  'https://travel-backend-production-5253.up.railway.app', // Railway backend
  'http://localhost:3000', // For local development
  'http://localhost:5173',  // For Vite dev server
  'http://localhost:5000',  // For local backend testing
  'http://localhost:5001'   // For local backend testing (alternative port)
];

// Log CORS configuration
console.log('🔒 CORS Configuration:', {
  allowedOrigins,
  environment: process.env.NODE_ENV || 'development'
});

// Add additional origins from environment variable if provided
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
  console.log('➕ Added FRONTEND_URL to allowed origins:', process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches trusted domain patterns
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      return allowedOrigin === origin || 
             allowedOrigin === origin + '/' || 
             origin === allowedOrigin + '/' ||
             origin === allowedOrigin;
    });
    
    // Additional pattern matching for trusted domains
    const isTrustedDomain = 
      origin.includes('netlify.app') ||  // Allow all Netlify deployments
      origin.includes('railway.app') ||  // Allow all Railway deployments
      origin.includes('vercel.app') ||   // Allow all Vercel deployments
      origin.includes('herokuapp.com') || // Allow all Heroku deployments
      origin.startsWith('http://localhost:') ||  // Allow localhost with any port
      origin.startsWith('http://127.0.0.1:') ||  // Allow 127.0.0.1 with any port
      origin.startsWith('https://localhost:') || // Allow HTTPS localhost
      origin.startsWith('https://127.0.0.1:') ||   // Allow HTTPS 127.0.0.1
      origin === 'https://travel-management-system1.netlify.app'; // Explicitly allow production frontend
    
    if (isAllowed || isTrustedDomain) {
      console.log('✅ CORS allowed origin:', origin);
      callback(null, true);
    } else {
      console.log('⚠️  CORS blocked origin:', origin);
      console.log('ℹ️  Allowed origins:', allowedOrigins);
      console.log('ℹ️  Trusted domain check:', isTrustedDomain);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin', 
    'Cache-Control', 
    'Pragma',
    'X-CSRF-Token',
    'X-API-Key',
    'X-User-Agent',
    'X-Forwarded-For',
    'X-Real-IP',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Total-Count'],
  maxAge: 86400 // Cache preflight requests for 24 hours
};
app.use(cors(corsOptions));

// Handle CORS preflight requests explicitly
app.options('*', cors(corsOptions));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Serve static files from public directory
app.use('/airline', express.static('public/airline'));
app.use('/hotel', express.static('public/hotel'));
app.use('/excursion', express.static('public/excursion'));
app.use('/transfer', express.static('public/transfer'));
app.use('/insurance', express.static('public/insurance'));

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_URL || config.MONGODB_URL;

console.log('Attempting to connect to MongoDB...');
console.log('Connection URL:', mongoUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Frontend URL:', process.env.FRONTEND_URL || 'Not set');

mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000, // Increased timeout
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000, // Added connection timeout
  retryWrites: true,
  w: 'majority'
})
  .then(() => {
    console.log('✅ Connected to MongoDB successfully');
    
    // Start cron jobs after successful database connection
    cronJobs.start();
    
    // Start session cleanup service
    sessionCleanupService.start();
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('Error details:', {
      name: error.name,
      code: error.code,
      reason: error.reason?.type || 'Unknown'
    });
    
    // Don't exit immediately, let the server start and show health check
    console.log('⚠️  Server will start but database operations will fail');
    console.log('💡 Check your MongoDB connection settings or network connectivity');
  });

// Routes
app.use('/api', require('./routes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStates[dbState] || 'unknown',
      readyState: dbState,
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown',
      name: mongoose.connection.name || 'unknown'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Travel AI Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'running',
    frontend_url: process.env.FRONTEND_URL || 'Not set',
    cors_origins: allowedOrigins
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Initialize upload directories before starting server
ensureAllUploadDirectories();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: ${process.env.API_BASE_URL || 'Not set'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
  console.log(`🗄️  MongoDB URL: ${process.env.MONGODB_URL ? 'Set' : 'Not set'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Set' : 'Not set'}`);
  console.log(`📊 CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🔒 CORS Configuration: ${JSON.stringify(corsOptions, null, 2)}`);
});