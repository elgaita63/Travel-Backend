const openaiReceiptService = require('../services/openaiReceiptService');
const ProvisionalReceipt = require('../models/ProvisionalReceipt');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const Client = require('../models/Client');
const fs = require('fs');
const { safeDeleteFile, validateFile, getUploadDirectory } = require('../utils/uploadUtils');

// POST /api/receipts/extract - Extract payment data from receipt using OpenAI Vision only
const extractReceiptData = async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No receipt file uploaded'
      });
    }

    uploadedFilePath = req.file.path;
    console.log('🚀 Starting receipt extraction for:', uploadedFilePath);

    // Validate the uploaded file
    const fileValidation = validateFile(uploadedFilePath, 10 * 1024 * 1024); // 10MB limit
    if (!fileValidation.valid) {
      console.error('❌ File validation failed:', fileValidation.error);
      safeDeleteFile(uploadedFilePath);
      
      return res.status(400).json({
        success: false,
        message: fileValidation.error,
        data: {
          amount: '',
          currency: 'USD',
          date: '',
          method: '',
          description: 'Please enter data manually',
          reference: ''
        }
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not configured');
      safeDeleteFile(uploadedFilePath);
      
      return res.status(503).json({
        success: false,
        message: 'Receipt extraction service is not available',
        error: 'OpenAI API key not configured. Please contact administrator.',
        data: {
          amount: '',
          currency: 'USD',
          date: '',
          method: '',
          description: 'Please enter data manually',
          reference: ''
        }
      });
    }

    // Ensure upload directory exists
    getUploadDirectory('receipts');

    // Use OpenAI Vision API exclusively
    console.log('🤖 Processing with OpenAI Vision...');
    const openaiResult = await openaiReceiptService.extractPaymentData(uploadedFilePath);
    
    if (!openaiResult.success) {
      console.error('❌ OpenAI Vision processing failed:', openaiResult.error);
      safeDeleteFile(uploadedFilePath);
      
      // Return a more user-friendly error with fallback data
      return res.status(500).json({
        success: false,
        message: 'Failed to process receipt. Please try again or enter data manually.',
        error: openaiResult.error,
        data: {
          amount: '',
          currency: 'USD',
          date: '',
          method: '',
          description: 'Please enter data manually',
          reference: ''
        }
      });
    }

    // Clean up uploaded file after successful processing
    safeDeleteFile(uploadedFilePath);

    console.log('✅ Receipt extraction completed successfully');
    
    res.json({
      success: true,
      message: 'Receipt data extracted successfully',
      data: openaiResult.data,
      confidence: openaiResult.confidence,
      method: openaiResult.method
    });

  } catch (error) {
    console.error('❌ Receipt extraction error:', error);
    
    // Clean up uploaded file on error
    if (uploadedFilePath) {
      safeDeleteFile(uploadedFilePath);
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during receipt extraction',
      error: error.message,
      data: {
        amount: '',
        currency: 'USD',
        date: '',
        method: '',
        description: 'Please enter data manually',
        reference: ''
      }
    });
  }
};

// POST /api/receipts/generate - Generate a provisional receipt
const generateReceipt = async (req, res) => {
  try {
    const { paymentId, saleId } = req.body;
    const userId = req.user.id;

    if (!paymentId || !saleId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and Sale ID are required'
      });
    }

    // Fetch payment details
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Fetch sale details
    const sale = await Sale.findById(saleId).populate([
      { path: 'clientId', model: 'Client' },
      { path: 'services.serviceId', model: 'Service' },
      { path: 'destination', model: 'Destination' }
    ]);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Get first service for details
    const firstService = sale.services && sale.services.length > 0 ? sale.services[0] : null;

    const receiptData = {
      receiptNumber,
      paymentId,
      saleId,
      clientId: sale.clientId?._id || sale.clientId,
      passengerDetails: {
        name: sale.clientId?.name?.split(' ')[0] || 'N/A',
        surname: sale.clientId?.name?.split(' ').slice(1).join(' ') || 'N/A',
        passportNumber: 'N/A', // This would need to be added to the client model
        nationality: 'N/A' // This would need to be added to the client model
      },
      serviceDetails: {
        title: firstService?.serviceId?.name || sale.title || 'Travel Service',
        description: firstService?.notes || 'Travel service booking',
        type: firstService?.serviceId?.type || 'Travel',
        destino: firstService?.destination?.city || sale.destination?.city || 'N/A',
        startDate: firstService?.serviceDates?.startDate || new Date(),
        endDate: firstService?.serviceDates?.endDate || new Date()
      },
      paymentDetails: {
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        reference: payment.reference || payment._id.toString().slice(-8).toUpperCase(),
        date: payment.paymentDate || new Date(),
        paymentDate: payment.paymentDate || payment.date || new Date()
      },
      companyDetails: {
        name: 'Travel Agency',
        address: {
          street: '123 Travel Street',
          city: 'Travel City',
          state: 'TC',
          zipCode: '12345',
          country: 'Travel Country'
        },
        phone: '+1-234-567-8900',
        email: 'info@travelagency.com'
      },
      status: 'generated',
      generatedAt: new Date(),
      createdBy: userId
    };

    const receipt = new ProvisionalReceipt(receiptData);
    await receipt.save();

    res.json({
      success: true,
      message: 'Receipt generated successfully',
      data: {
        receiptId: receipt._id,
        receiptNumber: receipt.receiptNumber,
        status: receipt.status,
        generatedAt: receipt.generatedAt
      }
    });

  } catch (error) {
    console.error('Receipt generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during receipt generation',
      error: error.message
    });
  }
};

// GET /api/receipts - Get receipts with optional filtering
const getReceipts = async (req, res) => {
  try {
    const { paymentId, saleId, status } = req.query;
    const userId = req.user.id;

    // Build query object
    const query = { createdBy: userId };
    
    if (paymentId) {
      query.paymentId = paymentId;
    }
    
    if (saleId) {
      query.saleId = saleId;
    }
    
    if (status) {
      query.status = status;
    }

    const receipts = await ProvisionalReceipt.find(query)
      .sort({ generatedAt: -1 })
      .populate('paymentId', 'amount currency method reference paymentDate')
      .populate('saleId', 'title clientId destination');

    res.json({
      success: true,
      message: 'Receipts retrieved successfully',
      data: receipts
    });

  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching receipts'
    });
  }
};

// PUT /api/receipts/:id/mark-sent - Mark a receipt as sent via WhatsApp
const markAsSent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const receipt = await ProvisionalReceipt.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { 
        status: 'sent',
        sentAt: new Date(),
        sentBy: userId
      },
      { new: true }
    );

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      message: 'Receipt marked as sent',
      data: {
        receiptId: receipt._id,
        status: receipt.status,
        sentAt: receipt.sentAt
      }
    });

  } catch (error) {
    console.error('Mark receipt as sent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating receipt status'
    });
  }
};

// PUT /api/receipts/:id/mark-responded - Mark a receipt as responded to
const markAsResponded = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;
    const userId = req.user.id;

    const receipt = await ProvisionalReceipt.findOne({ _id: id, createdBy: userId });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Use the model's markAsResponded method to properly handle the response message
    await receipt.markAsResponded(response);

    res.json({
      success: true,
      message: 'Receipt marked as responded',
      data: {
        receipt
      }
    });

  } catch (error) {
    console.error('Mark receipt as responded error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating receipt status'
    });
  }
};

module.exports = {
  extractReceiptData,
  generateReceipt,
  getReceipts,
  markAsSent,
  markAsResponded
};