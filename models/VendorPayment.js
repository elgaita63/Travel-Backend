const mongoose = require('mongoose');

const vendorPaymentSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: [true, 'Sale ID is required']
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider ID is required']
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Payment ID is required']
  },
  // Service details for this payment
  serviceDetails: {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required']
    },
    serviceTitle: {
      type: String,
      required: [true, 'Service destino is required']
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1']
    },
    priceClient: {
      type: Number,
      required: [true, 'Client price is required'],
      min: [0, 'Client price cannot be negative']
    },
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
    }
  },
  // Payment details
  paymentDetails: {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative']
    },
    currency: {
      type: String,
      required: [true, 'Payment currency is required'],
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
      default: 'USD'
    },
    method: {
      type: String,
      required: [true, 'Payment method is required']
    },
    date: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'completed'
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
    }
  },
  // Commission and profit calculations
  commission: {
    rate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%']
    },
    amount: {
      type: Number,
      required: [true, 'Commission amount is required'],
      min: [0, 'Commission amount cannot be negative']
    },
    currency: {
      type: String,
      required: [true, 'Commission currency is required'],
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
      default: 'USD'
    }
  },
  // Profit calculations
  profit: {
    grossRevenue: {
      type: Number,
      required: [true, 'Gross revenue is required'],
      min: [0, 'Gross revenue cannot be negative']
    },
    providerCost: {
      type: Number,
      required: [true, 'Provider cost is required'],
      min: [0, 'Provider cost cannot be negative']
    },
    commissionAmount: {
      type: Number,
      required: [true, 'Commission amount is required'],
      min: [0, 'Commission amount cannot be negative']
    },
    netProfit: {
      type: Number,
      required: [true, 'Net profit is required']
    },
    currency: {
      type: String,
      required: [true, 'Profit currency is required'],
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
      default: 'USD'
    }
  },
  // Payment terms and due dates
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_45', 'net_60'],
    required: [true, 'Payment terms is required']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  isOverdue: {
    type: Boolean,
    default: false
  },
  daysOverdue: {
    type: Number,
    default: 0,
    min: [0, 'Days overdue cannot be negative']
  },
  // Additional information
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
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
vendorPaymentSchema.index({ saleId: 1 });
vendorPaymentSchema.index({ providerId: 1 });
vendorPaymentSchema.index({ paymentId: 1 });
vendorPaymentSchema.index({ 'serviceDetails.serviceId': 1 });
vendorPaymentSchema.index({ 'paymentDetails.date': -1 });
vendorPaymentSchema.index({ dueDate: 1 });
vendorPaymentSchema.index({ isOverdue: 1 });
vendorPaymentSchema.index({ createdBy: 1 });

// Pre-save middleware to calculate due date and overdue status
vendorPaymentSchema.pre('save', function(next) {
  // Calculate due date based on payment terms
  const paymentDate = this.paymentDetails.date || new Date();
  let daysToAdd = 0;
  
  switch (this.paymentTerms) {
    case 'immediate':
      daysToAdd = 0;
      break;
    case 'net_15':
      daysToAdd = 15;
      break;
    case 'net_30':
      daysToAdd = 30;
      break;
    case 'net_45':
      daysToAdd = 45;
      break;
    case 'net_60':
      daysToAdd = 60;
      break;
    default:
      daysToAdd = 30;
  }
  
  this.dueDate = new Date(paymentDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
  
  // Calculate overdue status
  const now = new Date();
  this.isOverdue = now > this.dueDate && this.paymentDetails.status !== 'completed';
  
  if (this.isOverdue) {
    const timeDiff = now.getTime() - this.dueDate.getTime();
    this.daysOverdue = Math.ceil(timeDiff / (1000 * 3600 * 24));
  } else {
    this.daysOverdue = 0;
  }
  
  next();
});

// Virtual for formatted payment amount
vendorPaymentSchema.virtual('formattedPaymentAmount').get(function() {
  return `${this.paymentDetails.currency} ${this.paymentDetails.amount.toLocaleString()}`;
});

// Virtual for formatted commission amount
vendorPaymentSchema.virtual('formattedCommissionAmount').get(function() {
  return `${this.commission.currency} ${this.commission.amount.toLocaleString()}`;
});

// Virtual for formatted profit
vendorPaymentSchema.virtual('formattedProfit').get(function() {
  return `${this.profit.currency} ${this.profit.netProfit.toLocaleString()}`;
});

// Virtual for payment status color
vendorPaymentSchema.virtual('paymentStatusColor').get(function() {
  switch (this.paymentDetails.status) {
    case 'completed':
      return 'green';
    case 'pending':
      return 'yellow';
    case 'failed':
      return 'red';
    case 'refunded':
      return 'blue';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
});

// Instance method to calculate totals for a provider
vendorPaymentSchema.statics.getProviderTotals = async function(providerId, startDate, endDate) {
  const matchConditions = { providerId };
  
  if (startDate || endDate) {
    matchConditions['paymentDetails.date'] = {};
    if (startDate) matchConditions['paymentDetails.date'].$gte = new Date(startDate);
    if (endDate) matchConditions['paymentDetails.date'].$lte = new Date(endDate);
  }
  
  const totals = await this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: '$paymentDetails.amount' },
        totalCommissions: { $sum: '$commission.amount' },
        totalProfit: { $sum: '$profit.netProfit' },
        totalGrossRevenue: { $sum: '$profit.grossRevenue' },
        totalProviderCost: { $sum: '$profit.providerCost' },
        overduePayments: {
          $sum: {
            $cond: [
              { $and: ['$isOverdue', { $ne: ['$paymentDetails.status', 'completed'] }] },
              '$paymentDetails.amount',
              0
            ]
          }
        },
        paymentCount: { $sum: 1 },
        overdueCount: {
          $sum: {
            $cond: [
              { $and: ['$isOverdue', { $ne: ['$paymentDetails.status', 'completed'] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return totals[0] || {
    totalPayments: 0,
    totalCommissions: 0,
    totalProfit: 0,
    totalGrossRevenue: 0,
    totalProviderCost: 0,
    overduePayments: 0,
    paymentCount: 0,
    overdueCount: 0
  };
};

module.exports = mongoose.model('VendorPayment', vendorPaymentSchema);