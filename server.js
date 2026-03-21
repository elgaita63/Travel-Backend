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

// Environment Config
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './env.local' });
} else {
  try {
    require('dotenv').config({ path: './.env.production' });
  } catch (error) {
    console.log('Using Railway environment variables');
  }
}

const config = process.env.NODE_ENV === 'production' 
  ? require('./config.production') 
  : require('./config.local');

Object.keys(config).forEach(key => {
  if (!process.env[key]) process.env[key] = config[key];
});

const getGitTagVersion = () => {
  try {
    return execSync('git describe --tags --abbrev=0').toString().trim();
  } catch (error) {
    return 'v0.0.0-NonVersioned'; 
  }
};

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
const allowedOrigins = [
  'https://travel-management-system1.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('netlify.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// --- ENDPOINT PARA STATUS BAR (SISTEMA) ---
app.get('/api/system/version', (req, res) => {
  res.json({ 
    success: true,
    version: getGitTagVersion(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      host: mongoose.connection.host || 'localhost',
      name: mongoose.connection.name || 'marenostrum_db'
    }
  });
});

app.use('/uploads', express.static('uploads'));
app.use('/api', require('./routes'));


// --- DIAGNÓSTICO DE CONEXIÓN ---
const mongoUrl = process.env.MONGODB_URL || config.MONGODB_URL;

if (mongoUrl) {
  const maskedUrl = mongoUrl.replace(/:([^:]+)@/, ':****@'); 
  console.log('-----------------------------------');
  console.log('🔍 URL detectada:', maskedUrl);
  console.log('🔍 Longitud de la URL:', mongoUrl.length);
  console.log('🔍 ¿Tiene el punto en el pass?:', mongoUrl.includes(':.'));
  console.log('🔍 Base de datos destino:', mongoUrl.split('/').pop().split('?')[0]);
  console.log('-----------------------------------');
} else {
  console.log('❌ ERROR: No se detectó ninguna URL en MONGODB_URL ni en config');
}





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