const AdminInsights = require('../models/AdminInsights');
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Provider = require('../models/Provider');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');  

// GET /api/admin-insights/overview - Get comprehensive admin overview
const getAdminOverview = async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate, currency } = req.query;
    
    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      // Default to current period
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Get or generate insights for this period
    let insights = await AdminInsights.findOne({
      period,
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
      isActive: true
    }).sort({ generatedAt: -1 });

    if (!insights) {
      // Generate new insights
      insights = await AdminInsights.generateInsights(
        period, 
        periodStart, 
        periodEnd, 
        req.user.id,
        currency
      );
    }

    res.json({
      success: true,
      data: {
        insights,
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        }
      }
    });

  } catch (error) {
    console.error('Get admin overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching admin overview'
    });
  }
};

// GET /api/admin-insights/seller-performance - Get detailed seller performance
const getSellerPerformance = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      startDate, 
      endDate, 
      sellerId, 
      includeHistory = false,
      limit = 50,
      currency
    } = req.query;

    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Build match conditions
    const matchConditions = {
      createdAt: {
        $gte: periodStart,
        $lte: periodEnd
      }
    };

    if (sellerId) {
      matchConditions.createdBy = sellerId;
    }

    if (currency) {
      matchConditions.saleCurrency = currency.toUpperCase();
    }

    // Get seller performance data
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
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$createdBy',
          sellerId: { $first: '$createdBy' },
          sellerName: { $first: '$seller.username' },
          sellerEmail: { $first: '$seller.email' },
          sellerRole: { $first: '$seller.role' },
          totalSales: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          saleCount: { $sum: 1 },
          averageSaleValue: { $avg: '$totalSalePrice' },
          averageProfit: { $avg: '$profit' },
          clientCount: { $addToSet: '$clientId' },
          serviceCount: { $sum: { $size: '$services' } }
        }
      },
      {
        $project: {
          _id: 0,
          sellerId: 1,
          sellerName: 1,
          sellerEmail: 1,
          sellerRole: 1,
          performance: {
            totalSales: '$totalSales',
            totalRevenue: '$totalSales',
            totalCost: '$totalCost',
            totalProfit: '$totalProfit',
            saleCount: '$saleCount',
            averageSaleValue: { $round: ['$averageSaleValue', 2] },
            averageProfit: { $round: ['$averageProfit', 2] },
            profitMargin: {
              $round: [
                { $multiply: [{ $divide: ['$totalProfit', '$totalSales'] }, 100] },
                2
              ]
            },
            clientCount: { $size: '$clientCount' },
            serviceCount: '$serviceCount'
          }
        }
      },
      { $sort: { 'performance.totalProfit': -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Add rankings
    sellerPerformance.forEach((seller, index) => {
      seller.performance.ranking = index + 1;
    });

    // Get historical data if requested
    let historicalData = [];
    if (includeHistory === 'true') {
      historicalData = await AdminInsights.getSellerPerformanceHistory(
        sellerId, 
        period, 
        12
      );
    }

    // Get activity data for sellers
    const activityData = await ActivityLog.aggregate([
      {
        $match: {
          userId: { $in: sellerPerformance.map(s => s.sellerId) },
          timestamp: {
            $gte: periodStart,
            $lte: periodEnd
          }
        }
      },
      {
        $group: {
          _id: '$userId',
          activityCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      }
    ]);

    // Merge activity data with seller performance
    sellerPerformance.forEach(seller => {
      const activity = activityData.find(a => a._id.toString() === seller.sellerId.toString());
      seller.activity = {
        count: activity?.activityCount || 0,
        lastActivity: activity?.lastActivity || null
      };
    });

    res.json({
      success: true,
      data: {
        sellers: sellerPerformance,
        historicalData,
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        },
        summary: {
          totalSellers: sellerPerformance.length,
          topPerformer: sellerPerformance[0] || null,
          totalRevenue: sellerPerformance.reduce((sum, s) => sum + s.performance.totalSales, 0),
          totalProfit: sellerPerformance.reduce((sum, s) => sum + s.performance.totalProfit, 0)
        }
      }
    });

  } catch (error) {
    console.error('Get seller performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching seller performance'
    });
  }
};

// GET /api/admin-insights/transaction-details - Get detailed transaction data
const getTransactionDetails = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      startDate, 
      endDate, 
      sellerId, 
      serviceId, 
      clientId,
      status,
      minAmount,
      maxAmount,
      currency,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Build match conditions
    const matchConditions = {
      createdAt: {
        $gte: periodStart,
        $lte: periodEnd
      }
    };

    if (sellerId) matchConditions.createdBy = sellerId;
    if (clientId) matchConditions.clientId = clientId;
    if (status) matchConditions.status = status;
    if (currency) matchConditions.saleCurrency = currency.toUpperCase();
    if (minAmount) matchConditions.totalSalePrice = { $gte: parseFloat(minAmount) };
    if (maxAmount) {
      matchConditions.totalSalePrice = {
        ...matchConditions.totalSalePrice,
        $lte: parseFloat(maxAmount)
      };
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      },
      {
        $project: {
          _id: 1,
          saleId: { $toString: '$_id' },
          clientName: { 
            $concat: [
              { $arrayElemAt: ['$client.name', 0] },
              ' ',
              { $arrayElemAt: ['$client.surname', 0] }
            ]
          },
          clientEmail: { $arrayElemAt: ['$client.email', 0] },
          sellerName: { $arrayElemAt: ['$seller.username', 0] },
          sellerEmail: { $arrayElemAt: ['$seller.email', 0] },
          totalSalePrice: 1,
          totalCost: 1,
          profit: 1,
          profitMargin: {
            $round: [
              { $multiply: [{ $divide: ['$profit', '$totalSalePrice'] }, 100] },
              2
            ]
          },
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          services: {
            $map: {
              input: '$services',
              as: 'service',
              in: {
                serviceName: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$serviceDetails',
                        cond: { $eq: ['$$this._id', '$$service.serviceId'] }
                      }
                    },
                    0
                  ]
                },
                quantity: '$$service.quantity',
                priceClient: '$$service.priceClient',
                costProvider: '$$service.costProvider',
                totalPrice: { $multiply: ['$$service.priceClient', '$$service.quantity'] },
                totalCost: { $multiply: ['$$service.costProvider', '$$service.quantity'] }
              }
            }
          },
          passengerCount: { $size: '$passengers' },
          serviceCount: { $size: '$services' }
        }
      },
      {
        $sort: {
          [sortBy]: sortOrder === 'desc' ? -1 : 1
        }
      },
      {
        $facet: {
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ];

    // Filter by service if specified
    if (serviceId) {
      // Add service filter to the match stage
      if (pipeline[0].$match) {
        pipeline[0].$match['services.serviceId'] = serviceId;
      } else {
        // If no match stage exists, add one
        pipeline.unshift({ $match: { 'services.serviceId': serviceId } });
      }
    }

    console.log('Executing aggregation pipeline for transaction details...');
    console.log('Pipeline:', JSON.stringify(pipeline, null, 2));
    
    let result;
    try {
      result = await Sale.aggregate(pipeline);
      console.log('Aggregation result:', JSON.stringify(result, null, 2));
    } catch (aggregationError) {
      console.error('Aggregation error:', aggregationError);
      return res.status(500).json({
        success: false,
        message: 'Database aggregation error',
        error: aggregationError.message
      });
    }
    
    if (!result || result.length === 0) {
      console.error('No results returned from aggregation pipeline');
      return res.status(500).json({
        success: false,
        message: 'No data returned from database query'
      });
    }
    
    const transactions = result[0].data || [];
    const totalCount = result[0].totalCount?.[0]?.count || 0;

    // Get summary statistics
    console.log('Executing summary statistics aggregation...');
    let summaryStats;
    try {
      summaryStats = await Sale.aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalRevenue: { $sum: '$totalSalePrice' },
            totalCost: { $sum: '$totalCost' },
            totalProfit: { $sum: '$profit' },
            averageTransactionValue: { $avg: '$totalSalePrice' },
            averageProfit: { $avg: '$profit' }
          }
        }
      ]);
      console.log('Summary stats result:', JSON.stringify(summaryStats, null, 2));
    } catch (summaryError) {
      console.error('Summary statistics error:', summaryError);
      return res.status(500).json({
        success: false,
        message: 'Database summary statistics error',
        error: summaryError.message
      });
    }

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        summary: summaryStats[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          averageTransactionValue: 0,
          averageProfit: 0
        },
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        }
      }
    });

  } catch (error) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching transaction details'
    });
  }
};

// GET /api/admin-insights/monthly-trends - Get monthly performance trends
const getMonthlyTrends = async (req, res) => {
  try {
    const { months = 12, sellerId, currency } = req.query;

    const trends = [];
    const currentDate = new Date();

    for (let i = parseInt(months) - 1; i >= 0; i--) {
      const monthStart = new Date(currentDate);
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      const matchConditions = {
        createdAt: {
          $gte: monthStart,
          $lte: monthEnd
        }
      };

      if (sellerId) {
        matchConditions.createdBy = sellerId;
      }

      if (currency) {
        matchConditions.saleCurrency = currency.toUpperCase();
      }

      const monthData = await Sale.aggregate([
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

      const newClients = await Client.countDocuments({
        createdAt: {
          $gte: monthStart,
          $lte: monthEnd
        }
      });

      trends.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        year: monthStart.getFullYear(),
        monthNumber: monthStart.getMonth() + 1,
        period: {
          start: monthStart,
          end: monthEnd
        },
        metrics: {
          totalSales: monthData[0]?.totalSales || 0,
          totalRevenue: monthData[0]?.totalSales || 0,
          totalProfit: monthData[0]?.totalProfit || 0,
          saleCount: monthData[0]?.saleCount || 0,
          newClients,
          averageSaleValue: monthData[0]?.averageSaleValue || 0,
          profitMargin: monthData[0]?.totalSales > 0 
            ? Math.round((monthData[0].totalProfit / monthData[0].totalSales) * 100 * 100) / 100
            : 0
        }
      });
    }

    res.json({
      success: true,
      data: {
        trends,
        summary: {
          totalMonths: trends.length,
          totalRevenue: trends.reduce((sum, t) => sum + t.metrics.totalRevenue, 0),
          totalProfit: trends.reduce((sum, t) => sum + t.metrics.totalProfit, 0),
          totalSales: trends.reduce((sum, t) => sum + t.metrics.saleCount, 0),
          averageMonthlyRevenue: trends.length > 0 
            ? trends.reduce((sum, t) => sum + t.metrics.totalRevenue, 0) / trends.length 
            : 0,
          averageMonthlyProfit: trends.length > 0 
            ? trends.reduce((sum, t) => sum + t.metrics.totalProfit, 0) / trends.length 
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Get monthly trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching monthly trends'
    });
  }
};

// GET /api/admin-insights/export - Export insights data
const exportInsights = async (req, res) => {
  try {
    const { 
      type = 'seller-performance', 
      period = 'monthly', 
      startDate, 
      endDate, 
      format = 'csv' 
    } = req.query;

    let data;
    let filename;

    switch (type) {
      case 'seller-performance':
        const sellerRes = await getSellerPerformance(req, res);
        data = sellerRes.data.sellers;
        filename = `seller-performance-${period}-${new Date().toISOString().split('T')[0]}`;
        break;
      
      case 'transaction-details':
        const transactionRes = await getTransactionDetails(req, res);
        data = transactionRes.data.transactions;
        filename = `transaction-details-${period}-${new Date().toISOString().split('T')[0]}`;
        break;
      
      case 'monthly-trends':
        const trendsRes = await getMonthlyTrends(req, res);
        data = trendsRes.data.trends;
        filename = `monthly-trends-${period}-${new Date().toISOString().split('T')[0]}`;
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json({
        success: true,
        data,
        exportedAt: new Date(),
        type,
        period
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid format. Use csv or json.'
      });
    }

  } catch (error) {
    console.error('Export insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while exporting insights'
    });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

// POST /api/admin-insights/generate - Manually generate insights
const generateInsights = async (req, res) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const insights = await AdminInsights.generateInsights(
      period,
      new Date(startDate),
      new Date(endDate),
      req.user.id
    );

    // Clear cache
    // Report cache clearing removed - no caching mechanism in place

    res.json({
      success: true,
      message: 'Insights generated successfully',
      data: { insights }
    });

  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while generating insights'
    });
  }
};

// GET /api/admin-insights/payments - Get comprehensive payment analytics
const getPaymentAnalytics = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      startDate, 
      endDate, 
      paymentType, 
      paymentMethod,
      currency,
      status = 'completed',
      page = 1,
      limit = 20
    } = req.query;

    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Build match conditions
    const matchConditions = {
      date: {
        $gte: periodStart,
        $lte: periodEnd
      }
    };

    if (paymentType) matchConditions.type = paymentType;
    if (paymentMethod) {
      // Use case-insensitive matching for payment method
      matchConditions.method = { $regex: new RegExp(`^${paymentMethod}$`, 'i') };
    }
    if (currency) matchConditions.currency = currency.toUpperCase();
    if (status) matchConditions.status = status;

    // Get payment analytics
    const paymentAnalytics = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clients',
          localField: 'sale.clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            paymentType: '$type',
            paymentMethod: '$method',
            currency: '$currency'
          },
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          sales: { $addToSet: '$saleId' },
          sellers: { $addToSet: '$seller._id' },
          clients: { $addToSet: '$client._id' }
        }
      },
      {
        $project: {
          _id: 0,
          paymentType: '$_id.paymentType',
          paymentMethod: '$_id.paymentMethod',
          currency: '$_id.currency',
          totalAmount: { $round: ['$totalAmount', 2] },
          paymentCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          uniqueSales: { $size: '$sales' },
          uniqueSellers: { $size: '$sellers' },
          uniqueClients: { $size: '$clients' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get detailed payment records for pagination
    const detailedPayments = await Payment.find(matchConditions)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice status createdAt' },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalPayments = await Payment.countDocuments(matchConditions);

    // Get summary statistics
    const summaryStats = await Payment.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          clientPayments: {
            $sum: { $cond: [{ $eq: ['$type', 'client'] }, '$amount', 0] }
          },
          providerPayments: {
            $sum: { $cond: [{ $eq: ['$type', 'provider'] }, '$amount', 0] }
          },
          clientPaymentCount: {
            $sum: { $cond: [{ $eq: ['$type', 'client'] }, 1, 0] }
          },
          providerPaymentCount: {
            $sum: { $cond: [{ $eq: ['$type', 'provider'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        analytics: paymentAnalytics,
        payments: detailedPayments,
        summary: summaryStats[0] || {
          totalAmount: 0,
          totalPayments: 0,
          averageAmount: 0,
          clientPayments: 0,
          providerPayments: 0,
          clientPaymentCount: 0,
          providerPaymentCount: 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount: totalPayments,
          totalPages: Math.ceil(totalPayments / parseInt(limit))
        },
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        }
      }
    });

  } catch (error) {
    console.error('Get payment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching payment analytics'
    });
  }
};

// GET /api/admin-insights/customer-payments - Get customer payments with payment method filtering
const getCustomerPayments = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      startDate, 
      endDate, 
      paymentMethod,
      currency,
      status = 'completed',
      sellerId,
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Build match conditions for client payments only
    const matchConditions = {
      type: 'client',
      date: {
        $gte: periodStart,
        $lte: periodEnd
      }
    };

    if (paymentMethod) {
      // Use case-insensitive matching for payment method
      matchConditions.method = { $regex: new RegExp(`^${paymentMethod}$`, 'i') };
    }
    if (currency) matchConditions.currency = currency.toUpperCase();
    if (status) matchConditions.status = status;

    // Get customer payments with detailed information
    const customerPayments = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clients',
          localField: 'sale.clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $match: sellerId ? { 'seller._id': new mongoose.Types.ObjectId(sellerId) } : {}
      },
      {
        $project: {
          _id: 1,
          paymentId: { $toString: '$_id' },
          amount: 1,
          currency: 1,
          method: 1,
          date: 1,
          status: 1,
          transactionId: 1,
          reference: 1,
          saleId: '$sale._id',
          saleTotal: '$sale.totalSalePrice',
          saleStatus: '$sale.status',
          saleCreatedAt: '$sale.createdAt',
          sellerName: '$seller.username',
          sellerEmail: '$seller.email',
          clientName: { $concat: ['$client.name', ' ', '$client.surname'] },
          clientEmail: '$client.email',
          clientPhone: '$client.phone'
        }
      },
      {
        $sort: {
          [sortBy]: sortOrder === 'desc' ? -1 : 1
        }
      },
      {
        $facet: {
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ]);

    const payments = customerPayments[0].data;
    const totalCount = customerPayments[0].totalCount[0]?.count || 0;

    // Get summary statistics for customer payments
    const summaryStats = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $match: sellerId ? { 'seller._id': new mongoose.Types.ObjectId(sellerId) } : {}
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          uniqueCustomers: { $addToSet: '$sale.clientId' },
          uniqueSellers: { $addToSet: '$seller._id' },
          uniqueSales: { $addToSet: '$saleId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalPayments: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          uniqueCustomers: { $size: '$uniqueCustomers' },
          uniqueSellers: { $size: '$uniqueSellers' },
          uniqueSales: { $size: '$uniqueSales' }
        }
      }
    ]);

    // Get payment method breakdown
    const methodBreakdown = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $match: sellerId ? { 'seller._id': new mongoose.Types.ObjectId(sellerId) } : {}
      },
      {
        $group: {
          _id: '$method',
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $project: {
          _id: 0,
          method: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          paymentCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        payments,
        summary: summaryStats[0] || {
          totalAmount: 0,
          totalPayments: 0,
          averageAmount: 0,
          uniqueCustomers: 0,
          uniqueSellers: 0,
          uniqueSales: 0
        },
        methodBreakdown,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        }
      }
    });

  } catch (error) {
    console.error('Get customer payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching customer payments'
    });
  }
};

// GET /api/admin-insights/supplier-payments - Get supplier payments with filtering
const getSupplierPayments = async (req, res) => {
  try {
    const { 
      period = 'monthly', 
      startDate, 
      endDate, 
      paymentMethod,
      currency,
      status = 'completed',
      providerId,
      page = 1,
      limit = 20,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Get date range
    let periodStart, periodEnd;
    if (startDate && endDate) {
      periodStart = new Date(startDate);
      periodEnd = new Date(endDate);
    } else {
      periodEnd = new Date();
      periodStart = new Date();
      
      switch (period) {
        case 'daily':
          periodStart.setHours(0, 0, 0, 0);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          periodStart.setDate(periodStart.getDate() - 7);
          break;
        case 'monthly':
          periodStart.setMonth(periodStart.getMonth() - 1);
          break;
        case 'quarterly':
          periodStart.setMonth(periodStart.getMonth() - 3);
          break;
        case 'yearly':
          periodStart.setFullYear(periodStart.getFullYear() - 1);
          break;
      }
    }

    // Build match conditions for provider payments only
    const matchConditions = {
      type: 'provider',
      date: {
        $gte: periodStart,
        $lte: periodEnd
      }
    };

    if (paymentMethod) {
      // Use case-insensitive matching for payment method
      matchConditions.method = { $regex: new RegExp(`^${paymentMethod}$`, 'i') };
    }
    if (currency) matchConditions.currency = currency.toUpperCase();
    if (status) matchConditions.status = status;

    // Get supplier payments with detailed information
    const supplierPayments = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'clients',
          localField: 'sale.clientId',
          foreignField: '_id',
          as: 'client'
        }
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $match: providerId ? { 'sale.services.providerId': new mongoose.Types.ObjectId(providerId) } : {}
      },
      {
        $project: {
          _id: 1,
          paymentId: { $toString: '$_id' },
          amount: 1,
          currency: 1,
          method: 1,
          date: 1,
          status: 1,
          transactionId: 1,
          reference: 1,
          saleId: '$sale._id',
          saleTotal: '$sale.totalSalePrice',
          saleStatus: '$sale.status',
          saleCreatedAt: '$sale.createdAt',
          sellerName: '$seller.username',
          sellerEmail: '$seller.email',
          clientName: { $concat: ['$client.name', ' ', '$client.surname'] },
          clientEmail: '$client.email',
          clientPhone: '$client.phone'
        }
      },
      {
        $sort: {
          [sortBy]: sortOrder === 'desc' ? -1 : 1
        }
      },
      {
        $facet: {
          data: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ]);

    const payments = supplierPayments[0].data;
    const totalCount = supplierPayments[0].totalCount[0]?.count || 0;

    // Get summary statistics for supplier payments
    const summaryStats = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $match: providerId ? { 'sale.services.providerId': new mongoose.Types.ObjectId(providerId) } : {}
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          averageAmount: { $avg: '$amount' },
          uniqueSuppliers: { $addToSet: '$sale.services.providerId' },
          uniqueSellers: { $addToSet: '$seller._id' },
          uniqueSales: { $addToSet: '$saleId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalPayments: 1,
          averageAmount: { $round: ['$averageAmount', 2] },
          uniqueSuppliers: { $size: '$uniqueSuppliers' },
          uniqueSellers: { $size: '$uniqueSellers' },
          uniqueSales: { $size: '$uniqueSales' }
        }
      }
    ]);

    // Get payment method breakdown for suppliers
    const methodBreakdown = await Payment.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: '_id',
          as: 'sale'
        }
      },
      { $unwind: { path: '$sale', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'sale.createdBy',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $match: providerId ? { 'sale.services.providerId': new mongoose.Types.ObjectId(providerId) } : {}
      },
      {
        $group: {
          _id: '$method',
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      },
      {
        $project: {
          _id: 0,
          method: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          paymentCount: 1,
          averageAmount: { $round: ['$averageAmount', 2] }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        payments,
        summary: summaryStats[0] || {
          totalAmount: 0,
          totalPayments: 0,
          averageAmount: 0,
          uniqueSuppliers: 0,
          uniqueSellers: 0,
          uniqueSales: 0
        },
        methodBreakdown,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        period: {
          type: period,
          start: periodStart,
          end: periodEnd
        }
      }
    });

  } catch (error) {
    console.error('Get supplier payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching supplier payments'
    });
  }
};

module.exports = {
  getAdminOverview,
  getSellerPerformance,
  getTransactionDetails,
  getMonthlyTrends,
  exportInsights,
  generateInsights,
  getPaymentAnalytics,
  getCustomerPayments,
  getSupplierPayments
};