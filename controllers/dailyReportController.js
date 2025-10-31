const mongoose = require('mongoose');
const DailyReport = require('../models/DailyReport');
const Service = require('../models/Service');
const Sale = require('../models/Sale');

// POST /api/daily-reports/generate - Generate daily report for arrived passengers
const generateDailyReport = async (req, res) => {
  try {
    const { date } = req.body;
    const userId = req.user.id;

    const reportDate = date ? new Date(date) : new Date();
    reportDate.setUTCHours(0, 0, 0, 0);

    // Generate the daily report
    const report = await DailyReport.generateDailyReport(reportDate);

    // Update createdBy if it's a new report
    if (!report.createdBy || report.createdBy.toString() === '000000000000000000000000') {
      report.createdBy = userId;
      await report.save();
    }

    // Populate the report
    await report.populate([
      { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
      { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
      { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
      { path: 'arrivedPassengers.serviceId', select: 'title type' },
      { path: 'createdBy', select: 'username email' }
    ]);

    // Clear report cache
    // Report cache clearing removed - no caching mechanism in place

    res.status(201).json({
      success: true,
      message: 'Daily report generated successfully',
      data: { report }
    });

  } catch (error) {
    console.error('Generate daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while generating daily report'
    });
  }
};

// GET /api/daily-reports - Get daily reports
const getDailyReports = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10,
      status
    } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.reportDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0);
        query.reportDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.reportDate.$lte = end;
      }
    }

    const reports = await DailyReport.find(query)
      .populate([
        { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
        { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
        { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
        { path: 'arrivedPassengers.serviceId', select: 'title type' },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ reportDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DailyReport.countDocuments(query);

    res.json({
      success: true,
      data: {
        reports,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get daily reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching daily reports'
    });
  }
};

// GET /api/daily-reports/today - Get today's daily report
const getTodayReport = async (req, res) => {
  try {
    const report = await DailyReport.findToday();
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No daily report found for today'
      });
    }

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    console.error('Get today report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching today\'s report'
    });
  }
};

// GET /api/daily-reports/:id - Get daily report by ID
const getDailyReport = async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await DailyReport.findById(id)
      .populate([
        { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
        { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
        { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
        { path: 'arrivedPassengers.serviceId', select: 'title type' },
        { path: 'createdBy', select: 'username email' }
      ]);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    console.error('Get daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching daily report'
    });
  }
};

// GET /api/daily-reports/date/:date - Get daily report by date
const getDailyReportByDate = async (req, res) => {
  try {
    const { date } = req.params;
    
    const report = await DailyReport.findByDate(date);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No daily report found for the specified date'
      });
    }

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    console.error('Get daily report by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching daily report by date'
    });
  }
};

// PUT /api/daily-reports/:id/passenger/:passengerId/status - Update passenger status
const updatePassengerStatus = async (req, res) => {
  try {
    const { id, passengerId } = req.params;
    const { status, notes } = req.body;

    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    await report.updatePassengerStatus(passengerId, status, notes);

    // Populate the updated report
    await report.populate([
      { path: 'arrivedPassengers.passengerId', select: 'name surname passportNumber' },
      { path: 'arrivedPassengers.clientId', select: 'name surname email phone' },
      { path: 'arrivedPassengers.saleId', select: 'id totalSalePrice' },
      { path: 'arrivedPassengers.serviceId', select: 'title type' },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.json({
      success: true,
      message: 'Passenger status updated successfully',
      data: { report }
    });

  } catch (error) {
    console.error('Update passenger status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while updating passenger status'
    });
  }
};

// PUT /api/daily-reports/:id/mark-sent - Mark report as sent via WhatsApp
const markReportAsSent = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId } = req.body;

    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    await report.markAsSent(messageId);

    res.json({
      success: true,
      message: 'Report marked as sent successfully',
      data: { report }
    });

  } catch (error) {
    console.error('Mark report as sent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while marking report as sent'
    });
  }
};

// PUT /api/daily-reports/:id/mark-responded - Mark report as responded
const markReportAsResponded = async (req, res) => {
  try {
    const { id } = req.params;
    const { responseMessage } = req.body;

    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    await report.markAsResponded(responseMessage);

    res.json({
      success: true,
      message: 'Report marked as responded successfully',
      data: { report }
    });

  } catch (error) {
    console.error('Mark report as responded error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while marking report as responded'
    });
  }
};

// GET /api/daily-reports/:id/whatsapp-url - Get WhatsApp share URL
const getWhatsAppShareUrl = async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    res.json({
      success: true,
      data: {
        whatsappShareUrl: report.whatsappShareUrl,
        reportDate: report.formattedReportDate
      }
    });

  } catch (error) {
    console.error('Get WhatsApp share URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while getting WhatsApp share URL'
    });
  }
};

// GET /api/daily-reports/statistics - Get daily report statistics
const getDailyReportStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const reports = await DailyReport.findByDateRange(startDate, endDate);
    
    const statistics = {
      totalReports: reports.length,
      totalExpected: reports.reduce((sum, r) => sum + r.totalExpected, 0),
      totalArrived: reports.reduce((sum, r) => sum + r.totalArrived, 0),
      totalDelayed: reports.reduce((sum, r) => sum + r.totalDelayed, 0),
      totalCancelled: reports.reduce((sum, r) => sum + r.totalCancelled, 0),
      totalNoShow: reports.reduce((sum, r) => sum + r.totalNoShow, 0),
      averageArrivalRate: reports.length > 0 
        ? reports.reduce((sum, r) => sum + parseFloat(r.arrivalRate), 0) / reports.length 
        : 0
    };

    res.json({
      success: true,
      data: { statistics }
    });

  } catch (error) {
    console.error('Get daily report statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching daily report statistics'
    });
  }
};

// PUT /api/daily-reports/:id/populate-sample - Add sample data to existing report
const populateSampleData = async (req, res) => {
  try {
    const { id } = req.params;
    
    const report = await DailyReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Daily report not found'
      });
    }

    // Add sample passengers if none exist
    if (report.arrivedPassengers.length === 0) {
      const samplePassengers = [
        {
          passengerId: new mongoose.Types.ObjectId(),
          clientId: new mongoose.Types.ObjectId(),
          saleId: new mongoose.Types.ObjectId(),
          serviceId: new mongoose.Types.ObjectId(),
          passengerDetails: {
            name: 'John',
            surname: 'Doe',
            passportNumber: 'A1234567',
            nationality: 'US',
            phone: '+1234567890',
            email: 'john.doe@example.com'
          },
          serviceDetails: {
            title: 'Hotel Stay',
            type: 'hotel',
            providerName: 'Sample Hotel',
            startDate: new Date(report.reportDate.getTime() - 24 * 60 * 60 * 1000),
            endDate: report.reportDate,
            location: {
              city: 'Sample City',
              country: 'Sample Country'
            }
          },
          arrivalDetails: {
            expectedArrivalDate: report.reportDate,
            actualArrivalDate: report.reportDate
          },
          status: 'expected',
          createdBy: req.user.id
        },
        {
          passengerId: new mongoose.Types.ObjectId(),
          clientId: new mongoose.Types.ObjectId(),
          saleId: new mongoose.Types.ObjectId(),
          serviceId: new mongoose.Types.ObjectId(),
          passengerDetails: {
            name: 'Jane',
            surname: 'Smith',
            passportNumber: 'B7654321',
            nationality: 'UK',
            phone: '+44123456789',
            email: 'jane.smith@example.com'
          },
          serviceDetails: {
            title: 'Flight',
            type: 'airline',
            providerName: 'Sample Airlines',
            startDate: new Date(report.reportDate.getTime() - 24 * 60 * 60 * 1000),
            endDate: report.reportDate,
            location: {
              city: 'Sample Airport',
              country: 'Sample Country'
            }
          },
          arrivalDetails: {
            expectedArrivalDate: report.reportDate,
            actualArrivalDate: report.reportDate
          },
          status: 'arrived',
          createdBy: req.user.id
        }
      ];
      
      report.arrivedPassengers = samplePassengers;
      await report.save();
    }

    res.json({
      success: true,
      message: 'Sample data added to report successfully',
      data: { report }
    });

  } catch (error) {
    console.error('Populate sample data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding sample data'
    });
  }
};

// GET /api/daily-reports/today-arrivals - Get passengers arriving on specified date or today
const getTodayArrivals = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let queryDate;
    let queryEndDate;
    
    if (startDate && endDate) {
      // Use provided date range
      queryDate = new Date(startDate);
      queryDate.setUTCHours(0, 0, 0, 0);
      queryEndDate = new Date(endDate);
      queryEndDate.setUTCHours(23, 59, 59, 999);
    } else if (startDate) {
      // Use only start date
      queryDate = new Date(startDate);
      queryDate.setUTCHours(0, 0, 0, 0);
      queryEndDate = new Date(queryDate);
      queryEndDate.setUTCHours(23, 59, 59, 999);
    } else {
      // Default to today
      queryDate = new Date();
      queryDate.setUTCHours(0, 0, 0, 0);
      queryEndDate = new Date(queryDate);
      queryEndDate.setUTCDate(queryEndDate.getUTCDate() + 1);
    }

    // Find all sales where any service has an end date within the specified range
    const salesWithArrivals = await Sale.find({
      'services.serviceDates.endDate': {
        $gte: queryDate,
        $lte: queryEndDate
      },
      status: { $ne: 'cancelled' } // Exclude cancelled sales
    })
    .populate([
      { 
        path: 'passengers.passengerId', 
        select: 'name surname passportNumber nationality phone email' 
      },
      { 
        path: 'clientId', 
        select: 'name surname email phone' 
      },
      { 
        path: 'services.serviceId', 
        select: 'title type' 
      },
      { 
        path: 'services.providers.providerId', 
        select: 'name' 
      },
      { 
        path: 'createdBy', 
        select: 'username email' 
      }
    ])
    .sort({ createdAt: -1 });

    // Process the data to extract passengers arriving in the specified date range
    const arrivals = [];
    
    salesWithArrivals.forEach(sale => {
      sale.services.forEach(service => {
        const serviceEndDate = new Date(service.serviceDates.endDate);
        serviceEndDate.setUTCHours(0, 0, 0, 0);
        
        // Check if this service ends within the specified date range
        if (serviceEndDate >= queryDate && serviceEndDate <= queryEndDate) {
          // For each passenger in this sale, create an arrival record
          sale.passengers.forEach(passengerSale => {
            const arrivalRecord = {
              saleId: sale._id,
              passengerId: passengerSale.passengerId._id,
              clientId: sale.clientId._id,
              serviceId: service.serviceId._id,
              passengerDetails: {
                name: passengerSale.passengerId.name,
                surname: passengerSale.passengerId.surname,
                passportNumber: passengerSale.passengerId.passportNumber,
                nationality: passengerSale.passengerId.nationality,
                phone: passengerSale.passengerId.phone,
                email: passengerSale.passengerId.email
              },
              clientDetails: {
                name: sale.clientId.name,
                surname: sale.clientId.surname,
                email: sale.clientId.email,
                phone: sale.clientId.phone
              },
              serviceDetails: {
                title: service.serviceId.title,
                type: service.serviceId.type,
                providerName: service.providers && service.providers.length > 0 
                  ? service.providers[0].providerId.name 
                  : 'N/A',
                startDate: service.serviceDates.startDate,
                endDate: service.serviceDates.endDate,
                location: {
                  city: sale.destination.city || '',
                  country: sale.destination.country || ''
                }
              },
              saleDetails: {
                totalSalePrice: sale.totalSalePrice,
                totalCost: sale.totalCost,
                profit: sale.profit,
                profitMargin: sale.totalSalePrice > 0 
                  ? ((sale.profit / sale.totalSalePrice) * 100).toFixed(2) 
                  : '0.00',
                status: sale.status,
                currency: sale.saleCurrency,
                createdBy: sale.createdBy.username
              },
              arrivalDate: service.serviceDates.endDate,
              createdAt: sale.createdAt
            };
            
            arrivals.push(arrivalRecord);
          });
        }
      });
    });

    res.json({
      success: true,
      data: {
        arrivals: arrivals,
        total: arrivals.length,
        startDate: queryDate.toISOString().split('T')[0],
        endDate: queryEndDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Get today arrivals error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching today\'s arrivals'
    });
  }
};

module.exports = {
  generateDailyReport,
  getDailyReports,
  getTodayReport,
  getDailyReport,
  getDailyReportByDate,
  updatePassengerStatus,
  markReportAsSent,
  markReportAsResponded,
  getWhatsAppShareUrl,
  getDailyReportStatistics,
  populateSampleData,
  getTodayArrivals
};