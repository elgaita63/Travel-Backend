const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  destino: {
    type: String,
    required: [true, 'Service destino (destination) is required'],
    trim: true,
    maxlength: [100, 'Service destino cannot exceed 100 characters']
  },
  typeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceType',
    required: [true, 'Service type ID is required']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [1000, 'Service description cannot exceed 1000 characters']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider ID is required']
  },
  exchangeRate: {
    type: Number,
    min: [0, 'Exchange rate cannot be negative']
  },
  baseCurrency: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [3, 'Base currency code cannot exceed 3 characters']
  },
  markup: {
    type: Number,
    min: [0, 'Markup cannot be negative'],
    max: [1000, 'Markup cannot exceed 1000%'],
    default: 0
  },
  cost: {
    type: Number,
    min: [0, 'Cost cannot be negative']
  },
  currency: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [3, 'Currency code cannot exceed 3 characters'],
    default: 'USD'
  },
  // Currency conversion tracking
  originalCurrency: {
    type: String,
    required: false,
    trim: true,
    uppercase: true,
    maxlength: [3, 'Original currency code cannot exceed 3 characters']
  },
  originalAmount: {
    type: Number,
    required: false,
    min: [0, 'Original amount cannot be negative']
  },
  sellingPrice: {
    type: Number,
    min: [0, 'Selling price cannot be negative']
  },
  duration: {
    type: Number, // in hours or days depending on service type
    min: [0, 'Duration cannot be negative']
  },
  durationUnit: {
    type: String,
    enum: ['minutes', 'hours', 'days', 'weeks'],
    default: 'hours'
  },
  capacity: {
    min: {
      type: Number,
      min: [1, 'Minimum capacity must be at least 1'],
      default: 1
    },
    max: {
      type: Number,
      min: [1, 'Maximum capacity must be at least 1'],
      default: 1
    }
  },
  location: {
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters']
    },
    country: {
      type: String,
      trim: true,
      maxlength: [50, 'Country cannot exceed 50 characters']
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    }
  },
  availability: {
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null
    },
    daysOfWeek: [{
      type: Number,
      min: [0, 'Day of week must be between 0 and 6'],
      max: [6, 'Day of week must be between 0 and 6']
    }],
    timeSlots: [{
      start: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      },
      end: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
      }
    }]
  },
  requirements: {
    minAge: {
      type: Number,
      min: [0, 'Minimum age cannot be negative'],
      default: 0
    },
    maxAge: {
      type: Number,
      min: [0, 'Maximum age cannot be negative'],
      default: null
    },
    documents: [{
      type: String,
      trim: true,
      maxlength: [50, 'Document requirement cannot exceed 50 characters']
    }],
    restrictions: [{
      type: String,
      trim: true,
      maxlength: [100, 'Restriction cannot exceed 100 characters']
    }]
  },
  inclusions: [{
    type: String,
    trim: true,
    maxlength: [100, 'Inclusion cannot exceed 100 characters']
  }],
  exclusions: [{
    type: String,
    trim: true,
    maxlength: [100, 'Exclusion cannot exceed 100 characters']
  }],
  cancellationPolicy: {
    freeCancellation: {
      type: Boolean,
      default: false
    },
    freeCancellationHours: {
      type: Number,
      min: [0, 'Free cancellation hours cannot be negative'],
      default: 24
    },
    cancellationFee: {
      type: Number,
      min: [0, 'Cancellation fee cannot be negative'],
      default: 0
    },
    refundPercentage: {
      type: Number,
      min: [0, 'Refund percentage cannot be negative'],
      max: [100, 'Refund percentage cannot exceed 100%'],
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'discontinued'],
    default: 'active'
  },
  totalBookings: {
    type: Number,
    default: 0,
    min: [0, 'Total bookings cannot be negative']
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  },
  rating: {
    average: {
      type: Number,
      min: [0, 'Average rating cannot be negative'],
      max: [5, 'Average rating cannot exceed 5'],
      default: 0
    },
    count: {
      type: Number,
      default: 0,
      min: [0, 'Rating count cannot be negative']
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
serviceSchema.index({ destino: 1 });
serviceSchema.index({ typeId: 1 });
serviceSchema.index({ providerId: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ createdBy: 1 });
serviceSchema.index({ 'location.city': 1 });
serviceSchema.index({ 'location.country': 1 });
serviceSchema.index({ 'rating.average': -1 });
serviceSchema.index({ totalBookings: -1 });

// Pre-save middleware to calculate selling price
serviceSchema.pre('save', function(next) {
  if (this.isModified('markup')) {
    // Selling price calculation will be handled at the sale level
    // since cost is no longer stored at service level
  }
  next();
});

// Note: Cost and pricing are now handled at the sale level, not service level

// Virtual for formatted duration
serviceSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return null;
  return `${this.duration} ${this.durationUnit}`;
});

// Virtual for formatted location
serviceSchema.virtual('formattedLocation').get(function() {
  if (!this.location) return 'Location not specified';
  
  const parts = [];
  if (this.location.city && this.location.city !== 'Unknown') parts.push(this.location.city);
  if (this.location.country && this.location.country !== 'Unknown') parts.push(this.location.country);
  
  if (parts.length === 0) return 'Location not specified';
  return parts.join(', ');
});

// Virtual for availability status
serviceSchema.virtual('isAvailable').get(function() {
  if (this.status !== 'active') return false;
  
  const now = new Date();
  if (this.availability.startDate && now < this.availability.startDate) return false;
  if (this.availability.endDate && now > this.availability.endDate) return false;
  
  return true;
});

// Instance method to update booking statistics
serviceSchema.methods.updateBookingStats = function(revenue) {
  this.totalBookings += 1;
  this.totalRevenue += revenue;
  return this.save();
};

// Instance method to update rating
serviceSchema.methods.updateRating = function(newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

// Instance method to check availability for a specific date
serviceSchema.methods.isAvailableOnDate = function(date) {
  if (!this.isAvailable) return false;
  
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();
  
  // Check if service is available on this day of week
  if (this.availability.daysOfWeek.length > 0 && 
      !this.availability.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }
  
  return true;
};

// Instance method to check capacity availability
serviceSchema.methods.hasCapacity = function(requiredCapacity) {
  return requiredCapacity >= this.capacity.min && requiredCapacity <= this.capacity.max;
};

// Static method to find services by type
serviceSchema.statics.findByType = function(typeId) {
  return this.find({ typeId, status: 'active' });
};

// Static method to find services by location
serviceSchema.statics.findByLocation = function(city, country) {
  const query = { status: 'active' };
  if (city) query['location.city'] = new RegExp(city, 'i');
  if (country) query['location.country'] = new RegExp(country, 'i');
  
  return this.find(query);
};

// Static method to find top-rated services
serviceSchema.statics.findTopRated = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'rating.average': -1, totalBookings: -1 })
    .limit(limit);
};

// Note: Price-based filtering is now handled at the sale level

// Static method to get service statistics
serviceSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalServices: { $sum: 1 },
        activeServices: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        inactiveServices: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
        totalBookings: { $sum: '$totalBookings' },
        totalRevenue: { $sum: '$totalRevenue' },
        averageRating: { $avg: '$rating.average' },
        averageMarkup: { $avg: '$markup' }
      }
    }
  ]);
};

// Static method to get statistics by service type
serviceSchema.statics.getStatisticsByType = function() {
  return this.aggregate([
    {
      $lookup: {
        from: 'servicetypes',
        localField: 'typeId',
        foreignField: '_id',
        as: 'serviceType'
      }
    },
    {
      $unwind: '$serviceType'
    },
    {
      $group: {
        _id: '$serviceType.name',
        count: { $sum: 1 },
        activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        totalBookings: { $sum: '$totalBookings' },
        totalRevenue: { $sum: '$totalRevenue' },
        averageRating: { $avg: '$rating.average' },
        averageMarkup: { $avg: '$markup' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Transform output
serviceSchema.methods.toJSON = function() {
  const serviceObject = this.toObject();
  serviceObject.id = serviceObject._id; // Include id field for frontend compatibility
  serviceObject.formattedDuration = this.formattedDuration;
  serviceObject.formattedLocation = this.formattedLocation;
  serviceObject.isAvailable = this.isAvailable;
  return serviceObject;
};

module.exports = mongoose.model('Service', serviceSchema);