const { execSync } = require('child_process');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cronJobs = require('./services/cronJobs');
const sessionCleanupService = require('./services/sessionCleanupService');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { ensureAllUploadDirectories } = require('./scripts/ensureUploadDirs');

// Import models
require('./models/CurrencyUnit');
require('./models/PaymentMethod');

// ============================
// VERSION DE BACK - ACTUALIZAR
// ============================
  const BackendVersion = '3.0.0NVT'; //NonVolatileTranslation

// Environment Config
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config({ path: './env.local' });
} else {
  try {
    require('dotenv').config({ path: './.env.production' });
  } catch (error) {
    console.log('Using Railway environment variables');
  }
}

const config = process.env.NODE_ENV != 'development' 
  ? require('./config.production') 
  : require('./config.local');

Object.keys(config).forEach(key => {
  if (!process.env[key]) process.env[key] = config[key];
});


const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
const allowedOrigins = [
   process.env.FRONTEND_URL, 
  'http://localhost:5173',
];


app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.options('*', cors());

// --- ENDPOINT PARA STATUS BAR (SISTEMA) CORREGIDO ---
app.get('/api/system/version', (req, res) => {
  const env = process.env.NODE_ENV;
  let dbName = 'NO_DATABASE';
  
  if (mongoose.connection && mongoose.connection.db) {
    dbName = mongoose.connection.db.databaseName;
  }

  res.json({ 
    success: true,
    version: BackendVersion,
    environment: env ? env.toUpperCase() : 'UNKNOWN', 
    database: {
      host: mongoose.connection.host || 'UNKNOWN_HOST', 
      name: dbName
    }
  });
});

app.use('/uploads', express.static('uploads'));
app.use('/api', require('./routes'));

const mongoUrl = process.env.MONGODB_URL || config.MONGODB_URL;

// ====================
// AUDITORÍA DE BACKEND
// ====================
console.log("🚀 --- LOG DE ENTORNO --- 🚀");


const variablesBack = {
    "NODE_ENV": process.env.NODE_ENV || "No definido",
    "PORT_RAILWAY": process.env.PORT || "5000",
    "MONGO_DB": mongoUrl || "❌ VACÍA",
    "JWT_STATUS": process.env.JWT_SECRET ? "✅ DEFINIDA" : "❌ VACÍA",
    "FRONT_URL": process.env.FRONTEND_URL || "❌ NO CONFIGURADA",
    "OPENAI_KEY": process.env.OPENAI_API_KEY ? 
        `Presente (Inicia: ${process.env.OPENAI_API_KEY.substring(0, 7)}...)` : "❌ NO DETECTADA"
};

console.table(variablesBack);
console.log("🚀 --- FIN DE LOGS ENTORNO --- 🚀");
// ==========================================




mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ MongoDB Connected');
    cronJobs.start();
    sessionCleanupService.start();
  })
  .catch(err => console.error('❌ MongoDB Error:', err));

app.use(notFound);
app.use(errorHandler);
ensureAllUploadDirectories();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});