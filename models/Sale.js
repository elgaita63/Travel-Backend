const mongoose = require('mongoose');

const passengerSaleSchema = new mongoose.Schema({
  passengerId: {
    type: mongoose.Schema.Types.Mixed, // Changed to Mixed to support both ObjectId and embedded objects
    required: [true, 'Passenger ID is required']
  },
  price: {
    type: Number,
    required: [true, 'Passenger price is required'],
    min: [0, 'Passenger price cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isMainClient: {
    type: Boolean,
    default: false
  }
});

const serviceSaleSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false // Made optional to support service templates
  },
  serviceTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceTemplate',
    required: false // Optional for backward compatibility
  },
  // Keep single provider fields for backward compatibility
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: false // Made optional to support multiple providers
  },
  serviceProviderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: false // Optional for backward compatibility
  },
  // New multiple providers support
  providers: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: [true, 'Provider ID is required']
    },
    serviceProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider',
      required: false // Optional - may not exist for direct provider selection
    },
    costProvider: {
      type: Number,
      required: false,
      min: [0, 'Provider cost cannot be negative'],
      default: 0
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
      default: 'USD'
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
      default: 0
    },
    startDate: {
      type: Date,
      required: false
    },
    endDate: {
      type: Date,
      required: false
    },
    documents: [{
      filename: {
        type: String,
        required: false,
        trim: true
      },
      url: {
        type: String,
        required: false,
        trim: true
      },
      type: {
        type: String,
        required: false,
        enum: {
          values: ['ticket', 'invoice', 'contract', 'receipt', 'other'],
          message: 'Document type must be one of: ticket, invoice, contract, receipt, other'
        }
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  serviceName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [200, 'Service name cannot exceed 200 characters']
  },
  serviceTypeName: {
    type: String,
    required: false,
    trim: true,
    maxlength: [100, 'Service type name cannot exceed 100 characters']
  },
  priceClient: {
    type: Number,
    required: [true, 'Client price is required'],
    min: [0, 'Client price cannot be negative']
  },
  costProvider: {
    type: Number,
    required: false,
    min: [0, 'Provider cost cannot be negative'],
    default: 0
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
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
    required: false
  },
  exchangeRate: {
    type: Number,
    required: false,
    min: [0, 'Exchange rate cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  serviceDates: {
    startDate: {
      type: Date,
      required: [true, 'Service start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Service end date is required']
    }
  },
  documents: [{
    filename: {
      type: String,
      required: [true, 'Document filename is required'],
      trim: true
    },
    url: {
      type: String,
      required: false, // URL will be set after file upload processing
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: ['invoice', 'voucher', 'contract', 'ticket', 'other'],
        message: 'Document type must be one of: invoice, voucher, contract, ticket, other'
      }
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Service notes cannot exceed 500 characters']
  }
});

const documentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  url: {
    type: String,
    required: [true, 'Document URL is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Document type is required'],
    enum: {
      values: ['ticket', 'invoice', 'contract', 'receipt', 'other'],
      message: 'Document type must be one of: ticket, invoice, contract, receipt, other'
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const saleSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  passengers: [passengerSaleSchema],
  services: [serviceSaleSchema],
  totalSalePrice: {
    type: Number,
    default: 0,
    min: [0, 'Total sale price cannot be negative']
  },
  totalCost: {
    type: Number,
    default: 0,
    min: [0, 'Total cost cannot be negative']
  },
  profit: {
    type: Number,
    default: 0
  },
  paymentsClient: [{
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment ID is required']
    }
  }],
  paymentsProvider: [{
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: [true, 'Payment ID is required']
    }
  }],
  totalClientPayments: {
    type: Number,
    default: 0
  },
  totalProviderPayments: {
    type: Number,
    default: 0
  },
  clientBalance: {
    type: Number,
    default: 0
  },
  providerBalance: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    required: [true, 'Sale status is required'],
    enum: {
      values: ['open', 'closed', 'cancelled'],
      message: 'Status must be one of: open, closed, cancelled'
    },
    default: 'open'
  },
  paymentMethod: {
    type: String,
    trim: true,
    maxlength: [50, 'Payment method cannot exceed 50 characters'],
    default: 'pending'
  },
  // Reference to the quota (cupo) this sale was made from
  cupoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cupo',
    required: false // Optional - only sales made from quotas will have this
  },
  saleCurrency: {
    type: String,
    required: [true, 'Sale currency is required'],
    trim: true,
    uppercase: true,
    maxlength: [3, 'Currency code cannot exceed 3 characters'],
    enum: {
      values: ['USD', 'ARS'],
      message: 'Sale currency must be either USD or ARS'
    },
    default: 'USD'
  },
  // New fields for the updated flow
  destination: {
    name: {
      type: String,
      required: [true, 'Destination name is required'],
      trim: true,
      maxlength: [100, 'Destination name cannot exceed 100 characters']
    },
    country: {
      type: String,
      required: false, // Made optional since we removed country field from frontend
      trim: true,
      maxlength: [50, 'Country cannot exceed 50 characters']
    },
    city: {
      type: String,
      required: [true, 'City is required'], // Made required since we use city as primary destination
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters']
    }
  },
  pricingModel: {
    type: String,
    required: [true, 'Pricing model is required'],
    enum: {
      values: ['unit', 'total'],
      message: 'Pricing model must be either "unit" or "total"'
    },
    default: 'unit'
  },
  // Exchange rate information for the sale
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
  originalSalePrice: {
    type: Number,
    min: [0, 'Original sale price cannot be negative']
  },
  originalCost: {
    type: Number,
    min: [0, 'Original cost cannot be negative']
  },
  originalProfit: {
    type: Number
  },
  originalCurrency: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [3, 'Original currency code cannot exceed 3 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  },
  documents: [documentSchema],
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
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

// Indexes for better query performance
saleSchema.index({ clientId: 1 });
saleSchema.index({ createdBy: 1 });
saleSchema.index({ status: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ totalSalePrice: 1 });
saleSchema.index({ profit: 1 });

// Virtual for profit margin percentage
saleSchema.virtual('profitMargin').get(function() {
  if (this.totalSalePrice === 0) return 0;
  return ((this.profit / this.totalSalePrice) * 100).toFixed(2);
});

// Virtual for formatted totals
saleSchema.virtual('formattedTotalSalePrice').get(function() {
  return `${this.saleCurrency} ${this.totalSalePrice.toLocaleString()}`;
});

saleSchema.virtual('formattedTotalCost').get(function() {
  return `${this.saleCurrency} ${this.totalCost.toLocaleString()}`;
});

saleSchema.virtual('formattedProfit').get(function() {
  return `${this.saleCurrency} ${this.profit.toLocaleString()}`;
});

// Virtual for formatted balances
saleSchema.virtual('formattedClientBalance').get(function() {
  return `${this.saleCurrency} ${this.clientBalance.toLocaleString()}`;
});

saleSchema.virtual('formattedProviderBalance').get(function() {
  return `${this.saleCurrency} ${this.providerBalance.toLocaleString()}`;
});

saleSchema.virtual('formattedTotalClientPayments').get(function() {
  return `${this.saleCurrency} ${this.totalClientPayments.toLocaleString()}`;
});

saleSchema.virtual('formattedTotalProviderPayments').get(function() {
  return `${this.saleCurrency} ${this.totalProviderPayments.toLocaleString()}`;
});

// Pre-save middleware to calculate totals and profit
saleSchema.pre('save', function(next) {
  // Only recalculate totals if they are missing or if this is a new document
  const shouldRecalculate = this.isNew || 
    this.totalSalePrice === undefined || 
    this.totalSalePrice === null || 
    this.totalCost === undefined || 
    this.totalCost === null ||
    this.profit === undefined || 
    this.profit === null;

  if (shouldRecalculate) {
    // If we have original currency values and the sale currency is not USD, use those instead
    if (this.originalSalePrice && this.originalCost && this.originalProfit && this.saleCurrency !== 'USD') {
      // Use original currency values (these are in the sale currency)
      this.totalSalePrice = this.originalSalePrice;
      this.totalCost = this.originalCost;
      this.profit = this.originalProfit;
      
      // Calculate balances using original currency values
      this.clientBalance = this.originalSalePrice - (this.totalClientPayments || 0);
      this.providerBalance = (this.totalProviderPayments || 0) - this.originalCost;
    } else {
      // Fallback to original calculation for USD sales or when original values are not available
      // Calculate total sale price by summing individual passenger prices
      let totalSalePrice = 0;
      
      if (this.passengers && this.passengers.length > 0) {
        // Sum up all individual passenger prices
        this.passengers.forEach(passenger => {
          totalSalePrice += (passenger.price || 0);
        });
      }
      
      // Calculate total cost from entered service costs
      let totalCost = 0;
      if (this.services && this.services.length > 0) {
        // Sum up the costProvider field from each service
        this.services.forEach(service => {
          totalCost += (service.costProvider || 0);
        });
      }
      
      // Calculate profit
      const profit = totalSalePrice - totalCost;
      
      // Calculate balances
      this.clientBalance = totalSalePrice - (this.totalClientPayments || 0);
      this.providerBalance = (this.totalProviderPayments || 0) - totalCost;
      
      // Update totals
      this.totalSalePrice = totalSalePrice;
      this.totalCost = totalCost;
      this.profit = profit;
    }
  } else {
    // Preserve existing totals but update balances if needed
    this.clientBalance = this.totalSalePrice - (this.totalClientPayments || 0);
    this.providerBalance = (this.totalProviderPayments || 0) - this.totalCost;
  }
  
  this.updatedAt = new Date();
  
  next();
});

// Instance method to add a payment
saleSchema.methods.addPayment = function(paymentId, type) {
  if (type === 'client') {
    this.paymentsClient.push({ paymentId });
  } else if (type === 'provider') {
    this.paymentsProvider.push({ paymentId });
  }
  return this.save();
};

// Instance method to calculate totals
saleSchema.methods.calculateTotals = function() {
  let totalSalePrice = 0;
  let totalCost = 0;
  
  // Calculate total sale price by summing individual passenger prices
  if (this.passengers && this.passengers.length > 0) {
    // Sum up all individual passenger prices (each passenger already has the correct per-passenger price)
    this.passengers.forEach(passenger => {
      totalSalePrice += (passenger.price || 0);
    });
  }
  
  // Calculate total cost from entered service costs
  if (this.services && this.services.length > 0) {
    // Sum up the costProvider field from each service
    this.services.forEach(service => {
      totalCost += (service.costProvider || 0);
    });
  }
  
  const profit = totalSalePrice - totalCost;
  const clientBalance = totalSalePrice - (this.totalClientPayments || 0);
  const providerBalance = (this.totalProviderPayments || 0) - totalCost;
  
  return {
    totalSalePrice,
    totalCost,
    profit,
    clientBalance,
    providerBalance
  };
};

// Instance method to check if sale is fully paid
saleSchema.methods.isFullyPaid = function() {
  return this.clientBalance <= 0;
};

// Instance method to check if providers are fully paid
saleSchema.methods.areProvidersFullyPaid = function() {
  return this.providerBalance <= 0;
};

// Instance method to check and update sale status based on balances
saleSchema.methods.checkAndUpdateStatus = async function() {
  const previousStatus = this.status;
  
  // Check if sale should be closed (all passenger payments received)
  if (this.clientBalance <= 0 && this.status === 'open') {
    this.status = 'closed';
    console.log(`Sale ${this._id} status changed from ${previousStatus} to ${this.status} - Passenger balance: ${this.clientBalance}`);
  }
  
  // Check if sale should be reopened (if payments were refunded and balance is now positive)
  if (this.clientBalance > 0 && this.status === 'closed') {
    this.status = 'open';
    console.log(`Sale ${this._id} status changed from ${previousStatus} to ${this.status} - Passenger balance: ${this.clientBalance}`);
  }
  
  // Only save if status changed
  if (this.status !== previousStatus) {
    await this.save();
    return { statusChanged: true, previousStatus, newStatus: this.status };
  }
  
  return { statusChanged: false, currentStatus: this.status };
};

// Instance method to recalculate payment totals from actual payments
saleSchema.methods.recalculatePaymentTotals = async function() {
  const Payment = require('./Payment');
  
  // Get all client payments for this sale (include all statuses for debugging)
  const clientPayments = await Payment.find({
    saleId: this._id,
    type: 'client'
  });
  
  // Get all provider payments for this sale (include all statuses for debugging)
  const providerPayments = await Payment.find({
    saleId: this._id,
    type: 'provider'
  });
  
  console.log(`Recalculating payments for sale ${this._id}:`);
  console.log(`Found ${clientPayments.length} client payments:`, clientPayments.map(p => ({ amount: p.amount, currency: p.currency, status: p.status })));
  console.log(`Found ${providerPayments.length} provider payments:`, providerPayments.map(p => ({ amount: p.amount, currency: p.currency, status: p.status })));
  
  // Calculate totals in USD
  let totalClientPaymentsUSD = 0;
  let totalProviderPaymentsUSD = 0;
  
  clientPayments.forEach(payment => {
    if (payment.currency === 'USD') {
      totalClientPaymentsUSD += payment.amount;
    } else if (payment.exchangeRate && payment.baseCurrency === 'USD') {
      totalClientPaymentsUSD += payment.amount * payment.exchangeRate;
    } else {
      // Fallback: assume 1:1 conversion if no exchange rate
      totalClientPaymentsUSD += payment.amount;
    }
  });
  
  providerPayments.forEach(payment => {
    if (payment.currency === 'USD') {
      totalProviderPaymentsUSD += payment.amount;
    } else if (payment.exchangeRate && payment.baseCurrency === 'USD') {
      totalProviderPaymentsUSD += payment.amount * payment.exchangeRate;
    } else {
      // Fallback: assume 1:1 conversion if no exchange rate
      totalProviderPaymentsUSD += payment.amount;
    }
  });
  
  console.log(`Calculated totals - Client: U$${totalClientPaymentsUSD}, Provider: U$${totalProviderPaymentsUSD}`);
  
  // Update the totals
  this.totalClientPayments = totalClientPaymentsUSD;
  this.totalProviderPayments = totalProviderPaymentsUSD;
  
  // Recalculate balances
  this.clientBalance = this.totalSalePrice - this.totalClientPayments;
  this.providerBalance = this.totalProviderPayments - this.totalCost;
  
  // Use updateOne to avoid triggering pre-save middleware that recalculates totals
  return this.updateOne({
    totalClientPayments: this.totalClientPayments,
    totalProviderPayments: this.totalProviderPayments,
    clientBalance: this.clientBalance,
    providerBalance: this.providerBalance,
    updatedAt: new Date()
  });
};

// Instance method to get payment summary
saleSchema.methods.getPaymentSummary = function() {
  return {
    totalSalePrice: this.totalSalePrice,
    totalClientPayments: this.totalClientPayments,
    clientBalance: this.clientBalance,
    totalProviderPayments: this.totalProviderPayments,
    providerBalance: this.providerBalance,
    isFullyPaid: this.isFullyPaid(),
    areProvidersFullyPaid: this.areProvidersFullyPaid()
  };
};

// Static method to find sales by status
saleSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate('clientId', 'name surname email');
};

// Static method to find sales by date range
saleSchema.statics.findByDateRange = function(startDate, endDate) {
  const query = {};
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  return this.find(query).populate('clientId', 'name surname email');
};

// Static method to find sales by user
saleSchema.statics.findByUser = function(userId) {
  return this.find({ createdBy: userId }).populate('clientId', 'name surname email');
};

// Static method to get sales statistics
saleSchema.statics.getStatistics = function(startDate, endDate) {
  const matchConditions = {};
  
  if (startDate || endDate) {
    matchConditions.createdAt = {};
    if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
    if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        openSales: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        closedSales: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        cancelledSales: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        totalRevenue: { $sum: '$totalSalePrice' },
        totalCost: { $sum: '$totalCost' },
        totalProfit: { $sum: '$profit' },
        averageSaleValue: { $avg: '$totalSalePrice' },
        averageProfit: { $avg: '$profit' }
      }
    }
  ]);
};

// Static method to get top clients by revenue
saleSchema.statics.getTopClients = function(limit = 10) {
  return this.aggregate([
    {
      $group: {
        _id: '$clientId',
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$totalSalePrice' },
        totalProfit: { $sum: '$profit' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'client'
      }
    },
    { $unwind: '$client' }
  ]);
};

// Transform output
saleSchema.methods.toJSON = function() {
  const saleObject = this.toObject();
  saleObject.id = saleObject._id;
  saleObject.profitMargin = this.profitMargin;
  saleObject.formattedTotalSalePrice = this.formattedTotalSalePrice;
  saleObject.formattedTotalCost = this.formattedTotalCost;
  saleObject.formattedProfit = this.formattedProfit;
  saleObject.formattedClientBalance = this.formattedClientBalance;
  saleObject.formattedProviderBalance = this.formattedProviderBalance;
  saleObject.formattedTotalClientPayments = this.formattedTotalClientPayments;
  saleObject.formattedTotalProviderPayments = this.formattedTotalProviderPayments;
  return saleObject;
};

module.exports = mongoose.model('Sale', saleSchema);