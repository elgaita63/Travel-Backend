const mongoose = require('mongoose');

const adminInsightsSchema = new mongoose.Schema({
  // Performance Metrics
  period: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  
  // Overall Business Metrics
  businessMetrics: {
    totalSales: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    saleCount: {
      type: Number,
      default: 0
    },
    totalClients: {
      type: Number,
      default: 0
    },
    newClients: {
      type: Number,
      default: 0
    },
    averageSaleValue: {
      type: Number,
      default: 0
    },
    profitMargin: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    }
  },

  // Seller Performance Metrics
  sellerMetrics: [{
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sellerName: {
      type: String,
      required: true
    },
    sellerEmail: {
      type: String,
      required: true
    },
    performance: {
      totalSales: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      totalProfit: {
        type: Number,
        default: 0
      },
      saleCount: {
        type: Number,
        default: 0
      },
      averageSaleValue: {
        type: Number,
        default: 0
      },
      profitMargin: {
        type: Number,
        default: 0
      },
      clientCount: {
        type: Number,
        default: 0
      },
      newClients: {
        type: Number,
        default: 0
      },
      conversionRate: {
        type: Number,
        default: 0
      },
      ranking: {
        type: Number,
        default: 0
      }
    },
    targets: {
      salesTarget: {
        type: Number,
        default: 0
      },
      revenueTarget: {
        type: Number,
        default: 0
      },
      profitTarget: {
        type: Number,
        default: 0
      },
      clientTarget: {
        type: Number,
        default: 0
      }
    },
    achievements: {
      salesAchieved: {
        type: Number,
        default: 0
      },
      revenueAchieved: {
        type: Number,
        default: 0
      },
      profitAchieved: {
        type: Number,
        default: 0
      },
      clientAchieved: {
        type: Number,
        default: 0
      }
    }
  }],

  // Service Performance
  serviceMetrics: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    serviceName: {
      type: String,
      required: true
    },
    serviceType: {
      type: String,
      required: true
    },
    performance: {
      totalSales: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      totalProfit: {
        type: Number,
        default: 0
      },
      saleCount: {
        type: Number,
        default: 0
      },
      averagePrice: {
        type: Number,
        default: 0
      },
      profitMargin: {
        type: Number,
        default: 0
      },
      ranking: {
        type: Number,
        default: 0
      }
    }
  }],

  // Provider Performance
  providerMetrics: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true
    },
    providerName: {
      type: String,
      required: true
    },
    providerType: {
      type: String,
      required: true
    },
    performance: {
      totalSales: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      totalProfit: {
        type: Number,
        default: 0
      },
      saleCount: {
        type: Number,
        default: 0
      },
      averageSaleValue: {
        type: Number,
        default: 0
      },
      profitMargin: {
        type: Number,
        default: 0
      },
      ranking: {
        type: Number,
        default: 0
      }
    }
  }],

  // Monthly Trends
  monthlyTrends: [{
    month: {
      type: String,
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    metrics: {
      totalSales: {
        type: Number,
        default: 0
      },
      totalRevenue: {
        type: Number,
        default: 0
      },
      totalProfit: {
        type: Number,
        default: 0
      },
      saleCount: {
        type: Number,
        default: 0
      },
      newClients: {
        type: Number,
        default: 0
      },
      profitMargin: {
        type: Number,
        default: 0
      }
    }
  }],

  // Activity Insights
  activityInsights: {
    totalActivities: {
      type: Number,
      default: 0
    },
    salesCreated: {
      type: Number,
      default: 0
    },
    paymentsProcessed: {
      type: Number,
      default: 0
    },
    clientsAdded: {
      type: Number,
      default: 0
    },
    servicesAdded: {
      type: Number,
      default: 0
    },
    mostActiveSeller: {
      sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      sellerName: String,
      activityCount: {
        type: Number,
        default: 0
      }
    }
  },

  // System Health Metrics
  systemHealth: {
    uptime: {
      type: Number,
      default: 99.9
    },
    responseTime: {
      type: Number,
      default: 0
    },
    errorRate: {
      type: Number,
      default: 0
    },
    activeUsers: {
      type: Number,
      default: 0
    },
    dataIntegrity: {
      type: Number,
      default: 100
    }
  },

  // Metadata
  generatedAt: {
    type: Date,
    default: Date.now
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
adminInsightsSchema.index({ period: 1, periodStart: 1, periodEnd: 1 });
adminInsightsSchema.index({ 'sellerMetrics.sellerId': 1 });
adminInsightsSchema.index({ 'serviceMetrics.serviceId': 1 });
adminInsightsSchema.index({ 'providerMetrics.providerId': 1 });
adminInsightsSchema.index({ generatedAt: -1 });
adminInsightsSchema.index({ isActive: 1 });

// Virtual for period display
adminInsightsSchema.virtual('periodDisplay').get(function() {
  const start = this.periodStart.toLocaleDateString();
  const end = this.periodEnd.toLocaleDateString();
  return `${start} - ${end}`;
});

// Virtual for top performing seller
adminInsightsSchema.virtual('topSeller').get(function() {
  if (!this.sellerMetrics || this.sellerMetrics.length === 0) return null;
  
  return this.sellerMetrics.reduce((top, seller) => {
    if (!top || seller.performance.totalProfit > top.performance.totalProfit) {
      return seller;
    }
    return top;
  }, null);
});

// Virtual for top performing service
adminInsightsSchema.virtual('topService').get(function() {
  if (!this.serviceMetrics || this.serviceMetrics.length === 0) return null;
  
  return this.serviceMetrics.reduce((top, service) => {
    if (!top || service.performance.totalRevenue > top.performance.totalRevenue) {
      return service;
    }
    return top;
  }, null);
});

// Static method to get latest insights
adminInsightsSchema.statics.getLatestInsights = function(period = 'monthly') {
  return this.findOne({ 
    period, 
    isActive: true 
  }).sort({ generatedAt: -1 });
};

// Static method to get insights by date range
adminInsightsSchema.statics.getInsightsByDateRange = function(startDate, endDate, period = 'monthly') {
  return this.find({
    period,
    periodStart: { $gte: startDate },
    periodEnd: { $lte: endDate },
    isActive: true
  }).sort({ periodStart: -1 });
};

// Static method to get seller performance history
adminInsightsSchema.statics.getSellerPerformanceHistory = function(sellerId, period = 'monthly', limit = 12) {
  return this.find({
    'sellerMetrics.sellerId': sellerId,
    period,
    isActive: true
  }).sort({ periodStart: -1 }).limit(limit);
};

// Static method to generate insights for a period
adminInsightsSchema.statics.generateInsights = async function(period, startDate, endDate, generatedBy, currency = null) {
  const Sale = require('./Sale');
  const Client = require('./Client');
  const Service = require('./Service');
  const Provider = require('./Provider');
  const User = require('./User');
  const ActivityLog = require('./ActivityLog');

  try {
    // Build match conditions for the period
    const matchConditions = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Add currency filter if specified
    if (currency) {
      matchConditions.saleCurrency = currency.toUpperCase();
    }

    // Get overall business metrics
    const businessMetrics = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalSalePrice' },
          totalProfit: { $sum: '$profit' },
          saleCount: { $sum: 1 },
          averageSaleValue: { $avg: '$totalSalePrice' }
        }
      }
    ]);

    // Get client metrics
    const clientMetrics = await Client.aggregate([
      { 
        $match: { 
          createdAt: { 
            $gte: startDate, 
            $lte: endDate 
          } 
        } 
      },
      {
        $group: {
          _id: null,
          newClients: { $sum: 1 }
        }
      }
    ]);

    // Get passenger metrics from sales within the period
    const passengerMetrics = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalPassengers: { $sum: { $size: '$passengers' } }
        }
      }
    ]);

    // Get seller performance
    const sellerPerformance = await Sale.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: '$seller' },
      {
        $group: {
          _id: '$createdBy',
          sellerName: { $first: '$seller.username' },
          sellerEmail: { $first: '$seller.email' },
          totalSales: { $sum: '$totalSalePrice' },
          totalProfit: { $sum: '$profit' },
          saleCount: { $sum: 1 },
          averageSaleValue: { $avg: '$totalSalePrice' }
        }
      },
      {
        $project: {
          _id: 0,
          sellerId: '$_id',
          sellerName: 1,
          sellerEmail: 1,
          performance: {
            totalSales: '$totalSales',
            totalRevenue: '$totalSales',
            totalProfit: '$totalProfit',
            saleCount: '$saleCount',
            averageSaleValue: { $round: ['$averageSaleValue', 2] },
            profitMargin: {
              $round: [
                { $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] },
                2
              ]
            }
          }
        }
      },
      { $sort: { 'performance.totalProfit': -1 } }
    ]);

    // Add rankings to seller performance
    sellerPerformance.forEach((seller, index) => {
      seller.performance.ranking = index + 1;
    });

    // Get service performance
    const servicePerformance = await Sale.aggregate([
      { $match: matchConditions },
      { $unwind: '$services' },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: '$service' },
      {
        $lookup: {
          from: 'servicetypes',
          localField: 'service.typeId',
          foreignField: '_id',
          as: 'serviceType'
        }
      },
      { $unwind: { path: '$serviceType', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$services.serviceId',
          serviceName: { $first: '$service.destino' },
          serviceType: { $first: { $ifNull: ['$serviceType.name', 'Unknown'] } },
          totalSales: { $sum: { $multiply: ['$services.priceClient', '$services.quantity'] } },
          totalProfit: { 
            $sum: { 
              $multiply: [
                { $subtract: ['$services.priceClient', '$services.costProvider'] }, 
                '$services.quantity'
              ] 
            } 
          },
          saleCount: { $sum: '$services.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          serviceId: '$_id',
          serviceName: 1,
          serviceType: 1,
          performance: {
            totalSales: '$totalSales',
            totalRevenue: '$totalSales',
            totalProfit: '$totalProfit',
            saleCount: '$saleCount',
            averagePrice: { $round: [{ $divide: ['$totalSales', '$saleCount'] }, 2] },
            profitMargin: {
              $round: [
                { $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] },
                2
              ]
            }
          }
        }
      },
      { $sort: { 'performance.totalSales': -1 } }
    ]);

    // Add rankings to service performance
    servicePerformance.forEach((service, index) => {
      service.performance.ranking = index + 1;
    });

    // Get monthly trends (last 12 months)
    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const trendStart = new Date(endDate);
      trendStart.setMonth(trendStart.getMonth() - i);
      trendStart.setDate(1);
      
      const trendEnd = new Date(trendStart);
      trendEnd.setMonth(trendEnd.getMonth() + 1);
      trendEnd.setDate(0);

      const monthMatchConditions = {
        createdAt: {
          $gte: trendStart,
          $lte: trendEnd
        }
      };

      // Add currency filter if specified
      if (currency) {
        monthMatchConditions.saleCurrency = currency.toUpperCase();
      }

      const monthData = await Sale.aggregate([
        {
          $match: monthMatchConditions
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalSalePrice' },
            totalProfit: { $sum: '$profit' },
            saleCount: { $sum: 1 }
          }
        }
      ]);

      const newClients = await Client.countDocuments({
        createdAt: {
          $gte: trendStart,
          $lte: trendEnd
        }
      });

      monthlyTrends.push({
        month: trendStart.toLocaleDateString('en-US', { month: 'short' }),
        year: trendStart.getFullYear(),
        metrics: {
          totalSales: monthData[0]?.totalSales || 0,
          totalRevenue: monthData[0]?.totalSales || 0,
          totalProfit: monthData[0]?.totalProfit || 0,
          saleCount: monthData[0]?.saleCount || 0,
          newClients,
          profitMargin: monthData[0]?.totalSales > 0 
            ? Math.round((monthData[0].totalProfit / monthData[0].totalSales) * 100 * 100) / 100
            : 0
        }
      });
    }

    // Get activity insights
    const activityInsights = await ActivityLog.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalActivities = activityInsights.reduce((sum, activity) => sum + activity.count, 0);

    // Create insights document
    const insights = new this({
      period,
      periodStart: startDate,
      periodEnd: endDate,
      businessMetrics: {
        totalSales: businessMetrics[0]?.totalSales || 0,
        totalRevenue: businessMetrics[0]?.totalSales || 0,
        totalProfit: businessMetrics[0]?.totalProfit || 0,
        saleCount: businessMetrics[0]?.saleCount || 0,
        totalClients: passengerMetrics[0]?.totalPassengers || 0,
        newClients: clientMetrics[0]?.newClients || 0,
        averageSaleValue: businessMetrics[0]?.averageSaleValue || 0,
        profitMargin: businessMetrics[0]?.totalSales > 0 
          ? Math.round((businessMetrics[0].totalProfit / businessMetrics[0].totalSales) * 100 * 100) / 100
          : 0,
        conversionRate: 0 // Would need more complex logic to calculate
      },
      sellerMetrics: sellerPerformance,
      serviceMetrics: servicePerformance,
      providerMetrics: [], // Would need similar aggregation for providers
      monthlyTrends,
      activityInsights: {
        totalActivities,
        salesCreated: activityInsights.find(a => a._id === 'create_sale')?.count || 0,
        paymentsProcessed: activityInsights.find(a => a._id === 'create_payment')?.count || 0,
        clientsAdded: activityInsights.find(a => a._id === 'create_client')?.count || 0,
        servicesAdded: activityInsights.find(a => a._id === 'create_service')?.count || 0,
        mostActiveSeller: null // Would need more complex logic
      },
      systemHealth: {
        uptime: 99.9,
        responseTime: 0,
        errorRate: 0,
        activeUsers: await User.countDocuments({ isActive: true }),
        dataIntegrity: 100
      },
      generatedBy
    });

    await insights.save();
    return insights;

  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
};

module.exports = mongoose.model('AdminInsights', adminInsightsSchema);