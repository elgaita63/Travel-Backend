const mongoose = require('mongoose');

const provisionalReceiptSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: [true, 'Sale ID is required']
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Payment ID is required']
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  passengerDetails: {
    name: {
      type: String,
      required: [true, 'Passenger name is required'],
      trim: true
    },
    surname: {
      type: String,
      required: [true, 'Passenger surname is required'],
      trim: true
    },
    passportNumber: {
      type: String,
      required: [true, 'Passport number is required'],
      trim: true,
      uppercase: true
    },
    nationality: {
      type: String,
      required: [true, 'Nationality is required'],
      trim: true
    }
  },
  serviceDetails: {
    title: {
      type: String,
      required: [true, 'Service destino is required'],
      trim: true
    },
    type: {
      type: String,
      required: [true, 'Service type is required'],
      trim: true
    },
    providerName: {
      type: String,
      required: false,
      trim: true,
      default: 'Unknown Provider'
    },
    startDate: {
      type: Date,
      required: false,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: false,
      default: Date.now
    }
  },
  paymentDetails: {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative']
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters']
    },
    method: {
      type: String,
      required: [true, 'Payment method is required'],
      trim: true
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required']
    }
  },
  companyDetails: {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      default: 'Mare Nostrum Travel'
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    },
    phone: String,
    email: String,
    website: String,
    logo: String
  },
  whatsappStatus: {
    status: {
      type: String,
      enum: ['pending', 'sent', 'responded'],
      default: 'pending'
    },
    sentAt: {
      type: Date,
      default: null
    },
    respondedAt: {
      type: Date,
      default: null
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: [500, 'Response message cannot exceed 500 characters']
    },
    conversationHistory: [{
      message: {
        type: String,
        required: true,
        trim: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      type: {
        type: String,
        enum: ['customer', 'agent'],
        default: 'customer'
      }
    }],
    whatsappMessageId: {
      type: String,
      trim: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'delivered', 'cancelled'],
    default: 'draft'
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Receipt expires in 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
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
provisionalReceiptSchema.index({ receiptNumber: 1 });
provisionalReceiptSchema.index({ saleId: 1 });
provisionalReceiptSchema.index({ paymentId: 1 });
provisionalReceiptSchema.index({ clientId: 1 });
provisionalReceiptSchema.index({ status: 1 });
provisionalReceiptSchema.index({ generatedAt: -1 });
provisionalReceiptSchema.index({ 'whatsappStatus.status': 1 });
provisionalReceiptSchema.index({ createdBy: 1 });

// Pre-save middleware to generate receipt number
provisionalReceiptSchema.pre('save', function(next) {
  if (this.isNew && !this.receiptNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.receiptNumber = `PNR-${timestamp}-${random}`;
  }
  next();
});

// Pre-validate middleware to ensure receipt number exists
provisionalReceiptSchema.pre('validate', function(next) {
  if (this.isNew && !this.receiptNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.receiptNumber = `PNR-${timestamp}-${random}`;
  }
  next();
});

// Virtual for full passenger name
provisionalReceiptSchema.virtual('passengerFullName').get(function() {
  return `${this.passengerDetails.name} ${this.passengerDetails.surname}`;
});

// Virtual for formatted address
provisionalReceiptSchema.virtual('formattedCompanyAddress').get(function() {
  if (!this.companyDetails.address) return null;
  
  const parts = [];
  if (this.companyDetails.address.street) parts.push(this.companyDetails.address.street);
  if (this.companyDetails.address.city) parts.push(this.companyDetails.address.city);
  if (this.companyDetails.address.state) parts.push(this.companyDetails.address.state);
  if (this.companyDetails.address.zipCode) parts.push(this.companyDetails.address.zipCode);
  if (this.companyDetails.address.country) parts.push(this.companyDetails.address.country);
  
  return parts.join(', ');
});


// Virtual for formatted payment amount
provisionalReceiptSchema.virtual('formattedPaymentAmount').get(function() {
  return `${this.paymentDetails.currency} ${this.paymentDetails.amount.toLocaleString()}`;
});

// Virtual for formatted service dates
provisionalReceiptSchema.virtual('formattedServiceDates').get(function() {
  const startDate = this.serviceDetails.startDate.toLocaleDateString();
  const endDate = this.serviceDetails.endDate.toLocaleDateString();
  return `${startDate} - ${endDate}`;
});

// Virtual for WhatsApp share URL
provisionalReceiptSchema.virtual('whatsappShareUrl').get(function() {
  const message = `*Provisional Receipt - ${this.receiptNumber}*\n\n` +
    `*Passenger:* ${this.passengerFullName}\n` +
    `*Passport:* ${this.passengerDetails.passportNumber}\n` +
    `*Service:* ${this.serviceDetails.title}\n` +
    `*Dates:* ${this.formattedServiceDates}\n` +
    `*Amount:* ${this.formattedPaymentAmount}\n` +
    `*Payment Method:* ${this.paymentDetails.method}\n\n` +
    `Thank you for choosing ${this.companyDetails.name}!`;
  
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
});

// Instance method to mark as sent
provisionalReceiptSchema.methods.markAsSent = function(messageId) {
  this.whatsappStatus.status = 'sent';
  this.whatsappStatus.sentAt = new Date();
  if (messageId) this.whatsappStatus.whatsappMessageId = messageId;
  this.status = 'sent';
  return this.save();
};

// Instance method to mark as responded
provisionalReceiptSchema.methods.markAsResponded = function(responseMessage) {
  this.whatsappStatus.status = 'responded';
  this.whatsappStatus.respondedAt = new Date();
  
  if (responseMessage) {
    // Keep the latest response message for backward compatibility
    this.whatsappStatus.responseMessage = responseMessage;
    
    // Add to conversation history
    if (!this.whatsappStatus.conversationHistory) {
      this.whatsappStatus.conversationHistory = [];
    }
    
    this.whatsappStatus.conversationHistory.push({
      message: responseMessage,
      timestamp: new Date(),
      type: 'customer'
    });
  }
  
  this.status = 'delivered';
  return this.save();
};

// Instance method to check if receipt is expired
provisionalReceiptSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Static method to find receipts by status
provisionalReceiptSchema.statics.findByStatus = function(status) {
  return this.find({ status }).populate([
    { path: 'saleId', select: 'id totalSalePrice' },
    { path: 'clientId', select: 'name surname email phone' },
    { path: 'createdBy', select: 'username email' }
  ]);
};

// Static method to find receipts by WhatsApp status
provisionalReceiptSchema.statics.findByWhatsAppStatus = function(status) {
  return this.find({ 'whatsappStatus.status': status }).populate([
    { path: 'saleId', select: 'id totalSalePrice' },
    { path: 'clientId', select: 'name surname email phone' },
    { path: 'createdBy', select: 'username email' }
  ]);
};

// Static method to find expired receipts
provisionalReceiptSchema.statics.findExpired = function() {
  return this.find({ expiresAt: { $lt: new Date() } });
};

// Static method to generate receipt statistics
provisionalReceiptSchema.statics.getStatistics = function(startDate, endDate) {
  const matchConditions = {};
  
  if (startDate || endDate) {
    matchConditions.generatedAt = {};
    if (startDate) matchConditions.generatedAt.$gte = new Date(startDate);
    if (endDate) matchConditions.generatedAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        draftReceipts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        generatedReceipts: { $sum: { $cond: [{ $eq: ['$status', 'generated'] }, 1, 0] } },
        sentReceipts: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        deliveredReceipts: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        pendingWhatsApp: { $sum: { $cond: [{ $eq: ['$whatsappStatus.status', 'pending'] }, 1, 0] } },
        sentWhatsApp: { $sum: { $cond: [{ $eq: ['$whatsappStatus.status', 'sent'] }, 1, 0] } },
        respondedWhatsApp: { $sum: { $cond: [{ $eq: ['$whatsappStatus.status', 'responded'] }, 1, 0] } },
        totalAmount: { $sum: '$paymentDetails.amount' }
      }
    }
  ]);
};

// Transform output
provisionalReceiptSchema.methods.toJSON = function() {
  const receiptObject = this.toObject();
  receiptObject.passengerFullName = this.passengerFullName;
  receiptObject.formattedCompanyAddress = this.formattedCompanyAddress;
  receiptObject.formattedPaymentAmount = this.formattedPaymentAmount;
  receiptObject.formattedServiceDates = this.formattedServiceDates;
  receiptObject.whatsappShareUrl = this.whatsappShareUrl;
  return receiptObject;
};

module.exports = mongoose.model('ProvisionalReceipt', provisionalReceiptSchema);