const mongoose = require('mongoose');
require('dotenv').config({ path: './env.local' });

// Load local configuration if in development
const localConfig = require('../config.local');
if (process.env.NODE_ENV === 'development' || !process.env.MONGODB_URL) {
  Object.keys(localConfig).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = localConfig[key];
    }
  });
}

// Import models to check collections
const User = require('../models/User');
const Client = require('../models/Client');
const Provider = require('../models/Provider');
const Service = require('../models/Service');
const Passenger = require('../models/Passenger');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const Cupo = require('../models/Cupo');
const Notification = require('../models/Notification');

async function checkDatabaseStatus() {
  try {
    console.log('\n=== DATABASE STATUS CHECK ===\n');
    
    // Connect to database
    const dbUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
    console.log('Connecting to:', dbUrl.replace(/\/\/.*@/, '//***:***@'));
    
    await mongoose.connect(dbUrl);
    console.log('✓ Successfully connected to MongoDB\n');
    
    // Database info
    const dbName = mongoose.connection.name;
    const dbHost = mongoose.connection.host;
    const dbPort = mongoose.connection.port;
    
    console.log('Database Information:');
    console.log(`  Name: ${dbName}`);
    console.log(`  Host: ${dbHost}`);
    console.log(`  Port: ${dbPort}`);
    console.log(`  State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}\n`);
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('=== COLLECTIONS STATUS ===\n');
    
    // Check each collection
    const collectionsToCheck = [
      { name: 'users', model: User },
      { name: 'clients', model: Client },
      { name: 'providers', model: Provider },
      { name: 'services', model: Service },
      { name: 'passengers', model: Passenger },
      { name: 'sales', model: Sale },
      { name: 'payments', model: Payment },
      { name: 'cupos', model: Cupo },
      { name: 'notifications', model: Notification }
    ];
    
    let totalDocuments = 0;
    
    for (const collection of collectionsToCheck) {
      if (collectionNames.includes(collection.name)) {
        const count = await collection.model.countDocuments();
        totalDocuments += count;
        console.log(`✓ ${collection.name.padEnd(15)} ${count.toString().padStart(5)} documents`);
      } else {
        console.log(`✗ ${collection.name.padEnd(15)}       (not created yet)`);
      }
    }
    
    console.log(`\nTotal documents: ${totalDocuments}`);
    
    if (totalDocuments === 0) {
      console.log('\n⚠️  Database is empty. Run "npm run seed" to add sample data.');
    } else {
      console.log('\n✓ Database contains data');
    }
    
    // Database statistics
    console.log('\n=== DATABASE STATISTICS ===\n');
    const stats = await mongoose.connection.db.stats();
    console.log(`  Collections: ${stats.collections}`);
    console.log(`  Indexes: ${stats.indexes}`);
    console.log(`  Data Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Storage Size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n=== STATUS CHECK COMPLETE ===\n');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    console.error('\nPossible causes:');
    console.error('  • MongoDB is not running');
    console.error('  • Connection string is incorrect');
    console.error('  • Network connectivity issues');
    console.error('\nTo start MongoDB:');
    console.error('  • Windows: net start MongoDB');
    console.error('  • Or run: start-mongodb.bat from project root');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the check
checkDatabaseStatus();

