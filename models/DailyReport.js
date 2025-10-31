const mongoose = require('mongoose');

const arrivedPassengerSchema = new mongoose.Schema({
  passengerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Passenger',
    required: [true, 'Passenger ID is required']
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: [true, 'Sale ID is required']
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
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
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
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
      required: [true, 'Provider name is required'],
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Service start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Service end date is required']
    },
    location: {
      city: String,
      country: String
    }
  },
  arrivalDetails: {
    expectedArrivalDate: {
      type: Date,
      required: [true, 'Expected arrival date is required']
    },
    actualArrivalDate: {
      type: Date,
      required: [true, 'Actual arrival date is required']
    },
    arrivalTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    arrivalLocation: {
      type: String,
      trim: true
    },
    flightNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    confirmationNumber: {
      type: String,
      trim: true,
      uppercase: true
    }
  },
  status: {
    type: String,
    enum: ['expected', 'arrived', 'delayed', 'cancelled', 'no_show'],
    default: 'expected'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
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
    whatsappMessageId: {
      type: String,
      trim: true
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

const dailyReportSchema = new mongoose.Schema({
  reportDate: {
    type: Date,
    required: [true, 'Report date is required'],
    unique: true
  },
  arrivedPassengers: [arrivedPassengerSchema],
  totalExpected: {
    type: Number,
    default: 0,
    min: [0, 'Total expected cannot be negative']
  },
  totalArrived: {
    type: Number,
    default: 0,
    min: [0, 'Total arrived cannot be negative']
  },
  totalDelayed: {
    type: Number,
    default: 0,
    min: [0, 'Total delayed cannot be negative']
  },
  totalCancelled: {
    type: Number,
    default: 0,
    min: [0, 'Total cancelled cannot be negative']
  },
  totalNoShow: {
    type: Number,
    default: 0,
    min: [0, 'Total no show cannot be negative']
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'completed'],
    default: 'draft'
  },
  generatedAt: {
    type: Date,
    default: Date.now
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
    whatsappMessageId: {
      type: String,
      trim: true
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
dailyReportSchema.index({ reportDate: 1 });
dailyReportSchema.index({ status: 1 });
dailyReportSchema.index({ generatedAt: -1 });
dailyReportSchema.index({ 'whatsappStatus.status': 1 });
dailyReportSchema.index({ createdBy: 1 });

arrivedPassengerSchema.index({ passengerId: 1 });
arrivedPassengerSchema.index({ clientId: 1 });
arrivedPassengerSchema.index({ saleId: 1 });
arrivedPassengerSchema.index({ serviceId: 1 });
arrivedPassengerSchema.index({ 'arrivalDetails.actualArrivalDate': 1 });
arrivedPassengerSchema.index({ status: 1 });

// Pre-save middleware to calculate totals
dailyReportSchema.pre('save', function(next) {
  if (this.arrivedPassengers && this.arrivedPassengers.length > 0) {
    this.totalExpected = this.arrivedPassengers.length;
    this.totalArrived = this.arrivedPassengers.filter(p => p.status === 'arrived').length;
    this.totalDelayed = this.arrivedPassengers.filter(p => p.status === 'delayed').length;
    this.totalCancelled = this.arrivedPassengers.filter(p => p.status === 'cancelled').length;
    this.totalNoShow = this.arrivedPassengers.filter(p => p.status === 'no_show').length;
  }
  next();
});

// Virtual for formatted report date
dailyReportSchema.virtual('formattedReportDate').get(function() {
  return this.reportDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for arrival rate
dailyReportSchema.virtual('arrivalRate').get(function() {
  if (this.totalExpected === 0) return 0;
  return ((this.totalArrived / this.totalExpected) * 100).toFixed(1);
});

// Virtual for WhatsApp share URL
dailyReportSchema.virtual('whatsappShareUrl').get(function() {
  const message = `*Daily Arrival Report - ${this.formattedReportDate}*\n\n` +
    `*Summary:*\n` +
    `• Expected: ${this.totalExpected}\n` +
    `• Arrived: ${this.totalArrived}\n` +
    `• Delayed: ${this.totalDelayed}\n` +
    `• Cancelled: ${this.totalCancelled}\n` +
    `• No Show: ${this.totalNoShow}\n` +
    `• Arrival Rate: ${this.arrivalRate}%\n\n` +
    `*Arrived Passengers:*\n` +
    this.arrivedPassengers
      .filter(p => p.status === 'arrived')
      .map(p => `• ${p.passengerDetails.name} ${p.passengerDetails.surname} (${p.passengerDetails.passportNumber}) - ${p.serviceDetails.title}`)
      .join('\n');
  
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
});

// Instance method to add arrived passenger
dailyReportSchema.methods.addArrivedPassenger = function(passengerData) {
  this.arrivedPassengers.push(passengerData);
  return this.save();
};

// Instance method to update passenger status
// Method to recalculate summary statistics
dailyReportSchema.methods.recalculateStatistics = function() {
  const passengers = this.arrivedPassengers;
  
  this.totalExpected = 0;
  this.totalArrived = 0;
  this.totalDelayed = 0;
  this.totalCancelled = 0;
  this.totalNoShow = 0;

  passengers.forEach(passenger => {
    switch (passenger.status) {
      case 'expected':
        this.totalExpected++;
        break;
      case 'arrived':
        this.totalArrived++;
        break;
      case 'delayed':
        this.totalDelayed++;
        break;
      case 'cancelled':
        this.totalCancelled++;
        break;
      case 'no_show':
        this.totalNoShow++;
        break;
      default:
        // Unknown status, count as expected
        this.totalExpected++;
        break;
    }
  });

  // Calculate arrival rate based on expected passengers
  this.arrivalRate = this.totalExpected > 0 
    ? parseFloat(((this.totalArrived / this.totalExpected) * 100).toFixed(1))
    : 0;
};

dailyReportSchema.methods.updatePassengerStatus = function(passengerId, status, notes) {
  const passenger = this.arrivedPassengers.id(passengerId);
  if (passenger) {
    passenger.status = status;
    if (notes) passenger.notes = notes;
    if (status === 'arrived') {
      passenger.arrivalDetails.actualArrivalDate = new Date();
    }
    
    // Recalculate statistics after updating passenger status
    this.recalculateStatistics();
    
    return this.save();
  }
  throw new Error('Passenger not found');
};

// Instance method to mark as sent
dailyReportSchema.methods.markAsSent = function(messageId) {
  this.whatsappStatus.status = 'sent';
  this.whatsappStatus.sentAt = new Date();
  if (messageId) this.whatsappStatus.whatsappMessageId = messageId;
  this.status = 'sent';
  return this.save();
};

// Instance method to mark as responded
dailyReportSchema.methods.markAsResponded = function(responseMessage) {
  this.whatsappStatus.status = 'responded';
  this.whatsappStatus.respondedAt = new Date();
  if (responseMessage) this.whatsappStatus.responseMessage = responseMessage;
  this.status = 'completed';
  return this.save();
};

// Static method to find reports by date range
dailyReportSchema.statics.findByDateRange = function(startDate, endDate) {
  const query = {};
  if (startDate || endDate) {
    query.reportDate = {};
    if (startDate) query.reportDate.$gte = new Date(startDate);
    if (endDate) query.reportDate.$lte = new Date(endDate);
  }
  
  return this.find(query).populate([
    { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
    { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
    { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
    { path: 'arrivedPassengers.serviceId', select: 'title type' },
    { path: 'createdBy', select: 'username email' }
  ]);
};

// Static method to find today's report
dailyReportSchema.statics.findToday = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.findOne({
    reportDate: { $gte: today, $lt: tomorrow }
  }).populate([
    { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
    { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
    { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
    { path: 'arrivedPassengers.serviceId', select: 'title type' },
    { path: 'createdBy', select: 'username email' }
  ]);
};

// Static method to find report by specific date
dailyReportSchema.statics.findByDate = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  return this.findOne({
    reportDate: { $gte: targetDate, $lt: nextDay }
  }).populate([
    { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
    { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
    { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
    { path: 'arrivedPassengers.serviceId', select: 'title type' },
    { path: 'createdBy', select: 'username email' }
  ]);
};

// Static method to generate daily report
dailyReportSchema.statics.generateDailyReport = async function(date) {
  // Ensure we work with UTC dates to avoid timezone issues
  const reportDate = new Date(date);
  reportDate.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(reportDate.getTime() + 24 * 60 * 60 * 1000);
  
  // Find all sales that have services ending on this date
  const sales = await mongoose.model('Sale').find({
    'services.serviceId': { $exists: true },
    status: { $in: ['open', 'confirmed', 'completed'] }
  }).populate([
    { path: 'clientId', select: 'name surname email phone' },
    { path: 'passengers.passengerId', select: 'name surname passportNumber nationality' },
    { path: 'services.serviceId', select: 'title type availability location' },
    { path: 'services.providerId', select: 'name' }
  ]);
  
  // Create arrived passengers data
  const arrivedPassengers = [];
  for (const sale of sales) {
    for (const serviceSale of sale.services) {
      const service = serviceSale.serviceId;
      const provider = serviceSale.providerId;
      
      // Check if this service ends on the report date
      if (service && service.availability && service.availability.endDate) {
        const serviceEndDate = new Date(service.availability.endDate);
        serviceEndDate.setUTCHours(0, 0, 0, 0);
        
        if (serviceEndDate.getTime() === reportDate.getTime()) {
          // This service ends on the report date, so passengers should arrive
          for (const passengerSale of sale.passengers) {
            const passenger = passengerSale.passengerId;
            
            if (passenger) {
              arrivedPassengers.push({
                passengerId: passenger._id,
                clientId: sale.clientId._id,
                saleId: sale._id,
                serviceId: service._id,
                passengerDetails: {
                  name: passenger.name,
                  surname: passenger.surname,
                  passportNumber: passenger.passportNumber,
                  nationality: passenger.nationality,
                  phone: sale.clientId.phone,
                  email: sale.clientId.email
                },
                serviceDetails: {
                  title: service.destino,
                  type: service.type,
                  providerName: provider.name,
                  startDate: service.availability.startDate,
                  endDate: service.availability.endDate,
                  location: {
                    city: service.location?.city || '',
                    country: service.location?.country || ''
                  }
                },
                arrivalDetails: {
                  expectedArrivalDate: service.availability.endDate,
                  actualArrivalDate: service.availability.endDate
                },
                status: 'expected',
                createdBy: sale.createdBy
              });
            }
          }
        }
      }
    }
  }
  
  // Create or update daily report
  let report = await this.findOne({ reportDate });
  if (report) {
    report.arrivedPassengers = arrivedPassengers;
    report.status = 'generated';
    // Reset WhatsApp status when regenerating report
    report.whatsappStatus = {
      status: 'pending',
      sentAt: null,
      respondedAt: null,
      responseMessage: '',
      whatsappMessageId: ''
    };
  } else {
    report = new this({
      reportDate,
      arrivedPassengers,
      status: 'generated',
      whatsappStatus: {
        status: 'pending',
        sentAt: null,
        respondedAt: null,
        responseMessage: '',
        whatsappMessageId: ''
      },
      createdBy: arrivedPassengers[0]?.createdBy || new mongoose.Types.ObjectId()
    });
  }
  
  // Recalculate statistics after setting passengers
  report.recalculateStatistics();
  await report.save();
  
  // Log when no passengers found (no automatic sample data)
  if (arrivedPassengers.length === 0) {
    console.log(`No passengers found for report date: ${reportDate.toISOString().split('T')[0]}`);
    console.log('Report will be created with empty passenger list. Use the "Add Sample Data" button to add test data if needed.');
  }
  
  return report;
};

// Transform output
dailyReportSchema.methods.toJSON = function() {
  const reportObject = this.toObject();
  reportObject.formattedReportDate = this.formattedReportDate;
  reportObject.arrivalRate = this.arrivalRate;
  reportObject.whatsappShareUrl = this.whatsappShareUrl;
  return reportObject;
};

module.exports = mongoose.model('DailyReport', dailyReportSchema);