const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Passenger = require('../models/Passenger');
const Service = require('../models/Service');
const ServiceTemplate = require('../models/ServiceTemplate');
const ServiceType = require('../models/ServiceType');
const Provider = require('../models/Provider');
const User = require('../models/User');
const Destination = require('../models/Destination');
const Cupo = require('../models/Cupo');

// POST /api/sales - Create a new sale
const createSale = async (req, res) => {
  try {
    const saleData = req.body;
    const userId = req.user.id; // From auth middleware
    
    // Validate required fields
    const requiredFields = ['clientId', 'passengers', 'services'];
    const missingFields = requiredFields.filter(field => !saleData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate that client exists
    const client = await Client.findById(saleData.clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Validate passengers (only companions, not main client)
    const validatedPassengers = [];
    
    for (const passengerSale of saleData.passengers) {
      // Skip main client - they should not be stored in passenger table
      if (passengerSale.isMainClient) {
        // Main client is already referenced via clientId, no need to create passenger record
        continue;
      }
      
      // Only process actual companions
      if (passengerSale.passengerId) {
        const passenger = await Passenger.findById(passengerSale.passengerId);
        if (!passenger) {
          return res.status(404).json({
            success: false,
            message: `Passenger with ID ${passengerSale.passengerId} not found`
          });
        }
        
        // Ensure passenger belongs to the client
        if (passenger.clientId.toString() !== saleData.clientId) {
          return res.status(400).json({
            success: false,
            message: `Passenger ${passengerSale.passengerId} does not belong to client ${saleData.clientId}`
          });
        }
        
        validatedPassengers.push({
          passengerId: passenger._id,
          price: passengerSale.price || 0,
          notes: passengerSale.notes || ''
        });
      }
    }

    // Validate services and create them if needed
    const validatedServices = [];
    
    for (const serviceSale of saleData.services) {
      let service;
      
      if (serviceSale.serviceId) {
        // Existing service
        service = await Service.findById(serviceSale.serviceId).populate('typeId', 'name category');
        if (!service) {
          return res.status(404).json({
            success: false,
            message: `Service with ID ${serviceSale.serviceId} not found`
          });
        }
      } else if (serviceSale.serviceName) {
        // Create service from template data
        const ServiceTemplate = require('../models/ServiceTemplate');
        const serviceTemplate = await ServiceTemplate.findOne({ name: serviceSale.serviceName });
        
        if (!serviceTemplate) {
          return res.status(404).json({
            success: false,
            message: `Service template with name ${serviceSale.serviceName} not found`
          });
        }
        
        // Create a new service from the template
        // First, get a default provider if none is specified
        let defaultProviderId = serviceSale.providerId;
        if (!defaultProviderId) {
          const defaultProvider = await Provider.findOne({}).limit(1);
          if (defaultProvider) {
            defaultProviderId = defaultProvider._id;
          } else {
            return res.status(400).json({
              success: false,
              message: 'No provider available. Please create a provider first.'
            });
          }
        }
        
        service = new Service({
          destino: serviceSale.serviceName,
          type: serviceTemplate.category || 'General',
          description: serviceTemplate.description || serviceSale.serviceName,
          providerId: defaultProviderId,
          sellingPrice: serviceSale.priceClient || 0,
          baseCurrency: serviceSale.currency || saleData.saleCurrency,
          createdBy: userId
        });
        await service.save();
      } else {
        return res.status(400).json({
          success: false,
          message: 'Service must have either serviceId or serviceName'
        });
      }
      
      // Handle multiple providers if present
      if (serviceSale.providers && serviceSale.providers.length > 0) {
        // Validate each provider in the providers array
        for (const providerData of serviceSale.providers) {
          const provider = await Provider.findById(providerData.providerId);
          if (!provider) {
            return res.status(404).json({
              success: false,
              message: `Provider with ID ${providerData.providerId} not found`
            });
          }
        }
      } else if (serviceSale.providerId) {
        // Validate single provider
        const provider = await Provider.findById(serviceSale.providerId);
        if (!provider) {
          return res.status(404).json({
            success: false,
            message: `Provider with ID ${serviceSale.providerId} not found`
          });
        }
      }
      
      // Add to validated services
      validatedServices.push({
        serviceId: service._id,
        serviceName: serviceSale.serviceName || service.destino, // Use provided service name or fallback to service destino
        serviceTypeName: serviceSale.serviceTypeName || (service.typeId && service.typeId.name) || 'General', // Store service type name from populated typeId
        priceClient: serviceSale.priceClient || 0,
        costProvider: serviceSale.costProvider || 0,
        currency: serviceSale.currency || saleData.saleCurrency,
        quantity: serviceSale.quantity || 1,
        serviceDates: serviceSale.serviceDates || {
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        providerId: serviceSale.providerId || null,
        providers: serviceSale.providers || [], // Include the providers array with all details
        notes: serviceSale.notes || ''
      });
    }

    // Create sale with calculated totals
    const sale = new Sale({
      ...saleData,
      passengers: validatedPassengers,
      services: validatedServices,
      createdBy: userId,
      status: saleData.status || 'open',
      saleCurrency: saleData.saleCurrency || 'USD'
    });

    await sale.save();

    // Populate all references for response
    await sale.populate([
      { path: 'clientId', select: 'name surname email phone' },
      { path: 'passengers.passengerId', select: 'name surname dob passportNumber nationality phone email' },
      { path: 'services.serviceId', select: 'name title description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'services.providers.providerId', select: 'name type' },
      { path: 'createdBy', select: 'username email role' }
    ]);

    console.log('Sale created - Raw sale object:');
    console.log('_id:', sale._id);
    console.log('id:', sale.id);
    console.log('toJSON():', JSON.stringify(sale.toJSON(), null, 2));
    
    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: { sale }
    });

  } catch (error) {
    console.error('Create sale error:', error);
    
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
      message: 'Internal server error while creating sale'
    });
  }
};

// GET /api/sales/:id - Get sale by ID with full population
const getSale = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sale ID format'
      });
    }
    
    const sale = await Sale.findById(id)
      .populate([
        { path: 'clientId', select: 'name surname email phone passportNumber nationality' },
        // Note: passengers.passengerId population removed because it's now Mixed type
        { 
          path: 'services.serviceId', 
          select: 'name destino description type sellingPrice baseCurrency',
          populate: {
            path: 'typeId',
            select: 'name category description'
          }
        },
        { path: 'services.providerId', select: 'name type contactInfo' },
        { path: 'services.providers.providerId', select: 'name type contactInfo' },
        { path: 'createdBy', select: 'username email role' },
        { path: 'paymentsClient.paymentId' },
        { path: 'paymentsProvider.paymentId' }
      ]);

    // Recalculate payment totals to ensure accuracy
    if (sale) {
      await sale.recalculatePaymentTotals();
      
    }

    // Handle passenger data - process both main clients (embedded objects) and companions (ObjectId references)
    if (sale && sale.passengers) {
      for (let i = 0; i < sale.passengers.length; i++) {
        const passengerSale = sale.passengers[i];
        
        // Check if passengerId is an ObjectId (companion) or an object (main client)
        if (passengerSale.passengerId && typeof passengerSale.passengerId === 'object' && passengerSale.passengerId.constructor.name === 'ObjectId') {
          // This is a companion - populate from Passenger collection
          try {
            const passenger = await mongoose.model('Passenger').findById(passengerSale.passengerId);
            if (passenger) {
              passengerSale.passengerId = {
                _id: passenger._id,
                name: passenger.name,
                surname: passenger.surname,
                email: passenger.email,
                phone: passenger.phone,
                passportNumber: passenger.passportNumber,
                nationality: passenger.nationality
              };
            }
          } catch (error) {
            console.error('Error populating companion passenger:', error);
          }
        } else if (passengerSale.isMainClient && (!passengerSale.passengerId || !passengerSale.passengerId.name)) {
          // Main client with missing data - restore from clientId
          console.log('Main client passengerId is null or missing data, restoring from clientId');
          if (sale.clientId) {
            passengerSale.passengerId = {
              _id: sale.clientId._id,
              name: sale.clientId.name,
              surname: sale.clientId.surname,
              email: sale.clientId.email,
              phone: sale.clientId.phone,
              passportNumber: sale.clientId.passportNumber,
              nationality: sale.clientId.nationality
            };
          }
        }
        // If passengerId is already a plain object with data, leave it as is
      }
    }
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: { sale }
    });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching sale'
    });
  }
};

// GET /api/sales - Get all sales with filtering and pagination
const getAllSales = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = '', 
      clientId = '',
      createdBy = '',
      providerId = '',
      startDate = '',
      endDate = '',
      currency = '', // New currency filter
      cupoId = '', // New quota filter
      search = '' // New search filter for passengers
    } = req.query;
    
    const query = {};
    
    // Apply ownership filter (set by filterByOwnership middleware)
    if (req.ownershipFilter) {
      Object.assign(query, req.ownershipFilter);
    }
    
    // Add status filter
    if (status) {
      query.status = status;
    }
    
    // Add client filter
    if (clientId) {
      query.clientId = clientId;
    }
    
    // Add created by filter (only if not already set by ownership filter)
    if (createdBy && !req.ownershipFilter) {
      query.createdBy = createdBy;
    }
    
    // Add provider filter - support both legacy single provider and new multiple providers structure
    if (providerId) {
      query.$or = [
        { 'services.providerId': providerId }, // Legacy single provider
        { 'services.providers.providerId': providerId } // New multiple providers
      ];
    }
    
    
    // Add date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        query.createdAt.$gte = start;
        console.log('Date filter - startDate:', startDate, 'parsed:', start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        query.createdAt.$lte = end;
        console.log('Date filter - endDate:', endDate, 'parsed:', end);
      }
    }

    // Add currency filter (filter by sale currency)
    if (currency) {
      query.saleCurrency = currency.toUpperCase();
    }

    // Add quota filter
    if (cupoId) {
      if (cupoId === 'none') {
        // Filter for sales not made from quotas
        query.cupoId = { $exists: false };
      } else if (cupoId === 'all_quotas') {
        // Filter for sales made from any quota
        query.cupoId = { $exists: true };
      } else {
        // Filter for sales made from a specific quota
        query.cupoId = cupoId;
      }
    }

    // Add search filter for passengers
    if (search) {
      // First, find clients that match the search criteria
      const Client = require('../models/Client');
      const matchingClients = await Client.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { surname: { $regex: search, $options: 'i' } },
          { dni: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { passportNumber: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const matchingClientIds = matchingClients.map(client => client._id);

      // Also search in passenger data (for companions)
      const Passenger = require('../models/Passenger');
      const matchingPassengers = await Passenger.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { surname: { $regex: search, $options: 'i' } },
          { dni: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { passportNumber: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const matchingPassengerIds = matchingPassengers.map(passenger => passenger._id);

      // Build search conditions for sales
      const searchConditions = [];

      // Add condition for matching main clients
      if (matchingClientIds.length > 0) {
        searchConditions.push({ clientId: { $in: matchingClientIds } });
      }

      // Add condition for matching companions (ObjectId references)
      if (matchingPassengerIds.length > 0) {
        searchConditions.push({ 'passengers.passengerId': { $in: matchingPassengerIds } });
      }

      // Add condition for embedded passenger data (when passengerId is an object with passenger info)
      searchConditions.push({
        $or: [
          { 'passengers.passengerId.name': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.surname': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.dni': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.email': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.phone': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.passportNumber': { $regex: searchTerm, $options: 'i' } }
        ]
      });

      // Apply search conditions
      if (searchConditions.length > 0) {
        query.$or = searchConditions;
      }
    }

    const sales = await Sale.find(query)
      .populate([
        { path: 'clientId', select: 'name surname email' },
        { path: 'createdBy', select: 'username email' },
        { path: 'services.serviceId', select: 'name destino type' },
        { path: 'services.providerId', select: 'name type' },
        { path: 'services.providers.providerId', select: 'name type' },
        { 
          path: 'cupoId', 
          select: 'serviceId metadata totalSeats reservedSeats availableSeats status',
          populate: {
            path: 'serviceId',
            select: 'destino type'
          }
        }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sale.countDocuments(query);

    // Calculate summary statistics for this query (respecting currency filter)
    const summaryStats = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$saleCurrency',
          totalSales: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          // Always use the direct totalSalePrice and totalCost fields from the database
          totalSales: '$totalSales',
          totalCost: '$totalCost',
          totalProfit: '$totalProfit',
          count: 1
        }
      },
      { $sort: { totalSales: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        sales,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        summary: summaryStats
      }
    });

  } catch (error) {
    console.error('Get all sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching sales'
    });
  }
};

// PUT /api/sales/:id - Update sale
const updateSale = async (req, res) => {
  try {
    console.log('🔥 updateSale controller called with ID:', req.params.id);
    console.log('🔥 updateSale request body:', JSON.stringify(req.body, null, 2));
    console.log('🔥 updateSale - Starting validation process...');
    
    const { id } = req.params;
    const updateData = req.body;

    // If updating passengers, validate them (including main client)
    if (updateData.passengers && updateData.passengers.length > 0) {
      const validatedPassengers = [];
      
      for (const passengerSale of updateData.passengers) {
        // Handle main client - preserve their data for display
        if (passengerSale.isMainClient) {
          console.log('🔍 Processing main client for display');
          console.log('Main client passenger data:', JSON.stringify(passengerSale, null, 2));
          
          // For main clients, we need to preserve their data in the passengers array
          // The data should already be in the passengerSale object
          validatedPassengers.push({
            passengerId: passengerSale.passengerId || {
              _id: passengerSale.clientId,
              name: passengerSale.name || '',
              surname: passengerSale.surname || '',
              email: passengerSale.email || 'N/A',
              phone: passengerSale.phone || 'N/A',
              passportNumber: passengerSale.passportNumber || 'N/A',
              dni: passengerSale.dni || ''
            },
            price: passengerSale.price || 0,
            notes: passengerSale.notes || '',
            isMainClient: true
          });
          continue;
        }
        
        // Only process actual companions
        if (passengerSale.passengerId) {
          // Extract the passenger ID - it might be an object with _id or just a string
          const passengerId = typeof passengerSale.passengerId === 'object' && passengerSale.passengerId !== null
            ? passengerSale.passengerId._id || passengerSale.passengerId
            : passengerSale.passengerId;
          
          console.log('🔍 Validating companion passenger ID:', passengerId);
          
          // If passengerId is already an object with passenger data, use it directly
          if (typeof passengerSale.passengerId === 'object' && passengerSale.passengerId._id) {
            validatedPassengers.push({
              passengerId: passengerSale.passengerId, // Keep the full object
              price: passengerSale.price || 0,
              notes: passengerSale.notes || '',
              isMainClient: false
            });
          } else {
            // Otherwise, fetch the passenger data
            const passenger = await Passenger.findById(passengerId);
            console.log('🔍 Companion passenger found:', !!passenger);
            if (!passenger) {
              console.log('❌ Companion passenger not found, but continuing with existing data');
              // Continue with existing data rather than failing
              validatedPassengers.push({
                passengerId: passengerSale.passengerId,
                price: passengerSale.price || 0,
                notes: passengerSale.notes || '',
                isMainClient: false
              });
            } else {
              validatedPassengers.push({
                passengerId: passenger._id,
                price: passengerSale.price || 0,
                notes: passengerSale.notes || '',
                isMainClient: false
              });
            }
          }
        }
      }
      
      // Update the passengers array with validated data
      updateData.passengers = validatedPassengers;
    }

    if (updateData.services) {
      for (const serviceSale of updateData.services) {
        // Extract the service ID - it might be an object with _id or just a string
        const serviceId = typeof serviceSale.serviceId === 'object' && serviceSale.serviceId !== null
          ? serviceSale.serviceId._id || serviceSale.serviceId
          : serviceSale.serviceId;
        
        console.log('🔍 Validating service ID:', serviceId);
        
        if (serviceId) {
          const service = await Service.findById(serviceId).populate('typeId', 'name category');
          console.log('🔍 Service found:', !!service);
          if (!service) {
            console.log('⚠️ Service not found, but continuing with update (edit mode)');
            // In edit mode, we'll allow the update to proceed even if the service doesn't exist
            // The service data will be preserved as-is in the sale
          }
          // Normalize the serviceId to be just the ID string
          serviceSale.serviceId = serviceId;
        }
      }
    }

    // For updates, we need to handle arrays properly
    const updateFields = { ...updateData };
    
    // Ensure destination.name is present if destination is being updated
    if (updateFields.destination) {
      updateFields.destination = {
        ...updateFields.destination,
        name: updateFields.destination.name || 
              (updateFields.destination.city ? 
                updateFields.destination.city : 
                'Unknown Destination')
      };
    }
    
    // Get existing sale to merge with new data
    const existingSale = await Sale.findById(id);
    if (!existingSale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // If services are being updated, merge with existing services
    if (updateData.services) {
      // For edit mode, we want to replace the entire services array with the updated selection
      updateFields.services = updateData.services;
    }
    
    // If passengers are being updated, merge with existing passengers
    if (updateData.passengers && updateData.passengers.length > 0) {
      // For edit mode, we want to replace the entire passengers array with the updated selection
      updateFields.passengers = updateData.passengers;
    }

    // Calculate financial totals BEFORE updating the database
    console.log('Backend - Calculating totals before database update...');
    console.log('  updateData.services exists:', !!updateData.services);
    console.log('  updateData.passengers exists:', !!updateData.passengers);
    console.log('  updateData.passengers:', updateData.passengers);
    console.log('  updateData.services:', updateData.services);
    
    if (updateData.services || (updateData.passengers && updateData.passengers.length > 0)) {
      console.log('Backend - Recalculation is needed, starting calculation...');
      
      // Calculate total sale price from passenger prices
      let totalSalePrice = 0;
      if (updateData.passengers && updateData.passengers.length > 0) {
        totalSalePrice = updateData.passengers.reduce((sum, passenger) => {
          const price = passenger.price || 0;
          const passengerName = passenger.passengerId?.name || passenger.name || 'Unknown';
          console.log(`Passenger ${passengerName}: price = ${price}`);
          return sum + price;
        }, 0);
      } else if (existingSale.passengers && existingSale.passengers.length > 0) {
        // Use existing passenger data if no new passengers provided
        totalSalePrice = existingSale.passengers.reduce((sum, passenger) => {
          const price = passenger.price || 0;
          const passengerName = passenger.passengerId?.name || passenger.name || 'Unknown';
          console.log(`Existing passenger ${passengerName}: price = ${price}`);
          return sum + price;
        }, 0);
      }
      
      console.log('Backend calculation - totalSalePrice from passengers:', totalSalePrice);
      
      // Use the updated services data for calculation
      const servicesToCalculate = updateData.services || [];
      
      console.log('Backend calculation - services:', servicesToCalculate.map(s => ({
        serviceName: s.serviceName,
        priceClient: s.priceClient,
        quantity: s.quantity,
        costProvider: s.costProvider
      })));
      // Calculate total cost from service costs (costProvider field)
      const totalCost = servicesToCalculate.reduce((sum, service) => {
        const serviceCost = service.costProvider || 0;
        console.log(`Service ${service.serviceName}: costProvider = ${serviceCost}`);
        return sum + serviceCost;
      }, 0);
      const profit = totalSalePrice - totalCost;
      const profitMargin = totalSalePrice > 0 ? (profit / totalSalePrice) * 100 : 0;
      
      console.log('Backend calculation - totalSalePrice:', totalSalePrice);
      console.log('Backend calculation - totalCost:', totalCost);
      console.log('Backend calculation - profit:', profit);

      // Add calculated totals to updateFields
      updateFields.totalSalePrice = totalSalePrice;
      updateFields.totalCost = totalCost;
      updateFields.profit = profit;
      updateFields.profitMargin = profitMargin;
      
      console.log('Backend - Adding calculated totals to updateFields:', {
        totalSalePrice: updateFields.totalSalePrice,
        totalCost: updateFields.totalCost,
        profit: updateFields.profit,
        profitMargin: updateFields.profitMargin
      });
    } else {
      console.log('Backend - No recalculation needed (no services or passengers updated)');
    }

    console.log('Backend - About to update database with updateFields:', JSON.stringify(updateFields, null, 2));
    
    const sale = await Sale.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: false } // Temporarily disable validators to test
    ).populate([
      { path: 'clientId', select: 'name surname email phone' },
      { path: 'passengers.passengerId', select: 'name surname dob passportNumber' },
      { path: 'services.serviceId', select: 'name title description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'services.providers.providerId', select: 'name email phone' },
      { path: 'createdBy', select: 'username email role' }
    ]);
    
    console.log('Backend - Update result:', !!sale);
    console.log('Backend - Sale after update:', {
      totalSalePrice: sale?.totalSalePrice,
      totalCost: sale?.totalCost,
      profit: sale?.profit,
      passengers: sale?.passengers?.map(p => ({ name: p.passengerId?.name || p.name, price: p.price }))
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Update clientBalance and providerBalance after the main update
    if (updateData.services || (updateData.passengers && updateData.passengers.length > 0)) {
      sale.clientBalance = sale.totalSalePrice - (sale.totalClientPayments || 0);
      sale.providerBalance = (sale.totalProviderPayments || 0) - sale.totalCost;
      await sale.save();
      
      console.log('Backend - Final sale totals after update:', {
        totalSalePrice: sale.totalSalePrice,
        totalCost: sale.totalCost,
        profit: sale.profit,
        clientBalance: sale.clientBalance,
        providerBalance: sale.providerBalance
      });
    }

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: { sale }
    });

  } catch (error) {
    console.error('Update sale error:', error);
    
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
      message: 'Internal server error while updating sale'
    });
  }
};

// DELETE /api/sales/:id - Delete sale
const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByIdAndDelete(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      message: 'Sale deleted successfully'
    });

  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting sale'
    });
  }
};

// POST /api/sales/:id/upload - Upload documents to sale
const uploadDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Add uploaded files to sale documents
    const newDocuments = req.files.map(file => ({
      filename: file.filename,
      url: `/uploads/sales/${file.filename}`,
      type: type || 'other',
      uploadedAt: new Date()
    }));

    sale.documents.push(...newDocuments);
    await sale.save();

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: { documents: newDocuments }
    });

  } catch (error) {
    console.error('Upload documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while uploading documents'
    });
  }
};

// POST /api/sales/upload-temp - Upload documents temporarily (before sale creation)
const uploadTempDocuments = async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Add uploaded files to temporary documents
    const newDocuments = req.files.map(file => ({
      filename: file.filename,
      url: `/uploads/sales/${file.filename}`,
      type: type || 'other',
      uploadedAt: new Date()
    }));

    res.json({
      success: true,
      message: 'Documents uploaded successfully',
      data: { documents: newDocuments }
    });

  } catch (error) {
    console.error('Upload temp documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while uploading documents'
    });
  }
};

// GET /api/sales/:id/documents - Get sale documents
const getSaleDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await Sale.findById(id).select('documents');
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: { documents: sale.documents }
    });

  } catch (error) {
    console.error('Get sale documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching documents'
    });
  }
};

// GET /api/sales/stats - Get sales statistics
const getSalesStats = async (req, res) => {
  try {
    const { startDate, endDate, currency } = req.query;
    
    const matchQuery = {};
    
    // Apply ownership filter (set by filterByOwnership middleware)
    if (req.ownershipFilter) {
      Object.assign(matchQuery, req.ownershipFilter);
    }
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Add currency filter
    if (currency) {
      matchQuery.saleCurrency = currency.toUpperCase();
    }

    const stats = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          avgProfitMargin: { $avg: { $divide: ['$profit', '$totalSalePrice'] } }
        }
      }
    ]);

    const statusStats = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get currency breakdown (even when filtering by a specific currency, show all currencies)
    const currencyStats = await Sale.aggregate([
      { 
        $match: {
          ...matchQuery,
          saleCurrency: matchQuery.saleCurrency || { $exists: true } // Remove currency filter for breakdown
        }
      },
      {
        $group: {
          _id: '$saleCurrency',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalSales: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          avgProfitMargin: 0
        },
        statusBreakdown: statusStats,
        currencyBreakdown: currencyStats
      }
    });

  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching sales statistics'
    });
  }
};

// GET /api/sales/vendor/:providerId - Get sales for a specific vendor/provider with period filtering
const getVendorSales = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      startDate = '', 
      endDate = '',
      status = ''
    } = req.query;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID format'
      });
    }
    
    // Build query for sales that include this provider
    const query = {
      'services.providerId': providerId
    };
    
    // Add status filter
    if (status) {
      query.status = status;
    }
    
    // Add date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get sales with pagination
    const sales = await Sale.find(query)
      .populate([
        { path: 'clientId', select: 'name surname email phone' },
        { path: 'createdBy', select: 'username email' },
        { path: 'services.serviceId', select: 'name destino description type' },
        { path: 'services.providerId', select: 'name type commissionRate paymentTerms' },
        { path: 'paymentsProvider.paymentId', select: 'amount currency date method status' }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate vendor-specific totals and balances
    const vendorSales = sales.map(sale => {
      // Find services for this specific provider
      const providerServices = sale.services.filter(service => 
        service.providerId._id.toString() === providerId
      );
      
      // Calculate totals for this provider only
      const providerRevenue = providerServices.reduce((sum, service) => 
        sum + (service.priceClient * service.quantity), 0
      );
      
      const providerCost = providerServices.reduce((sum, service) => 
        sum + (service.costProvider * service.quantity), 0
      );
      
      const providerCommission = providerServices.reduce((sum, service) => {
        const commissionRate = service.providerId.commissionRate || 0;
        return sum + ((service.priceClient * service.quantity) * commissionRate / 100);
      }, 0);
      
      const providerProfit = providerRevenue - providerCost - providerCommission;
      
      // Get provider payments for this sale
      const providerPayments = sale.paymentsProvider.map(payment => payment.paymentId)
        .filter(payment => payment && payment.amount > 0);
      
      const totalProviderPayments = providerPayments.reduce((sum, payment) => 
        sum + payment.amount, 0
      );
      
      const providerBalance = providerCost - totalProviderPayments;
      
      return {
        ...sale.toObject(),
        providerServices,
        providerRevenue,
        providerCost,
        providerCommission,
        providerProfit,
        totalProviderPayments,
        providerBalance,
        isProviderFullyPaid: providerBalance <= 0
      };
    });

    const total = await Sale.countDocuments(query);

    res.json({
      success: true,
      data: {
        sales: vendorSales,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get vendor sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching vendor sales'
    });
  }
};

// GET /api/sales/seller/monthly-stats - Get monthly stats for current salesperson
const getSellerMonthlyStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year, month } = req.query;
    
    // Default to current month if not specified
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    
    // Create date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    
    const matchConditions = {
      createdBy: new mongoose.Types.ObjectId(userId),
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Get monthly aggregated stats
    const monthlyStats = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          avgSaleValue: { $avg: '$totalSalePrice' },
          avgProfit: { $avg: '$profit' },
          avgProfitMargin: { $avg: { $divide: ['$profit', '$totalSalePrice'] } }
        }
      }
    ]);

    // Get sales by status
    const statusStats = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalSalePrice' },
          totalProfit: { $sum: '$profit' }
        }
      }
    ]);

    // Get daily breakdown for the month
    const dailyStats = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: '$createdAt' },
            status: '$status'
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalSalePrice' },
          profit: { $sum: '$profit' }
        }
      },
      {
        $group: {
          _id: '$_id.day',
          totalSales: { $sum: '$count' },
          totalRevenue: { $sum: '$revenue' },
          totalProfit: { $sum: '$profit' },
          byStatus: {
            $push: {
              status: '$_id.status',
              count: '$count',
              revenue: '$revenue',
              profit: '$profit'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const stats = monthlyStats[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      avgSaleValue: 0,
      avgProfit: 0,
      avgProfitMargin: 0
    };

    // Calculate avgSaleValue as Total Revenue / Total Sales
    stats.avgSaleValue = stats.totalSales > 0 ? stats.totalRevenue / stats.totalSales : 0;

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        overview: {
          ...stats,
          avgProfitMargin: stats.avgProfitMargin ? (stats.avgProfitMargin * 100).toFixed(2) : 0
        },
        statusBreakdown: statusStats,
        dailyBreakdown: dailyStats
      }
    });

  } catch (error) {
    console.error('Get seller monthly stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching seller monthly stats'
    });
  }
};

// GET /api/sales/seller/monthly-sales - Get monthly sales with profit details for current salesperson
const getSellerMonthlySales = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      year, 
      month, 
      page = 1, 
      limit = 20,
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      currency = ''
    } = req.query;
    
    // Default to current month if not specified
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    
    // Create date range for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    
    const matchConditions = {
      createdBy: new mongoose.Types.ObjectId(userId),
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Add status filter if provided
    if (status) {
      matchConditions.status = status;
    }

    // Add currency filter if provided
    if (currency) {
      matchConditions.saleCurrency = currency.toUpperCase();
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const sales = await Sale.find(matchConditions)
      .populate([
        { path: 'clientId', select: 'name surname email phone' },
        { path: 'passengers.passengerId', select: 'name surname' },
        { path: 'services.serviceId', select: 'name destino type' },
        { path: 'services.providerId', select: 'name type' }
      ])
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sale.countDocuments(matchConditions);

    // Calculate summary for the filtered results
    const summary = await Sale.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$totalSalePrice' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          avgProfitMargin: { $avg: { $divide: ['$profit', '$totalSalePrice'] } }
        }
      }
    ]);

    const summaryData = summary[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      avgProfitMargin: 0
    };

    // Calculate avgSaleValue as Total Revenue / Total Sales
    summaryData.avgSaleValue = summaryData.totalSales > 0 ? summaryData.totalRevenue / summaryData.totalSales : 0;

    res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        sales,
        summary: {
          ...summaryData,
          avgProfitMargin: summaryData.avgProfitMargin ? (summaryData.avgProfitMargin * 100).toFixed(2) : 0
        },
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get seller monthly sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching seller monthly sales'
    });
  }
};

// POST /api/sales/new-flow - Create a new sale with the new flow
const createSaleNewFlow = async (req, res) => {
  try {
    const saleData = req.body;
    const userId = req.user.id;
    
    // Validate required fields for new flow
    const requiredFields = ['passengers', 'destination', 'pricingModel', 'saleCurrency'];
    const missingFields = requiredFields.filter(field => !saleData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate passengers data
    console.log('=== DEBUGGING PASSENGER DATA ===');
    console.log('Received passengers:', JSON.stringify(saleData.passengers, null, 2));
    
    const validatedPassengers = [];
    
    for (const passengerData of saleData.passengers) {
      console.log('Processing passenger data:', JSON.stringify(passengerData, null, 2));
      
      const isMainClient = passengerData.type === 'main_passenger';
      console.log(`Processing passenger: type=${passengerData.type}, isMainClient=${isMainClient}`);
      
      // For main client, we need to include them in the passengers array for display
      // but we don't need to create a new Passenger record since they're already a Client
      if (isMainClient) {
        console.log('🔍 Processing main client for display');
        console.log('Main client passenger data:', JSON.stringify(passengerData, null, 2));
        console.log('Main client email:', passengerData.email);
        console.log('Main client phone:', passengerData.phone);
        console.log('Main client passportNumber:', passengerData.passportNumber);
        
        // Use the passenger data from the frontend instead of fetching from database
        // This ensures we have the most up-to-date information
        validatedPassengers.push({
          passengerId: {
            _id: passengerData.clientId,
            name: passengerData.name || '',
            surname: passengerData.surname || '',
            email: passengerData.email || 'N/A',
            phone: passengerData.phone || 'N/A',
            passportNumber: passengerData.passportNumber || 'N/A',
            dni: passengerData.dni || ''
          },
          price: passengerData.price || 0,
          notes: passengerData.notes || '',
          isMainClient: true
        });
        continue;
      }
      
      // Only process actual companions
      let passenger;
      
      if (passengerData.passengerId) {
        // Existing passenger
        passenger = await Passenger.findById(passengerData.passengerId);
        if (!passenger) {
          return res.status(404).json({
            success: false,
            message: `Passenger with ID ${passengerData.passengerId} not found`
          });
        }
      } else {
        // For companions, they should already exist as Passenger records
        // Look up the existing passenger by clientId (which is actually the passenger _id)
        passenger = await Passenger.findById(passengerData.clientId);
        if (!passenger) {
          return res.status(404).json({
            success: false,
            message: `Companion with ID ${passengerData.clientId} not found`
          });
        }
      }
      
      validatedPassengers.push({
        passengerId: passenger._id,
        price: passengerData.price || 0,
        notes: passengerData.notes || '',
        isMainClient: false
      });
    }

    // Validate destination
    const destination = saleData.destination;
    if (!destination.city) {
      return res.status(400).json({
        success: false,
        message: 'Destination city is required'
      });
    }

    // Validate services and providers from new flow
    const validatedServices = [];
    
    // Handle selectedServices and selectedProviders from new flow
    if (saleData.selectedServices && saleData.selectedServices.length > 0) {
      for (const serviceTemplate of saleData.selectedServices) {
        // Validate that the service template exists
        const ServiceTemplate = require('../models/ServiceTemplate');
        const template = await ServiceTemplate.findById(serviceTemplate.serviceTemplateId);
        if (!template) {
          return res.status(404).json({
            success: false,
            message: `Service template with ID ${serviceTemplate.serviceTemplateId} not found`
          });
        }
        
        // Create a service entry for each service template
        const serviceData = {
          serviceTemplateId: serviceTemplate.serviceTemplateId, // Store the template ID
          serviceName: serviceTemplate.name || null, // Make serviceName optional
          priceClient: 0, // Will be calculated per passenger
          costProvider: 0, // Will be calculated from providers
          currency: saleData.saleCurrency,
          quantity: 1,
          serviceDates: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
          },
          providers: [] // Will be populated with selectedProviders
        };
        
        // Add providers for this service
        if (saleData.selectedProviders && saleData.selectedProviders.length > 0) {
          for (const providerData of saleData.selectedProviders) {
            const provider = await Provider.findById(providerData.providerId);
            if (provider) {
              serviceData.providers.push({
                providerId: provider._id,
                serviceProviderId: provider._id, // Using provider ID as serviceProviderId for now
                costProvider: providerData.usdAmount || 0,
                currency: providerData.currency || 'USD',
                startDate: providerData.startDate || null,
                endDate: providerData.endDate || null,
                documents: providerData.receipt ? [{
                  filename: providerData.receipt.filename || 'receipt',
                  url: providerData.receipt.url || '',
                  type: 'receipt',
                  uploadedAt: new Date()
                }] : []
              });
              
              // Add to total cost
              serviceData.costProvider += providerData.usdAmount || 0;
            }
          }
        }
        
        validatedServices.push(serviceData);
      }
    }
    
    // Handle legacy services format if provided
    if (saleData.services && saleData.services.length > 0) {
      for (const serviceData of saleData.services) {
        // Validate that either serviceId or serviceTemplateId is provided
        if (!serviceData.serviceId && !serviceData.serviceTemplateId) {
          return res.status(400).json({
            success: false,
            message: 'Service must have either serviceId or serviceTemplateId'
          });
        }
        
        if (serviceData.serviceId && serviceData.serviceTemplateId) {
          return res.status(400).json({
            success: false,
            message: 'Service cannot have both serviceId and serviceTemplateId'
          });
        }
        
        let service = null;
        if (serviceData.serviceId) {
          service = await Service.findById(serviceData.serviceId).populate('typeId', 'name category');
          if (!service) {
            return res.status(404).json({
              success: false,
              message: `Service with ID ${serviceData.serviceId} not found`
            });
          }
        } else if (serviceData.serviceTemplateId) {
          const ServiceTemplate = require('../models/ServiceTemplate');
          const template = await ServiceTemplate.findById(serviceData.serviceTemplateId);
          if (!template) {
            return res.status(404).json({
              success: false,
              message: `Service template with ID ${serviceData.serviceTemplateId} not found`
            });
          }
        }
        
        // Validate provider
        if (serviceData.providerId) {
          const provider = await Provider.findById(serviceData.providerId);
          if (!provider) {
            return res.status(404).json({
              success: false,
              message: `Provider with ID ${serviceData.providerId} not found`
            });
          }
        }
        
        const validatedServiceData = {
          serviceName: serviceData.serviceName || (service ? service.destino : null),
          priceClient: serviceData.priceClient || 0,
          costProvider: serviceData.costProvider || 0,
          currency: serviceData.currency || saleData.saleCurrency,
          quantity: serviceData.quantity || 1,
          serviceDates: {
            startDate: serviceData.serviceDates?.startDate || new Date(),
            endDate: serviceData.serviceDates?.endDate || new Date(Date.now() + 24 * 60 * 60 * 1000)
          },
          providerId: serviceData.providerId || (service ? service.providerId : null),
          notes: serviceData.notes || ''
        };
        
        // Add the appropriate ID field
        if (serviceData.serviceId) {
          validatedServiceData.serviceId = service._id;
        } else if (serviceData.serviceTemplateId) {
          validatedServiceData.serviceTemplateId = serviceData.serviceTemplateId;
        }
        
        validatedServices.push(validatedServiceData);
      }
    }

    // Create sale with new flow data
    const sale = new Sale({
      clientId: saleData.clientId || validatedPassengers[0]?.clientId, // Use first passenger's client if no client specified
      passengers: validatedPassengers,
      services: validatedServices,
      destination: {
        name: destination.city, // Use city as the destination name
        city: destination.city
      },
      pricingModel: saleData.pricingModel,
      saleCurrency: saleData.saleCurrency,
      exchangeRate: saleData.exchangeRate || null,
      baseCurrency: saleData.baseCurrency || 'USD',
      originalSalePrice: saleData.originalSalePrice || null,
      originalCurrency: saleData.originalCurrency || null,
      notes: saleData.notes || '',
      createdBy: userId,
      // Add cupoId if this is a cupo reservation
      ...(saleData.cupoContext && { cupoId: saleData.cupoContext.cupoId })
    });

    await sale.save();

    // Populate the sale for response
    await sale.populate([
      { path: 'clientId', select: 'name surname email' },
      { path: 'passengers.passengerId', select: 'name surname email' },
      { path: 'services.serviceId', select: 'name destino description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'createdBy', select: 'username email role' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: { sale }
    });

  } catch (error) {
    console.error('Create sale new flow error:', error);
    
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
      message: 'Internal server error while creating sale'
    });
  }
};

// POST /api/sales/:id/services - Add service to existing sale
const addServiceToSale = async (req, res) => {
  try {
    const { id } = req.params;
    const serviceData = req.body;
    
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Validate service
    const service = await Service.findById(serviceData.serviceId).populate('typeId', 'name category');
    if (!service) {
      return res.status(404).json({
        success: false,
        message: `Service with ID ${serviceData.serviceId} not found`
      });
    }

    // Validate provider if provided
    if (serviceData.providerId) {
      const provider = await Provider.findById(serviceData.providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider with ID ${serviceData.providerId} not found`
        });
      }
    }

    // Add service to sale
    const newService = {
      serviceId: service._id,
      serviceName: serviceData.serviceName || service.destino,
      priceClient: serviceData.priceClient || 0,
      costProvider: serviceData.costProvider || 0,
      currency: serviceData.currency || sale.saleCurrency,
      quantity: serviceData.quantity || 1,
      serviceDates: {
        startDate: serviceData.serviceDates?.startDate || new Date(),
        endDate: serviceData.serviceDates?.endDate || new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      providerId: serviceData.providerId || service.providerId,
      notes: serviceData.notes || ''
    };

    sale.services.push(newService);
    await sale.save();

    // Populate the updated sale
    await sale.populate([
      { path: 'clientId', select: 'name surname email' },
      { path: 'passengers.passengerId', select: 'name surname email' },
      { path: 'services.serviceId', select: 'name destino description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'createdBy', select: 'username email role' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Service added to sale successfully',
      data: { sale }
    });

  } catch (error) {
    console.error('Add service to sale error:', error);
    
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
      message: 'Internal server error while adding service to sale'
    });
  }
};

// POST /api/sales/:id/services-from-template - Add service from template to existing sale
const addServiceFromTemplateToSale = async (req, res) => {
  try {
    const { id } = req.params;
    const serviceData = req.body;
    
    // Validate required fields
    const requiredFields = ['serviceTemplateId', 'checkIn', 'checkOut', 'cost', 'providerId'];
    const missingFields = requiredFields.filter(field => !serviceData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }
    
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Validate service template
    const serviceTemplate = await ServiceTemplate.findById(serviceData.serviceTemplateId);
    if (!serviceTemplate) {
      return res.status(404).json({
        success: false,
        message: `Service template with ID ${serviceData.serviceTemplateId} not found`
      });
    }

    // Validate provider
    const provider = await Provider.findById(serviceData.providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Provider with ID ${serviceData.providerId} not found`
      });
    }

    // Create new service from template
    const newService = {
      serviceTemplateId: serviceTemplate._id,
      serviceName: serviceData.serviceName || serviceTemplate.name, // Use template name as fallback
      priceClient: parseFloat(serviceData.cost),
      costProvider: parseFloat(serviceData.cost) * 0.8, // Assuming 20% markup
      currency: serviceData.currency || 'USD',
      quantity: 1,
      serviceDates: {
        startDate: new Date(serviceData.checkIn),
        endDate: new Date(serviceData.checkOut)
      },
      providerId: provider._id,
      notes: serviceData.notes || `Service from template: ${serviceTemplate.name}`
    };

    sale.services.push(newService);
    await sale.save();

    // Populate the updated sale
    await sale.populate([
      { path: 'clientId', select: 'name surname email' },
      { path: 'createdBy', select: 'username email' },
      { path: 'services.serviceTemplateId', select: 'name category' },
      { path: 'services.providerId', select: 'name type' }
    ]);

    // Create a response object with populated data for the new service
    const populatedService = {
      _id: newService._id || sale.services[sale.services.length - 1]._id,
      serviceTemplateId: {
        _id: serviceTemplate._id,
        name: serviceTemplate.name,
        category: serviceTemplate.category
      },
      serviceName: newService.serviceName,
      priceClient: newService.priceClient,
      costProvider: newService.costProvider,
      currency: newService.currency,
      quantity: newService.quantity,
      serviceDates: newService.serviceDates,
      providerId: {
        _id: provider._id,
        name: provider.name
      },
      notes: newService.notes,
      // Include destination data from the request
      destination: {
        city: serviceData.destination?.city || ''
      }
    };

    res.status(200).json({
      success: true,
      message: 'Service added to sale successfully',
      data: {
        service: populatedService,
        sale: sale
      }
    });
    
  } catch (error) {
    console.error('Error adding service from template to sale:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding service to sale'
    });
  }
};

// POST /api/sales/service-template-flow - Create a sale with service template instances
const createSaleServiceTemplateFlow = async (req, res) => {
  console.log('🔥 Backend createSaleServiceTemplateFlow function called!');
  try {
    const saleData = req.body;
    const userId = req.user.id;
    
    console.log('🔍 Backend received saleData:', JSON.stringify(saleData, null, 2));
    console.log('🌍 Backend destination data:', saleData.destination);
    
    // Validate required fields
    if (!saleData.serviceTemplateInstances || saleData.serviceTemplateInstances.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service template instance is required'
      });
    }

    if (!saleData.passengers || saleData.passengers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one passenger is required'
      });
    }

    // Validate passengers
    const validatedPassengers = [];
    for (const passengerData of saleData.passengers) {
      const isMainClient = passengerData.type === 'main_passenger';
      
      // Create passengerId object with all the passenger data for proper display
      const passengerIdData = {
        _id: passengerData.clientId,
        name: passengerData.name || '',
        surname: passengerData.surname || '',
        dni: passengerData.dni || '',
        passportNumber: passengerData.passportNumber || null,
        dob: passengerData.dob || null,
        email: passengerData.email || null,
        phone: passengerData.phone || null
      };
      
      validatedPassengers.push({
        clientId: passengerData.clientId,
        passengerId: passengerIdData, // Store as object for proper display
        name: passengerData.name || '',
        surname: passengerData.surname || '',
        dni: passengerData.dni || '',
        passportNumber: passengerData.passportNumber || null,
        dob: passengerData.dob || null,
        email: passengerData.email || null,
        phone: passengerData.phone || null,
        type: passengerData.type || 'main_passenger',
        price: passengerData.price || 0,
        notes: passengerData.notes || '',
        isMainClient: isMainClient
      });
    }

    // Fetch cupo currency if this is a cupo reservation (before processing service instances)
    let cupoCurrency = null;
    if (saleData.cupoContext) {
      try {
        const Cupo = require('../models/Cupo');
        const cupo = await Cupo.findById(saleData.cupoContext.cupoId);
        
        if (cupo) {
          cupoCurrency = cupo.metadata.currency || 'USD';
          console.log(`🔄 Fetched cupo currency for service template processing: ${cupoCurrency}`);
        }
      } catch (error) {
        console.error('Error fetching cupo currency:', error);
      }
    }

    // Override currencies in service template instances if this is a cupo reservation
    if (saleData.cupoContext && cupoCurrency) {
      console.log(`🔄 Overriding currencies in service template instances to use cupo currency: ${cupoCurrency}`);
      saleData.serviceTemplateInstances = saleData.serviceTemplateInstances.map(instance => ({
        ...instance,
        currency: cupoCurrency, // Override instance currency
        originalCurrency: cupoCurrency, // Override original currency
        providers: instance.providers ? instance.providers.map(provider => ({
          ...provider,
          currency: cupoCurrency // Override provider currency
        })) : instance.providers
      }));
    }

    // Validate and process service template instances
    const validatedServices = [];
    for (const instance of saleData.serviceTemplateInstances) {
      console.log('🔍 Processing service template instance:', {
        templateName: instance.templateName,
        templateCategory: instance.templateCategory,
        serviceInfo: instance.serviceInfo,
        provider: instance.provider
      });
      
      // Validate required fields
      if (!instance.serviceInfo) {
        return res.status(400).json({
          success: false,
          message: 'Service info is required for all service template instances'
        });
      }
      
      if (!instance.provider || !instance.provider.providerId) {
        return res.status(400).json({
          success: false,
          message: 'Provider ID is required for all service template instances'
        });
      }
      
      // Find or use the service type
      let serviceTypeId = null;
      
      // First, check if serviceTypeId is provided directly (for service type-based flow)
      if (instance.serviceTypeId) {
        serviceTypeId = instance.serviceTypeId;
      } 
      // Otherwise, look up by templateCategory (for template-based flow)
      else if (instance.templateCategory) {
        let serviceType = await ServiceType.findOne({ name: instance.templateCategory });
        if (!serviceType) {
          // Create a new service type if it doesn't exist
          serviceType = new ServiceType({
            name: instance.templateCategory,
            category: 'Other',
            createdBy: userId
          });
          await serviceType.save();
        }
        serviceTypeId = serviceType._id;
      }

      // Create a service from the template instance
      const service = new Service({
        name: instance.serviceName || instance.templateName || 'Service',
        destino: instance.serviceInfo,
        typeId: serviceTypeId,
        description: instance.serviceInfo, // Store just the service info as description
        providerId: instance.provider.providerId,
        sellingPrice: instance.cost,
        baseCurrency: instance.currency,
        location: {
          city: instance.destination?.city || ''
        },
        createdBy: userId
      });
      
      await service.save();
      
      // Populate the typeId for proper service type information
      await service.populate('typeId', 'name category');

      // Process providers specific to this service instance
      const serviceProviders = [];
      if (instance.providers && instance.providers.length > 0) {
        // Use the specific providers assigned to this service instance
        for (const providerData of instance.providers) {
          // Find provider documents for this provider
          const providerDocuments = [];
          if (providerData.documents && providerData.documents.length > 0) {
            providerDocuments.push(...providerData.documents);
          }

          serviceProviders.push({
            providerId: providerData.providerId || providerData._id,
            serviceProviderId: providerData.providerId || providerData._id,
            costProvider: providerData.costProvider || providerData.cost || instance.cost,
            currency: providerData.currency || instance.currency,
            startDate: providerData.startDate ? new Date(providerData.startDate) : new Date(instance.checkIn),
            endDate: providerData.endDate ? new Date(providerData.endDate) : new Date(instance.checkOut),
            documents: providerDocuments
          });
        }
      } else {
        // Fallback to single provider if no providers array
        const providerDocuments = [];
        serviceProviders.push({
          providerId: instance.provider.providerId,
          serviceProviderId: instance.provider.providerId,
          costProvider: instance.cost, // Use actual service cost
          currency: instance.currency,
          startDate: new Date(instance.checkIn),
          endDate: new Date(instance.checkOut),
          documents: providerDocuments
        });
      }

      // Add to validated services with all providers
      validatedServices.push({
        serviceId: service._id,
        serviceName: instance.serviceName || instance.serviceInfo, // Use serviceName if provided, fallback to serviceInfo
        serviceTypeName: instance.serviceTypeName || (service.typeId && service.typeId.name) || 'General', // Store service type name from populated typeId
        priceClient: instance.cost,
        costProvider: instance.cost, // Use the actual service cost entered by user
        currency: instance.currency,
        quantity: 1,
        serviceDates: {
          startDate: new Date(instance.checkIn),
          endDate: new Date(instance.checkOut)
        },
        providerId: instance.provider.providerId,
        notes: `Service: ${instance.templateName} - ${instance.serviceInfo}`,
        // Add all providers with documents
        providers: serviceProviders
      });
    }

    // Validate destination data
    const destinationData = {
      name: saleData.destination?.name || 
            (saleData.destination?.city ? 
              saleData.destination.city : 
              'Unknown Destination'),
      city: saleData.destination?.city || 
            (saleData.serviceTemplateInstances?.[0]?.destination?.city) || 
            'Unknown City'
    };

    console.log('🌍 Final destination data:', destinationData);

    // Handle cupo seat reservation if this is a cupo reservation
    if (saleData.cupoContext) {
      const { cupoId, seatsToReserve, availableSeats } = saleData.cupoContext;
      
      // Validate seat availability
      if (seatsToReserve > availableSeats) {
        return res.status(400).json({
          success: false,
          message: `Not enough seats available. Requested: ${seatsToReserve}, Available: ${availableSeats}`
        });
      }
      
      // Reserve seats in the cupo (currency was already fetched earlier)
      try {
        const Cupo = require('../models/Cupo');
        const cupo = await Cupo.findById(cupoId);
        
        if (!cupo) {
          return res.status(404).json({
            success: false,
            message: 'Cupo not found'
          });
        }
        
        // Currency was already fetched earlier for service template processing
        // cupoCurrency is already set above
        
        const updatedCupo = await Cupo.reserveSeats(cupoId, seatsToReserve);
        
        if (!updatedCupo) {
          return res.status(404).json({
            success: false,
            message: 'Cupo not found or seats could not be reserved'
          });
        }
        
        console.log(`✅ Reserved ${seatsToReserve} seats in cupo ${cupoId} with currency ${cupoCurrency}`);
      } catch (cupoError) {
        console.error('Error reserving cupo seats:', cupoError);
        return res.status(400).json({
          success: false,
          message: 'Failed to reserve seats in cupo'
        });
      }
    }

    // Calculate original currency values
    // For originalSalePrice, use the passenger prices (from saleData.originalSalePrice)
    const originalSalePrice = saleData.originalSalePrice || 0;
    
    // For originalCost, sum up the actual provider costs from service template instances
    const originalCost = saleData.serviceTemplateInstances.reduce((total, instance) => {
      if (instance.providers && instance.providers.length > 0) {
        // Sum up all provider costs in this service
        const serviceCost = instance.providers.reduce((serviceTotal, provider) => {
          return serviceTotal + (provider.costProvider || 0);
        }, 0);
        return total + serviceCost;
      } else {
        // Fallback to instance cost if no providers
        return total + (instance.cost || 0);
      }
    }, 0);
    
    const originalProfit = originalSalePrice - originalCost;
    const originalCurrency = saleData.originalCurrency || saleData.serviceTemplateInstances[0]?.originalCurrency || 'USD';
    const exchangeRate = saleData.exchangeRate || saleData.serviceTemplateInstances[0]?.exchangeRate || 1;

    // Debug logging
    console.log('🔍 Backend received saleData:', {
      saleCurrency: saleData.saleCurrency,
      originalCurrency: saleData.originalCurrency,
      exchangeRate: saleData.exchangeRate,
      serviceTemplateInstances: saleData.serviceTemplateInstances.map(s => ({
        originalCurrency: s.originalCurrency,
        originalAmount: s.originalAmount,
        exchangeRate: s.exchangeRate
      }))
    });

    // Create sale
    const sale = new Sale({
      clientId: validatedPassengers[0]?.clientId,
      passengers: validatedPassengers,
      services: validatedServices,
      destination: destinationData,
      pricingModel: 'unit',
      saleCurrency: cupoCurrency || saleData.saleCurrency || 'USD', // Use cupo currency if available
      exchangeRate: saleData.exchangeRate || exchangeRate,
      baseCurrency: 'USD',
      originalSalePrice: originalSalePrice,
      originalCost: originalCost,
      originalProfit: originalProfit,
      originalCurrency: cupoCurrency || saleData.originalCurrency || originalCurrency, // Use cupo currency for original currency too
      notes: `Sale with ${saleData.serviceTemplateInstances.length} service template instances${saleData.cupoContext ? ` (Cupo reservation: ${saleData.cupoContext.seatsToReserve} seats)` : ''}`,
      createdBy: userId,
      // Add cupoId if this is a cupo reservation
      ...(saleData.cupoContext && { cupoId: saleData.cupoContext.cupoId })
    });

    await sale.save();

    // Populate the sale for response
    await sale.populate([
      { path: 'clientId', select: 'name surname email' },
      // Note: passengers.passengerId population removed because it's now Mixed type
      { path: 'services.serviceId', select: 'name destino description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'services.providers.providerId', select: 'name email phone' },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Sale created successfully with service template instances',
      data: { sale }
    });

  } catch (error) {
    console.error('Create sale service template flow error:', error);
    
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
      message: 'Internal server error while creating sale'
    });
  }
};

// PATCH /api/sales/:id/service-instance/:instanceId - Update a specific service template instance
const updateServiceTemplateInstance = async (req, res) => {
  try {
    const { id, instanceId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    // Find the sale
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Find the service instance in the sale
    const serviceIndex = sale.services.findIndex(service => 
      service._id.toString() === instanceId || 
      service.serviceId?.toString() === instanceId
    );

    if (serviceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Service instance not found in this sale'
      });
    }

    // Update the specific service instance
    const service = sale.services[serviceIndex];
    
    // Update fields based on what's provided
    if (updateData.serviceName !== undefined) {
      service.serviceName = updateData.serviceName;
    }
    if (updateData.serviceInfo !== undefined) {
      service.serviceInfo = updateData.serviceInfo;
    }
    if (updateData.priceClient !== undefined) {
      service.priceClient = updateData.priceClient;
    }
    if (updateData.costProvider !== undefined) {
      service.costProvider = updateData.costProvider;
    }
    if (updateData.currency !== undefined) {
      service.currency = updateData.currency;
    }
    if (updateData.providerId !== undefined) {
      service.providerId = updateData.providerId;
    }
    if (updateData.providers !== undefined) {
      // Update the providers array
      service.providers = updateData.providers;
      console.log('🔧 Backend - Updated providers array:', updateData.providers);
    }
    if (updateData.serviceDates !== undefined) {
      service.serviceDates = updateData.serviceDates;
    }
    if (updateData.notes !== undefined) {
      service.notes = updateData.notes;
    }

    // Note: Individual service destination updates are not supported in the current schema
    // Each service shares the sale-level destination. To change destination for individual services,
    // the database schema would need to be modified to include destination fields in the service objects

    // Recalculate totals
    // Calculate totalSalePrice from passenger prices, not service prices
    let totalSalePrice = 0;
    if (sale.passengers && sale.passengers.length > 0) {
      totalSalePrice = sale.passengers.reduce((total, passenger) => {
        return total + (passenger.price || 0);
      }, 0);
    }
    sale.totalSalePrice = totalSalePrice;
    sale.totalCost = sale.services.reduce((total, s) => total + (s.costProvider || 0), 0);
    sale.profit = sale.totalSalePrice - sale.totalCost;
    sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
    sale.providerBalance = sale.totalProviderPayments - sale.totalCost;

    // Save the sale
    await sale.save();


    // Populate the updated service for response
    await sale.populate([
      { path: 'services.serviceId', select: 'name destino description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'services.providers.providerId', select: 'name email phone' }
    ]);

    res.json({
      success: true,
      message: 'Service instance updated successfully',
      data: { 
        sale,
        updatedService: sale.services[serviceIndex]
      }
    });

  } catch (error) {
    console.error('Update service template instance error:', error);
    
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
      message: 'Internal server error while updating service instance'
    });
  }
};

// DELETE /api/sales/:id/service-instance/:instanceId - Remove a specific service template instance
const removeServiceTemplateInstance = async (req, res) => {
  try {
    const { id, instanceId } = req.params;
    const userId = req.user.id;

    // Find the sale
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Find and remove the service instance
    const initialLength = sale.services.length;
    sale.services = sale.services.filter(service => 
      service._id.toString() !== instanceId && 
      service.serviceId?.toString() !== instanceId
    );

    if (sale.services.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Service instance not found in this sale'
      });
    }

    // Recalculate totals
    // Calculate totalSalePrice from passenger prices, not service prices
    let totalSalePrice = 0;
    if (sale.passengers && sale.passengers.length > 0) {
      totalSalePrice = sale.passengers.reduce((total, passenger) => {
        return total + (passenger.price || 0);
      }, 0);
    }
    sale.totalSalePrice = totalSalePrice;
    sale.totalCost = sale.services.reduce((total, s) => total + (s.costProvider || 0), 0);
    sale.profit = sale.totalSalePrice - sale.totalCost;
    sale.clientBalance = sale.totalSalePrice - sale.totalClientPayments;
    sale.providerBalance = sale.totalProviderPayments - sale.totalCost;

    // Save the sale
    await sale.save();

    res.json({
      success: true,
      message: 'Service instance removed successfully',
      data: { sale }
    });

  } catch (error) {
    console.error('Remove service template instance error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while removing service instance'
    });
  }
};

// GET /api/sales/currency-stats - Get comprehensive multi-currency statistics
const getCurrencyStats = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'currency' } = req.query;
    
    const matchQuery = {};
    
    // Apply ownership filter (set by filterByOwnership middleware)
    if (req.ownershipFilter) {
      Object.assign(matchQuery, req.ownershipFilter);
    } else {
      matchQuery.createdBy = new mongoose.Types.ObjectId(req.user.id);
    }
    
    // Ensure createdBy is always an ObjectId
    if (matchQuery.createdBy && typeof matchQuery.createdBy === 'string') {
      matchQuery.createdBy = new mongoose.Types.ObjectId(matchQuery.createdBy);
    }
    
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Get detailed breakdown by currency
    const currencyBreakdown = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$saleCurrency',
          saleCount: { $sum: 1 },
          // Original currency values (actual sale amounts in their currency)
          totalSalesInCurrency: { $sum: '$totalSalePrice' },
          totalCostInCurrency: { $sum: '$totalCost' },
          totalProfitInCurrency: { $sum: '$profit' },
          totalClientBalanceInCurrency: { $sum: '$clientBalance' },
          totalProviderBalanceInCurrency: { $sum: '$providerBalance' },
          totalClientPaymentsInCurrency: { $sum: '$totalClientPayments' },
          totalProviderPaymentsInCurrency: { $sum: '$totalProviderPayments' },
          // Average values
          avgSalePrice: { $avg: '$totalSalePrice' },
          avgProfit: { $avg: '$profit' },
          avgProfitMargin: { 
            $avg: { 
              $cond: [
                { $gt: ['$totalSalePrice', 0] },
                { $multiply: [{ $divide: ['$profit', '$totalSalePrice'] }, 100] },
                0
              ]
            }
          }
        }
      },
      { $sort: { totalSalesInCurrency: -1 } }
    ]);

    // Calculate combined totals (note: mixing currencies without conversion)
    const totalStats = currencyBreakdown.reduce((acc, curr) => ({
      totalSales: acc.totalSales + curr.saleCount,
      totalRevenue: acc.totalRevenue + curr.totalSalesInCurrency,
      totalCost: acc.totalCost + curr.totalCostInCurrency,
      totalProfit: acc.totalProfit + curr.totalProfitInCurrency,
      totalClientBalance: acc.totalClientBalance + curr.totalClientBalanceInCurrency,
      totalProviderBalance: acc.totalProviderBalance + curr.totalProviderBalanceInCurrency
    }), {
      totalSales: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      totalClientBalance: 0,
      totalProviderBalance: 0
    });

    // Get time-series data by currency (monthly breakdown)
    const timeSeriesData = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            currency: '$saleCurrency',
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalSales: { $sum: '$totalSalePrice' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { 
        $sort: { 
          '_id.year': 1, 
          '_id.month': 1,
          '_id.currency': 1
        } 
      }
    ]);

    res.json({
      success: true,
      data: {
        currencyBreakdown,
        totalStats,
        timeSeriesData,
        filters: {
          startDate,
          endDate,
          groupBy
        }
      }
    });

  } catch (error) {
    console.error('Get currency stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching currency statistics'
    });
  }
};

// GET /api/sales/available-quotas - Get available quotas for filtering
const getAvailableQuotas = async (req, res) => {
  try {
    // Get all quotas that have been used in sales
    const usedQuotas = await Sale.distinct('cupoId', { cupoId: { $exists: true } });
    
    // Get quota details for the used quotas
    const quotas = await Cupo.find({ 
      _id: { $in: usedQuotas } 
    })
    .populate('serviceId', 'destino type')
    .select('serviceId metadata status totalSeats reservedSeats availableSeats')
    .sort({ 'metadata.date': -1 });

    // Format quotas for dropdown
    const formattedQuotas = quotas.map(quota => ({
      _id: quota._id,
      name: `${quota.serviceId?.destino || 'Unknown Service'} - ${quota.metadata?.date?.toLocaleDateString() || 'No Date'}`,
      service: quota.serviceId?.destino || 'Unknown Service',
      date: quota.metadata?.date || null,
      status: quota.status,
      totalSeats: quota.totalSeats,
      reservedSeats: quota.reservedSeats,
      availableSeats: quota.availableSeats
    }));

    res.json({
      success: true,
      data: formattedQuotas
    });

  } catch (error) {
    console.error('Get available quotas error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching available quotas'
    });
  }
};

// PUT /api/sales/:id/check-status - Check and update sale status based on balances
const checkSaleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Check and update status
    const statusUpdate = await sale.checkAndUpdateStatus();
    
    // Populate the updated sale for response
    await sale.populate([
      { path: 'clientId', select: 'name surname email phone' },
      { path: 'passengers.passengerId', select: 'name surname dob passportNumber' },
      { path: 'services.serviceId', select: 'name title description type' },
      { path: 'services.providerId', select: 'name type' },
      { path: 'services.providers.providerId', select: 'name email phone' },
      { path: 'createdBy', select: 'username email role' }
    ]);

    res.json({
      success: true,
      message: statusUpdate.statusChanged 
        ? `Sale status updated from ${statusUpdate.previousStatus} to ${statusUpdate.newStatus}`
        : 'Sale status is up to date',
      data: { 
        sale,
        statusUpdate
      }
    });

  } catch (error) {
    console.error('Check sale status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while checking sale status'
    });
  }
};

// GET /api/sales/search - Search sales by passenger information
const searchSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = ''
    } = req.query;
    
    const query = {};
    
    // Apply ownership filter (set by filterByOwnership middleware)
    if (req.ownershipFilter) {
      Object.assign(query, req.ownershipFilter);
    }
    
    // Add search filter for passengers
    if (search) {
      // Clean and prepare search term
      const searchTerm = search.trim();
      console.log('Search term received:', searchTerm);
      console.log('Search term includes space:', searchTerm.includes(' '));
      
      // First, find clients that match the search criteria
      const Client = require('../models/Client');
      
      // Build search conditions for clients
      const clientSearchConditions = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { surname: { $regex: searchTerm, $options: 'i' } },
        { dni: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { passportNumber: { $regex: searchTerm, $options: 'i' } }
      ];
      
      // If search term contains spaces, also search for full name combinations
      if (searchTerm.includes(' ')) {
        const nameParts = searchTerm.split(/\s+/);
        if (nameParts.length >= 2) {
          // Search for first name + last name combination
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          
          clientSearchConditions.push({
            $and: [
              { name: { $regex: firstName, $options: 'i' } },
              { surname: { $regex: lastName, $options: 'i' } }
            ]
          });
          
          // Also try reverse order (last name + first name)
          clientSearchConditions.push({
            $and: [
              { name: { $regex: lastName, $options: 'i' } },
              { surname: { $regex: firstName, $options: 'i' } }
            ]
          });
        }
      }
      
      const matchingClients = await Client.find({
        $or: clientSearchConditions
      }).select('_id');

      const matchingClientIds = matchingClients.map(client => client._id);
      console.log('Matching clients found:', matchingClientIds.length);

      // Also search in passenger data (for companions)
      const Passenger = require('../models/Passenger');
      
      // Build search conditions for passengers
      const passengerSearchConditions = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { surname: { $regex: searchTerm, $options: 'i' } },
        { dni: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { passportNumber: { $regex: searchTerm, $options: 'i' } }
      ];
      
      // If search term contains spaces, also search for full name combinations
      if (searchTerm.includes(' ')) {
        const nameParts = searchTerm.split(/\s+/);
        if (nameParts.length >= 2) {
          // Search for first name + last name combination
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          
          passengerSearchConditions.push({
            $and: [
              { name: { $regex: firstName, $options: 'i' } },
              { surname: { $regex: lastName, $options: 'i' } }
            ]
          });
          
          // Also try reverse order (last name + first name)
          passengerSearchConditions.push({
            $and: [
              { name: { $regex: lastName, $options: 'i' } },
              { surname: { $regex: firstName, $options: 'i' } }
            ]
          });
        }
      }
      
      const matchingPassengers = await Passenger.find({
        $or: passengerSearchConditions
      }).select('_id');

      const matchingPassengerIds = matchingPassengers.map(passenger => passenger._id);

      // Build search conditions for sales
      const searchConditions = [];

      // Add condition for matching main clients
      if (matchingClientIds.length > 0) {
        searchConditions.push({ clientId: { $in: matchingClientIds } });
      }

      // Add condition for matching companions (ObjectId references)
      if (matchingPassengerIds.length > 0) {
        searchConditions.push({ 'passengers.passengerId': { $in: matchingPassengerIds } });
      }

      // Add condition for embedded passenger data (when passengerId is an object with passenger info)
      searchConditions.push({
        $or: [
          { 'passengers.passengerId.name': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.surname': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.dni': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.email': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.phone': { $regex: searchTerm, $options: 'i' } },
          { 'passengers.passengerId.passportNumber': { $regex: searchTerm, $options: 'i' } }
        ]
      });

      // Apply search conditions
      if (searchConditions.length > 0) {
        query.$or = searchConditions;
      }
    }

    const sales = await Sale.find(query)
      .populate([
        { path: 'clientId', select: 'name surname email dni phone passportNumber' },
        { path: 'createdBy', select: 'username email fullName' },
        { path: 'services.serviceId', select: 'name destino type' },
        { path: 'services.providerId', select: 'name type' },
        { path: 'services.providers.providerId', select: 'name type' },
        { 
          path: 'passengers.passengerId', 
          select: 'name surname email dni phone passportNumber',
          populate: {
            path: 'clientId',
            select: 'name surname'
          }
        },
        { 
          path: 'cupoId', 
          select: 'serviceId metadata totalSeats reservedSeats availableSeats status',
          populate: {
            path: 'serviceId',
            select: 'destino type'
          }
        }
      ])
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Sale.countDocuments(query);
    const pages = Math.ceil(total / limit);

    console.log('Search query:', JSON.stringify(query, null, 2));
    console.log('Total sales found:', total);

    res.json({
      success: true,
      data: {
        sales,
        total,
        pages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Search sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching sales'
    });
  }
};

module.exports = {
  createSale,
  createSaleNewFlow,
  createSaleServiceTemplateFlow,
  updateServiceTemplateInstance,
  removeServiceTemplateInstance,
  addServiceToSale,
  addServiceFromTemplateToSale,
  getSale,
  getAllSales,
  getVendorSales,
  updateSale,
  deleteSale,
  uploadDocuments,
  uploadTempDocuments,
  getSaleDocuments,
  getSalesStats,
  getCurrencyStats,
  getSellerMonthlyStats,
  getSellerMonthlySales,
  getAvailableQuotas,
  checkSaleStatus,
  searchSales
};