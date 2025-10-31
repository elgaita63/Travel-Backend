const mongoose = require('mongoose');
require('dotenv').config();

// Load local configuration if in development
const localConfig = require('../config.local');
if (process.env.NODE_ENV === 'development' || !process.env.MONGODB_URL) {
  Object.keys(localConfig).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = localConfig[key];
    }
  });
}

// Import PaymentMethod model
const PaymentMethod = require('../models/PaymentMethod');

// Connect to database
const connectDB = async () => {
  try {
    const dbUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;
    await mongoose.connect(dbUrl);
    console.log('Connected to MongoDB successfully!');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Seed payment methods
const seedPaymentMethods = async () => {
  try {
    console.log('Seeding payment methods...');

    const paymentMethods = [
      { name: 'Cash', type: 'payment_method' },
      { name: 'Bank Transfer', type: 'payment_method' },
      { name: 'Credit Card', type: 'payment_method' },
      { name: 'Transfer to Mare Nostrum', type: 'payment_method' },
      { name: 'Transfer to Operator', type: 'payment_method' },
      { name: 'Deposit to Hivago', type: 'payment_method' },
      { name: 'Deposit to Operator', type: 'payment_method' },
      { name: 'Cheque', type: 'payment_method' },
      { name: 'Cryptocurrency', type: 'payment_method' }
    ];

    for (const methodData of paymentMethods) {
      // Check if payment method already exists
      const existingMethod = await PaymentMethod.findOne({ 
        name: { $regex: new RegExp(`^${methodData.name}$`, 'i') } 
      });

      if (!existingMethod) {
        const paymentMethod = new PaymentMethod(methodData);
        await paymentMethod.save();
        console.log(`✓ Created payment method: ${methodData.name}`);
      } else {
        console.log(`- Payment method already exists: ${methodData.name}`);
      }
    }

    console.log('Payment methods seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding payment methods:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeding
const runSeed = async () => {
  await connectDB();
  await seedPaymentMethods();
};

runSeed();