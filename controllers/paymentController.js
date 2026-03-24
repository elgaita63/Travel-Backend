const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Provider = require('../models/Provider');
const VendorPayment = require('../models/VendorPayment');
const currencyService = require('../services/currencyService');

// Helper function to calculate due date based on payment terms
const calculateDueDate = (paymentDate, paymentTerms) => {
  const date = new Date(paymentDate);
  let daysToAdd = 0;
  
  switch (paymentTerms) {
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
  
  return new Date(date.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
};

// POST /api/payments/client - Record client payment
const recordClientPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    const requiredFields = ['saleId', 'method', 'amount', 'currency'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate sale exists
    const sale = await Sale.findById(paymentData.saleId);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Handle exchange rate and currency conversion
    let exchangeRate = null;
    let baseCurrency = null;
    let convertedAmount = paymentData.amount;
    let convertedCurrency = paymentData.currency;
    
    // Store original values for reference
    const originalAmount = paymentData.amount;
    const originalCurrency = paymentData.currency;
    
    // Check if currency conversion is needed
    if (paymentData.originalCurrency && paymentData.originalCurrency !== sale.saleCurrency) {
      if (!paymentData.exchangeRate) {
        return res.status(400).json({
          success: false,
          message: `Exchange rate is required to convert ${paymentData.originalCurrency} to ${sale.saleCurrency}`
        });
      }
      
      exchangeRate = parseFloat(paymentData.exchangeRate);
      baseCurrency = sale.saleCurrency;
      
      // Convert amount based on sale currency
      if (sale.saleCurrency === 'USD') {
        convertedAmount = originalAmount / exchangeRate;
        convertedCurrency = 'USD';
      } else if (sale.saleCurrency === 'ARS') {
        convertedAmount = originalAmount * exchangeRate;
        convertedCurrency = 'ARS';
      }
    }

    // Create payment with converted values as primary
    const payment = new Payment({
      ...paymentData,
      amount: convertedAmount,
      currency: convertedCurrency,
      originalAmount,
      originalCurrency,
      type: 'client',
      paymentTo: paymentData.paymentTo || null, // Habilitado para destinatario (Agencia o Proveedor)
      createdBy: userId,
      exchangeRate,
      baseCurrency,
      receiptImage: req.file ? `/uploads/payments/${req.file.filename}` : null
    });

    await payment.save();

    // Update sale with new payment
    sale.paymentsClient.push({ paymentId: payment.id });
    sale.totalClientPayments = Number(sale.totalClientPayments) + Number(convertedAmount);
    
    // Recalculate balances
    sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
    sale.providerBalance = sale.totalProviderPayments - sale.totalCost;
    
    await sale.save();
    
    // Check and update sale status based on new balance
    const statusUpdate = await sale.checkAndUpdateStatus();
    if (statusUpdate.statusChanged) {
      console.log(`Sale status automatically updated: ${statusUpdate.previousStatus} → ${statusUpdate.newStatus}`);
    }

    // Populate payment for response
    await payment.populate([
      { path: 'saleId', select: 'id totalSalePrice totalCost' },
      { path: 'paymentTo', select: 'name' },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Passenger payment recorded successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Record passenger payment error:', error);
    
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
      message: 'Internal server error while recording passenger payment'
    });
  }
};

// POST /api/payments/provider - Record provider payment
const recordProviderPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    const requiredFields = ['saleId', 'method', 'amount', 'currency'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate sale exists
    const sale = await Sale.findById(paymentData.saleId);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Handle exchange rate and currency conversion
    let exchangeRate = null;
    let baseCurrency = null;
    let convertedAmount = paymentData.amount;
    let convertedCurrency = paymentData.currency;
    
    // Store original values for reference
    const originalAmount = paymentData.amount;
    const originalCurrency = paymentData.currency;
    
    // Check if currency conversion is needed
    if (paymentData.originalCurrency && paymentData.originalCurrency !== sale.saleCurrency) {
      if (!paymentData.exchangeRate) {
        return res.status(400).json({
          success: false,
          message: `Exchange rate is required to convert ${paymentData.originalCurrency} to ${sale.saleCurrency}`
        });
      }
      
      exchangeRate = parseFloat(paymentData.exchangeRate);
      baseCurrency = sale.saleCurrency;
      
      // Convert amount based on sale currency
      if (sale.saleCurrency === 'USD') {
        convertedAmount = originalAmount / exchangeRate;
        convertedCurrency = 'USD';
      } else if (sale.saleCurrency === 'ARS') {
        convertedAmount = originalAmount * exchangeRate;
        convertedCurrency = 'ARS';
      }
    }

    // Create payment with converted values as primary
    const payment = new Payment({
      ...paymentData,
      amount: convertedAmount,
      currency: convertedCurrency,
      originalAmount,
      originalCurrency,
      type: 'provider',
      paymentTo: paymentData.paymentTo || null, // Destinatario del pago de la agencia
      createdBy: userId,
      exchangeRate,
      baseCurrency,
      receiptImage: req.file ? `/uploads/payments/${req.file.filename}` : null
    });

    await payment.save();

    // Update sale with new payment
    sale.paymentsProvider.push({ paymentId: payment.id });
    sale.totalProviderPayments = Number(sale.totalProviderPayments) + Number(convertedAmount);
    
    // Recalculate balances
    sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
    sale.providerBalance = sale.totalProviderPayments - sale.totalCost;
    
    await sale.save();
    
    // Check and update sale status based on new balance
    const statusUpdate = await sale.checkAndUpdateStatus();
    if (statusUpdate.statusChanged) {
      console.log(`Sale status automatically updated: ${statusUpdate.previousStatus} → ${statusUpdate.newStatus}`);
    }

    // Create vendor payment tracking records for each provider in the sale
    await createVendorPaymentRecords(sale, payment, userId);

    // Populate payment for response
    await payment.populate([
      { path: 'saleId', select: 'id totalSalePrice totalCost' },
      { path: 'paymentTo', select: 'name' },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Provider payment recorded successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Record provider payment error:', error);
    
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
      message: 'Internal server error while recording provider payment'
    });
  }
};

// GET /api/payments - Get payments with filtering
const getPayments = async (req, res) => {
  try {
    const { 
      saleId, 
      type, 
      page = 1, 
      limit = 10,
      startDate,
      endDate,
      currency
    } = req.query;
    
    const query = {};
    
    if (saleId && saleId !== 'undefined' && mongoose.Types.ObjectId.isValid(saleId)) {
      query.saleId = saleId;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (currency) {
      query.currency = currency;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice totalCost' },
        { path: 'paymentTo', select: 'name' },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      data: {
        payments,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching payments'
    });
  }
};

// GET /api/payments/:id - Get payment by ID
const getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await Payment.findById(id)
      .populate([
        { path: 'saleId', select: 'id totalSalePrice totalCost clientId' },
        { path: 'paymentTo', select: 'name' },
        { path: 'createdBy', select: 'username email' }
      ]);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: { payment }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching payment'
    });
  }
};

// PUT /api/payments/:id - Update payment
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    if (req.file) {
      updateData.receiptImage = `/uploads/payments/${req.file.filename}`;
    }

    const payment = await Payment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'saleId', select: 'id totalSalePrice totalCost' },
      { path: 'paymentTo', select: 'name' },
      { path: 'createdBy', select: 'username email' }
    ]);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (updateData.amount !== undefined) {
      const sale = await Sale.findById(payment.saleId);
      if (sale) {
        const payments = await Payment.find({ 
          saleId: sale.id, 
          type: payment.type 
        });
        
        const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
        
        if (payment.type === 'client') {
          sale.totalClientPayments = totalPayments;
        } else {
          sale.totalProviderPayments = totalPayments;
        }
        
        sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
        sale.providerBalance = sale.totalProviderPayments - sale.totalCost;
        
        await sale.save();
        
        const statusUpdate = await sale.checkAndUpdateStatus();
        if (statusUpdate.statusChanged) {
          console.log(`Sale status automatically updated: ${statusUpdate.previousStatus} → ${statusUpdate.newStatus}`);
        }
      }
    }

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: { payment }
    });

  } catch (error) {
    console.error('Update payment error:', error);
    
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
      message: 'Internal server error while updating payment'
    });
  }
};

// DELETE /api/payments/:id - Delete payment
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const sale = await Sale.findById(payment.saleId);
    if (sale) {
      if (payment.type === 'client') {
        sale.paymentsClient = sale.paymentsClient.filter(p => p.paymentId.toString() !== id);
        sale.totalClientPayments -= payment.amount;
      } else {
        sale.paymentsProvider = sale.paymentsProvider.filter(p => p.paymentId.toString() !== id);
        sale.totalProviderPayments -= payment.amount;
      }
      
      sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
      sale.providerBalance = sale.totalProviderPayments - sale.totalCost;
      
      await sale.save();
    }

    await Payment.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Payment deleted successfully'
    });

  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting payment'
    });
  }
};

// GET /api/currencies - Get supported currencies
const getSupportedCurrencies = async (req, res) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();
    
    res.json({
      success: true,
      data: { currencies }
    });

  } catch (error) {
    console.error('Get currencies error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching currencies'
    });
  }
};

// Helper function to create vendor payment tracking records
const createVendorPaymentRecords = async (sale, payment, userId) => {
  try {
    const populatedSale = await Sale.findById(sale._id).populate([
      { path: 'services.serviceId', select: 'destino type' },
      { path: 'services.providerId', select: 'name commissionRate paymentTerms' }
    ]);

    const vendorPaymentPromises = populatedSale.services.map(async (serviceSale) => {
      const provider = serviceSale.providerId;
      
      if (!provider) {
        return null;
      }
      
      const grossRevenue = serviceSale.priceClient * serviceSale.quantity;
      const providerCost = serviceSale.costProvider * serviceSale.quantity;
      const commissionRate = 0; 
      const commissionAmount = 0; 
      const netProfit = grossRevenue - providerCost; 

      const existingVendorPayment = await VendorPayment.findOne({
        saleId: sale._id,
        providerId: provider._id,
        paymentId: payment._id
      });

      if (!existingVendorPayment) {
        const vendorPaymentData = {
          saleId: sale._id,
          providerId: provider._id,
          paymentId: payment._id,
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
          dueDate: calculateDueDate(payment.date, provider.paymentTerms || 'net_30'),
          createdBy: userId
        };

        const vendorPayment = new VendorPayment(vendorPaymentData);
        return vendorPayment.save();
      }
    });

    const validPromises = vendorPaymentPromises.filter(promise => promise !== null);
    await Promise.all(validPromises);
  } catch (error) {
    console.error('Error creating vendor payment records:', error);
  }
};

module.exports = {
  recordClientPayment,
  recordProviderPayment,
  getPayments,
  getPayment,
  updatePayment,
  deletePayment,
  getSupportedCurrencies
};