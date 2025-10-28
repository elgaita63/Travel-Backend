const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider ID is required']
  },
  // Provider-specific pricing for this service
  costProvider: {
    type: Number,
    required: [true, 'Provider cost is required'],
    min: [0, 'Provider cost cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    trim: true,
    uppercase: true,
    maxlength: [3, 'Currency code cannot exceed 3 characters'],
    default: 'USD'
  },
  // Provider-specific terms and conditions
  commissionRate: {
    type: Number,
    min: [0, 'Commission rate cannot be negative'],
    max: [100, 'Commission rate cannot exceed 100%'],
    default: 0
  },
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_45', 'net_60'],
    default: 'net_30'
  },
  // Availability and capacity for this provider-service combination
  isAvailable: {
    type: Boolean,
    default: true
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
  // Provider-specific notes for this service
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Contract or agreement details
  contractDetails: {
    contractNumber: {
      type: String,
      trim: true,
      maxlength: [100, 'Contract number cannot exceed 100 characters']
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    terms: {
      type: String,
      trim: true,
      maxlength: [1000, 'Contract terms cannot exceed 1000 characters']
    }
  },
  // Status of this provider-service relationship
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'terminated'],
    default: 'active'
  },
  // Metadata for additional flexibility
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

// Compound index to ensure unique service-provider combinations
serviceProviderSchema.index({ serviceId: 1, providerId: 1 }, { unique: true });

// Indexes for better query performance
serviceProviderSchema.index({ serviceId: 1 });
serviceProviderSchema.index({ providerId: 1 });
serviceProviderSchema.index({ status: 1 });
serviceProviderSchema.index({ isAvailable: 1 });
serviceProviderSchema.index({ createdBy: 1 });

// Virtual for profit margin
serviceProviderSchema.virtual('profitMargin').get(function() {
  // This would need the client price from the sale context
  // For now, return 0 as it's calculated at sale level
  return 0;
});

// Static method to get all providers for a service
serviceProviderSchema.statics.getProvidersForService = function(serviceId) {
  return this.find({ 
    serviceId: serviceId, 
    status: 'active', 
    isAvailable: true 
  }).populate('providerId');
};

// Static method to get all services for a provider
serviceProviderSchema.statics.getServicesForProvider = function(providerId) {
  return this.find({ 
    providerId: providerId, 
    status: 'active', 
    isAvailable: true 
  }).populate('serviceId');
};

// Static method to get service-provider combinations for a sale
serviceProviderSchema.statics.getServiceProviderCombinations = function(serviceIds) {
  return this.find({ 
    serviceId: { $in: serviceIds }, 
    status: 'active', 
    isAvailable: true 
  }).populate('serviceId').populate('providerId');
};

// Instance method to check if combination is available
serviceProviderSchema.methods.isAvailableForDate = function(date) {
  if (!this.isAvailable) return false;
  
  if (this.contractDetails.startDate && date < this.contractDetails.startDate) {
    return false;
  }
  
  if (this.contractDetails.endDate && date > this.contractDetails.endDate) {
    return false;
  }
  
  return true;
};

// Transform output
serviceProviderSchema.methods.toJSON = function() {
  const serviceProviderObject = this.toObject();
  serviceProviderObject.id = serviceProviderObject._id; // Include id field for frontend compatibility
  return serviceProviderObject;
};

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);