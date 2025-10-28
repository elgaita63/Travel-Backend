const mongoose = require('mongoose');
const VendorPayment = require('../models/VendorPayment');
const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Provider = require('../models/Provider');

// POST /api/vendor-payments - Create vendor payment tracking record
const createVendorPayment = async (req, res) => {
  try {
    const { saleId, providerId, paymentId } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!saleId || !providerId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Sale ID, Provider ID, and Payment ID are required'
      });
    }

    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(saleId) || 
        !mongoose.Types.ObjectId.isValid(providerId) || 
        !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    // Check if vendor payment already exists
    const existingVendorPayment = await VendorPayment.findOne({
      saleId,
      providerId,
      paymentId
    });

    if (existingVendorPayment) {
      return res.status(400).json({
        success: false,
        message: 'Vendor payment record already exists for this sale, provider, and payment'
      });
    }

    // Fetch related data
    const [sale, provider, payment] = await Promise.all([
      Sale.findById(saleId).populate([
        { path: 'services.serviceId', select: 'title type' },
        { path: 'services.providerId', select: 'name commissionRate paymentTerms' }
      ]),
      Provider.findById(providerId),
      Payment.findById(paymentId)
    ]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Find the service for this provider in the sale
    const serviceSale = sale.services.find(service => 
      service.providerId._id.toString() === providerId
    );

    if (!serviceSale) {
      return res.status(400).json({
        success: false,
        message: 'Provider is not associated with any service in this sale'
      });
    }

    // Calculate profit (commission disabled)
    const grossRevenue = serviceSale.priceClient * serviceSale.quantity;
    const providerCost = serviceSale.costProvider * serviceSale.quantity;
    const commissionRate = 0; // Commission disabled
    const commissionAmount = 0; // Commission disabled
    const netProfit = grossRevenue - providerCost; // No commission deduction

    // Create vendor payment record
    const vendorPaymentData = {
      saleId,
      providerId,
      paymentId,
      serviceDetails: {
        serviceId: serviceSale.serviceId?._id || null,
        serviceTitle: serviceSale.serviceId?.destino || serviceSale.serviceName || 'Unknown Service',
        serviceType: serviceSale.serviceId?.type || 'Unknown',
        quantity: serviceSale.quantity,
        priceClient: serviceSale.priceClient,
        costProvider: serviceSale.costProvider,
        currency: serviceSale.currency || 'USD'
      },
      paymentDetails: {
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        date: payment.date,
        status: payment.status,
        exchangeRate: payment.exchangeRate,
        baseCurrency: payment.baseCurrency
      },
      commission: {
        rate: commissionRate,
        amount: commissionAmount,
        currency: serviceSale.currency || 'USD'
      },
      profit: {
        grossRevenue,
        providerCost,
        commissionAmount,
        netProfit,
        currency: serviceSale.currency || 'USD'
      },
      paymentTerms: provider.paymentTerms || 'net_30',
      notes: req.body.notes || '',
      createdBy: userId
    };

    const vendorPayment = new VendorPayment(vendorPaymentData);
    await vendorPayment.save();

    // Populate the vendor payment for response
    await vendorPayment.populate([
      { path: 'saleId', select: 'id totalSalePrice' },
      { path: 'providerId', select: 'name type commissionRate paymentTerms' },
      { path: 'paymentId', select: 'amount currency method date status' },
      { path: 'serviceDetails.serviceId', select: 'title type' },
      { path: 'createdBy', select: 'username email' }
    ]);

    // Clear report cache
    // Report cache clearing removed - no caching mechanism in place

    res.status(201).json({
      success: true,
      message: 'Vendor payment record created successfully',
      data: { vendorPayment }
    });

  } catch (error) {
    console.error('Create vendor payment error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating vendor payment record'
    });
  }
};

// GET /api/vendor-payments - Get vendor payments with filtering
const getVendorPayments = async (req, res) => {
  try {
    const { 
      providerId,
      saleId,
      startDate,
      endDate,
      status,
      isOverdue,
      page = 1,
      limit = 10
    } = req.query;
    
    const query = {};
    
    // Add filters
    if (providerId) {
      query.providerId = providerId;
    }
    
    if (saleId) {
      query.saleId = saleId;
    }
    
    if (status) {
      query['paymentDetails.status'] = status;
    }
    
    if (isOverdue !== undefined) {
      query.isOverdue = isOverdue === 'true';
    }
    
    if (startDate || endDate) {
      query['paymentDetails.date'] = {};
      if (startDate) query['paymentDetails.date'].$gte = new Date(startDate);
      if (endDate) query['paymentDetails.date'].$lte = new Date(endDate);
    }

    const vendorPayments = await VendorPayment.find(query)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice createdAt' },
        { path: 'providerId', select: 'name type commissionRate paymentTerms' },
        { path: 'paymentId', select: 'amount currency method date status transactionId' },
        { path: 'serviceDetails.serviceId', select: 'title type' },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ 'paymentDetails.date': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VendorPayment.countDocuments(query);

    res.json({
      success: true,
      data: {
        vendorPayments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get vendor payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching vendor payments'
    });
  }
};

// GET /api/vendor-payments/provider/:providerId - Get vendor payments for a specific provider
const getVendorPaymentsByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { 
      startDate,
      endDate,
      status,
      page = 1,
      limit = 10
    } = req.query;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID format'
      });
    }
    
    const query = { providerId };
    
    // Add filters
    if (status) {
      query['paymentDetails.status'] = status;
    }
    
    if (startDate || endDate) {
      query['paymentDetails.date'] = {};
      if (startDate) query['paymentDetails.date'].$gte = new Date(startDate);
      if (endDate) query['paymentDetails.date'].$lte = new Date(endDate);
    }

    const vendorPayments = await VendorPayment.find(query)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice createdAt clientId' },
        { path: 'saleId.clientId', select: 'name surname email' },
        { path: 'providerId', select: 'name type commissionRate paymentTerms' },
        { path: 'paymentId', select: 'amount currency method date status transactionId' },
        { path: 'serviceDetails.serviceId', select: 'title type' },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ 'paymentDetails.date': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await VendorPayment.countDocuments(query);

    // Get provider totals
    const providerTotals = await VendorPayment.getProviderTotals(providerId, startDate, endDate);

    res.json({
      success: true,
      data: {
        vendorPayments,
        providerTotals,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get vendor payments by provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching vendor payments'
    });
  }
};

// GET /api/vendor-payments/:id - Get vendor payment by ID
const getVendorPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vendorPayment = await VendorPayment.findById(id)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice createdAt clientId' },
        { path: 'saleId.clientId', select: 'name surname email phone' },
        { path: 'providerId', select: 'name type commissionRate paymentTerms contactInfo' },
        { path: 'paymentId', select: 'amount currency method date status transactionId receiptImage' },
        { path: 'serviceDetails.serviceId', select: 'title type description' },
        { path: 'createdBy', select: 'username email' }
      ]);
    
    if (!vendorPayment) {
      return res.status(404).json({
        success: false,
        message: 'Vendor payment not found'
      });
    }

    res.json({
      success: true,
      data: { vendorPayment }
    });

  } catch (error) {
    console.error('Get vendor payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching vendor payment'
    });
  }
};

// PUT /api/vendor-payments/:id - Update vendor payment
const updateVendorPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const vendorPayment = await VendorPayment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'saleId', select: 'id totalSalePrice' },
      { path: 'providerId', select: 'name type commissionRate paymentTerms' },
      { path: 'paymentId', select: 'amount currency method date status' },
      { path: 'serviceDetails.serviceId', select: 'title type' },
      { path: 'createdBy', select: 'username email' }
    ]);

    if (!vendorPayment) {
      return res.status(404).json({
        success: false,
        message: 'Vendor payment not found'
      });
    }

    // Clear report cache
    // Report cache clearing removed - no caching mechanism in place

    res.json({
      success: true,
      message: 'Vendor payment updated successfully',
      data: { vendorPayment }
    });

  } catch (error) {
    console.error('Update vendor payment error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating vendor payment'
    });
  }
};

// DELETE /api/vendor-payments/:id - Delete vendor payment
const deleteVendorPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const vendorPayment = await VendorPayment.findByIdAndDelete(id);

    if (!vendorPayment) {
      return res.status(404).json({
        success: false,
        message: 'Vendor payment not found'
      });
    }

    // Clear report cache
    // Report cache clearing removed - no caching mechanism in place

    res.json({
      success: true,
      message: 'Vendor payment deleted successfully'
    });

  } catch (error) {
    console.error('Delete vendor payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting vendor payment'
    });
  }
};

// GET /api/vendor-payments/provider/:providerId/summary - Get provider payment summary
const getProviderPaymentSummary = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID format'
      });
    }

    // Build match conditions for date filtering
    const matchConditions = {
      'services.providerId': new mongoose.Types.ObjectId(providerId)
    };

    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
      if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }

    console.log(`🔍 [BACKEND] Fetching provider data for providerId: ${providerId}`);
    console.log(`📅 [BACKEND] Date filters: startDate=${startDate}, endDate=${endDate}`);
    console.log(`🔍 [BACKEND] Match conditions:`, JSON.stringify(matchConditions, null, 2));

    // Aggregate data from sales table for this provider
    const salesAggregation = await Sale.aggregate([
      { $match: matchConditions },
      { $unwind: '$services' },
      { $match: { 'services.providerId': new mongoose.Types.ObjectId(providerId) } },
      {
        $lookup: {
          from: 'providers',
          localField: 'services.providerId',
          foreignField: '_id',
          as: 'provider'
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'saleId',
          as: 'clientPayments'
        }
      },
      {
        $lookup: {
          from: 'payments',
          let: { saleId: '$_id', providerId: '$services.providerId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$saleId', '$$saleId'] }, { $eq: ['$type', 'provider'] }] } } }
          ],
          as: 'providerPayments'
        }
      },
      {
        $project: {
          saleId: '$_id',
          saleNumber: '$saleNumber',
          createdAt: 1,
          totalSalePrice: 1,
          services: 1,
          provider: { $arrayElemAt: ['$provider', 0] },
          service: { $arrayElemAt: ['$service', 0] },
          clientPayments: 1,
          providerPayments: 1,
          // Calculate provider-specific revenue and costs
          providerRevenue: { $multiply: ['$services.priceClient', '$services.quantity'] },
          providerCost: { $multiply: ['$services.costProvider', '$services.quantity'] },
          providerCommission: 0 // Commission disabled
        }
      }
    ]);

    console.log(`📊 [BACKEND] Found ${salesAggregation.length} sales for this provider`);
    console.log(`📊 [BACKEND] Sales aggregation result:`, JSON.stringify(salesAggregation.slice(0, 2), null, 2));

    // Calculate totals
    const providerTotals = {
      totalPayments: 0,      // Total cost owed to provider (what should be paid)
      totalCommissions: 0,   // Total commissions earned
      totalProfit: 0,        // Net profit (revenue - cost)
      totalRevenue: 0,       // Total revenue from this provider
      totalCost: 0,          // Total cost to provider
      overduePayments: 0,    // Overdue payment amounts
      overdueCount: 0,       // Number of overdue payments
      paymentCount: 0        // Number of sales
    };

    // Process each sale for this provider
    salesAggregation.forEach(sale => {
      providerTotals.totalRevenue += sale.providerRevenue || 0;
      providerTotals.totalCost += sale.providerCost || 0;
      providerTotals.totalCommissions += sale.providerCommission || 0;
      // Net profit = revenue - cost (commission is already deducted from revenue)
      providerTotals.totalProfit += (sale.providerRevenue || 0) - (sale.providerCost || 0);
      providerTotals.paymentCount += 1;

      // Calculate total payments - this should be the total cost owed to the provider, not just completed payments
      // The total cost is what should be displayed as "Total Payments" in the vendor dashboard
      console.log(`💰 [BACKEND] Sale ${sale.saleId} provider cost: $${sale.providerCost}`);
      providerTotals.totalPayments += sale.providerCost || 0;

      // Track actual payments made TO the provider separately for overdue calculations
      console.log(`💰 [BACKEND] Sale ${sale.saleId} has ${sale.providerPayments.length} provider payments:`, sale.providerPayments);
      let totalPaidToProvider = 0;
      sale.providerPayments.forEach(payment => {
        if (payment.status === 'completed') {
          console.log(`💰 [BACKEND] Adding completed provider payment: $${payment.amount} (status: ${payment.status})`);
          totalPaidToProvider += payment.amount || 0;
        } else {
          console.log(`💰 [BACKEND] Skipping provider payment: $${payment.amount} (status: ${payment.status})`);
        }
      });

      // Check for overdue payments - compare what's owed vs what's been paid
      const paymentTerms = sale.provider?.paymentTerms || 'net_30';
      const daysToAdd = paymentTerms === 'net_30' ? 30 : paymentTerms === 'net_15' ? 15 : paymentTerms === 'net_45' ? 45 : paymentTerms === 'net_60' ? 60 : 30;
      const dueDate = new Date(sale.createdAt.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
      const isOverdue = new Date() > dueDate && totalPaidToProvider < (sale.providerCost || 0);

      if (isOverdue) {
        const unpaidAmount = (sale.providerCost || 0) - totalPaidToProvider;
        providerTotals.overduePayments += unpaidAmount;
        providerTotals.overdueCount += 1;
        console.log(`⚠️ [BACKEND] Overdue payment: $${unpaidAmount} (total cost: $${sale.providerCost}, paid: $${totalPaidToProvider})`);
      }
    });

    // Format recent payments from client payments
    const recentPayments = [];
    salesAggregation.slice(0, 5).forEach(sale => {
      sale.clientPayments.forEach(payment => {
        if (payment.type === 'client') {
          recentPayments.push({
            _id: payment._id,
            saleId: { id: sale.saleNumber || sale.saleId },
            serviceDetails: {
              serviceTitle: sale.service?.destino || 'Unknown Service'
            },
            paymentDetails: {
              amount: payment.amount,
              currency: payment.currency,
              method: payment.method,
              date: payment.date,
              status: payment.status
            }
          });
        }
      });
    });

    // Sort recent payments by date
    recentPayments.sort((a, b) => new Date(b.paymentDetails.date) - new Date(a.paymentDetails.date));

    // Create payment history from sales data
    const paymentHistory = salesAggregation.map(sale => {
      const grossRevenue = sale.providerRevenue || 0;
      const providerCost = sale.providerCost || 0;
      const commission = sale.providerCommission || 0;
      const netProfit = grossRevenue - providerCost - commission;
      
      console.log(`📊 [BACKEND] Sale ${sale.saleId}: revenue=${grossRevenue}, cost=${providerCost}, commission=${commission}, profit=${netProfit}`);
      
      return {
        _id: sale.saleId,
        saleId: { id: sale.saleNumber || sale.saleId },
        serviceDetails: {
          serviceTitle: sale.service?.destino || 'Unknown Service',
          quantity: sale.services.quantity
        },
        profit: {
          grossRevenue: grossRevenue,
          providerCost: providerCost,
          netProfit: netProfit,
          currency: sale.services.currency || 'USD'
        },
        commission: {
          amount: commission,
          rate: sale.provider?.commissionRate || 0,
          currency: sale.services.currency || 'USD'
        },
        paymentDetails: {
          status: sale.providerPayments.length > 0 ? 'completed' : 'pending'
        },
        dueDate: new Date(sale.createdAt.getTime() + ((sale.provider?.paymentTerms === 'net_30' ? 30 : 15) * 24 * 60 * 60 * 1000)),
        isOverdue: new Date() > new Date(sale.createdAt.getTime() + (30 * 24 * 60 * 60 * 1000)) && sale.providerPayments.length === 0,
        daysOverdue: sale.providerPayments.length === 0 ? Math.max(0, Math.floor((new Date() - sale.createdAt) / (1000 * 60 * 60 * 24)) - 30) : 0
      };
    });

    console.log(`💰 [BACKEND] Provider totals calculated:`, JSON.stringify(providerTotals, null, 2));
    console.log(`📋 [BACKEND] Recent payments count: ${recentPayments.length}`);
    console.log(`📋 [BACKEND] Payment history count: ${paymentHistory.length}`);

    res.json({
      success: true,
      data: {
        providerTotals,
        recentPayments: recentPayments.slice(0, 5),
        overduePayments: paymentHistory.filter(p => p.isOverdue),
        vendorPayments: paymentHistory
      }
    });

  } catch (error) {
    console.error('Get provider payment summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching provider payment summary'
    });
  }
};

module.exports = {
  createVendorPayment,
  getVendorPayments,
  getVendorPaymentsByProvider,
  getVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  getProviderPaymentSummary
};