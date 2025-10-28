const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Destination name is required'],
    trim: true,
    maxlength: [100, 'Destination name cannot exceed 100 characters']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
    maxlength: [50, 'Country cannot exceed 50 characters']
  },
  city: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'City cannot exceed 50 characters']
  },
  region: {
    type: String,
    required: false,
    trim: true,
    maxlength: [50, 'Region cannot exceed 50 characters']
  },
  coordinates: {
    latitude: {
      type: Number,
      required: false,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      required: false,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  popularServices: [{
    type: String,
    enum: ['Hotel', 'Airfare', 'Cruise', 'Transfers', 'Excursions', 'Insurance', 'Fees', 'Restaurant', 'Entertainment', 'Shopping'],
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient searching
destinationSchema.index({ name: 1, country: 1 });
destinationSchema.index({ isActive: 1 });

// Update the updatedAt field on save
destinationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Destination', destinationSchema);