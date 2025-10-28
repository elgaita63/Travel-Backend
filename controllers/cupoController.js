const mongoose = require('mongoose');
const Cupo = require('../models/Cupo');
const Service = require('../models/Service');
const Sale = require('../models/Sale');
const Client = require('../models/Client');
const Passenger = require('../models/Passenger');
const Provider = require('../models/Provider');

// Helper function to clean metadata by removing empty strings
const cleanMetadata = (metadata) => {
  if (!metadata) return metadata;
  
  const cleaned = { ...metadata };
  if (cleaned.flightClass === '') {
    delete cleaned.flightClass;
  }
  if (cleaned.roomType === '') {
    delete cleaned.roomType;
  }
  if (cleaned.providerRef === '') {
    delete cleaned.providerRef;
  }
  if (cleaned.notes === '') {
    delete cleaned.notes;
  }
  return cleaned;
};

// POST /api/cupos - Create a new cupo
const createCupo = async (req, res) => {
  try {
    const cupoData = req.body;
    const userId = req.user.id;
    
    // Validate required fields - support both serviceId and serviceTemplateId
    const requiredFields = ['totalSeats', 'metadata'];
    const missingFields = requiredFields.filter(field => !cupoData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if serviceTemplateId or serviceId is provided
    if (!cupoData.serviceTemplateId && !cupoData.serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Either serviceTemplateId or serviceId is required'
      });
    }

    let service;
    let serviceId;

    // Handle serviceTemplateId (new approach)
    if (cupoData.serviceTemplateId) {
      const ServiceTemplate = require('../models/ServiceTemplate');
      const serviceTemplate = await ServiceTemplate.findById(cupoData.serviceTemplateId);
      
      if (!serviceTemplate) {
        return res.status(404).json({
          success: false,
          message: 'Service template not found'
        });
      }

      // Create a service from the template if it doesn't exist
      // Validate provider if provided
      let providerId = cupoData.providerId;
      if (!providerId) {
        return res.status(400).json({
          success: false,
          message: 'Provider is required when creating cupo from service template'
        });
      }

      // Verify provider exists
      const provider = await Provider.findById(providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }

      // Create service from template
      service = new Service({
        destino: serviceTemplate.name,
        type: serviceTemplate.category || 'General',
        description: serviceTemplate.description || serviceTemplate.name,
        providerId: providerId,
        sellingPrice: 0, // Will be set when pricing is determined
        baseCurrency: 'USD',
        createdBy: userId
      });
      
      await service.save();
      serviceId = service._id;
      
      // Remove serviceTemplateId and providerId from cupoData as we'll store serviceId
      delete cupoData.serviceTemplateId;
      delete cupoData.providerId;
    } else {
      // Handle legacy serviceId approach
      service = await Service.findById(cupoData.serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      serviceId = cupoData.serviceId;
    }

    // Validate metadata
    if (!cupoData.metadata.date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required in metadata'
      });
    }

    if (!cupoData.metadata.completionDate) {
      return res.status(400).json({
        success: false,
        message: 'Completion date is required in metadata'
      });
    }

    // Validate completion date is after start date
    const startDate = new Date(cupoData.metadata.date);
    const completionDate = new Date(cupoData.metadata.completionDate);
    if (completionDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'Completion date must be after the start date'
      });
    }

    // Clean up metadata - remove empty strings for optional fields
    const cleanedMetadata = cleanMetadata(cupoData.metadata);

    // Create cupo
    const cupo = new Cupo({
      ...cupoData,
      serviceId: serviceId, // Use the determined serviceId
      metadata: cleanedMetadata,
      createdBy: userId,
      availableSeats: cupoData.totalSeats // Will be calculated in pre-save middleware
    });

    await cupo.save();

    // Populate service information for response
    await cupo.populate([
      { 
        path: 'serviceId', 
        select: 'destino description type typeId providerId sellingPrice baseCurrency',
        populate: [
          {
            path: 'providerId',
            select: 'name type'
          },
          {
            path: 'typeId',
            select: 'name description'
          }
        ]
      },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Cupo created successfully',
      data: { cupo }
    });

  } catch (error) {
    console.error('Create cupo error:', error);
    
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
      message: 'Internal server error while creating cupo'
    });
  }
};

// GET /api/cupos - Get all cupos with filtering
const getAllCupos = async (req, res) => {
  try {
    const { 
      serviceId, 
      date, 
      completionDate,
      status, 
      minAvailableSeats,
      page = 1, 
      limit = 10 
    } = req.query;
    
    const query = {};
    
    if (serviceId) {
      // Validate that serviceId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(serviceId)) {
        query.serviceId = serviceId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid serviceId format. Must be a valid ObjectId.'
        });
      }
    }
    
    if (date) {
      query['metadata.date'] = new Date(date);
    }
    
    if (completionDate) {
      query['metadata.completionDate'] = new Date(completionDate);
    }
    
    if (status) {
      query.status = status;
    }
    
    if (minAvailableSeats) {
      query.availableSeats = { $gte: parseInt(minAvailableSeats) };
    }

    const cupos = await Cupo.find(query)
      .populate([
        { 
          path: 'serviceId', 
          select: 'destino description type typeId providerId sellingPrice baseCurrency',
          populate: [
            {
              path: 'providerId',
              select: 'name type'
            },
            {
              path: 'typeId',
              select: 'name description'
            }
          ]
        },
        { path: 'createdBy', select: 'username email' }
      ])
      .sort({ 'metadata.date': 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);


    const total = await Cupo.countDocuments(query);

    res.json({
      success: true,
      data: {
        cupos,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all cupos error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching cupos'
    });
  }
};

// GET /api/cupos/:id - Get cupo by ID
const getCupo = async (req, res) => {
  try {
    const { id } = req.params;
    
    const cupo = await Cupo.findById(id)
      .populate([
        { 
          path: 'serviceId', 
          select: 'destino description type typeId providerId sellingPrice baseCurrency',
          populate: [
            {
              path: 'providerId',
              select: 'name type contactInfo'
            },
            {
              path: 'typeId',
              select: 'name description'
            }
          ]
        },
        { path: 'createdBy', select: 'username email' }
      ]);
    
    if (!cupo) {
      return res.status(404).json({
        success: false,
        message: 'Cupo not found'
      });
    }

    res.json({
      success: true,
      data: { cupo }
    });

  } catch (error) {
    console.error('Get cupo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching cupo'
    });
  }
};

// PUT /api/cupos/:id - Update cupo
const updateCupo = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Clean up metadata - remove empty strings for optional fields
    if (updateData.metadata) {
      updateData.metadata = cleanMetadata(updateData.metadata);
    }

    // Find the cupo first
    const cupo = await Cupo.findById(id);
    if (!cupo) {
      return res.status(404).json({
        success: false,
        message: 'Cupo not found'
      });
    }

    // Update the cupo fields
    Object.assign(cupo, updateData);
    
    // Save the cupo to trigger pre-save middleware for availableSeats calculation
    await cupo.save();

    // Populate the updated cupo for response
    await cupo.populate([
      { 
        path: 'serviceId', 
        select: 'destino description type typeId providerId sellingPrice baseCurrency',
        populate: [
          {
            path: 'providerId',
            select: 'name type contactInfo'
          },
          {
            path: 'typeId',
            select: 'name description'
          }
        ]
      },
      { path: 'createdBy', select: 'username email' }
    ]);

    res.json({
      success: true,
      message: 'Cupo updated successfully',
      data: { cupo }
    });

  } catch (error) {
    console.error('Update cupo error:', error);
    
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
      message: 'Internal server error while updating cupo'
    });
  }
};

// DELETE /api/cupos/:id - Delete cupo
const deleteCupo = async (req, res) => {
  try {
    const { id } = req.params;

    const cupo = await Cupo.findByIdAndDelete(id);
    if (!cupo) {
      return res.status(404).json({
        success: false,
        message: 'Cupo not found'
      });
    }

    res.json({
      success: true,
      message: 'Cupo deleted successfully'
    });

  } catch (error) {
    console.error('Delete cupo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting cupo'
    });
  }
};

// PUT /api/cupos/:id/reserve - Reserve seats atomically
const reserveSeats = async (req, res) => {
  try {
    const { id } = req.params;
    const { seatsToReserve, clientId, passengers, services, paymentMethod } = req.body;
    const userId = req.user.id;

    console.log('Reserve seats request data:', {
      id,
      seatsToReserve,
      clientId,
      passengers: typeof passengers,
      services: typeof services,
      paymentMethod,
      files: req.files ? req.files.length : 0
    });

    // Parse JSON fields if they're strings (from FormData)
    let parsedPassengers = [];
    let parsedServices = [];
    
    try {
      parsedPassengers = typeof passengers === 'string' ? JSON.parse(passengers) : (passengers || []);
    } catch (error) {
      console.error('Error parsing passengers:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid passengers data format'
      });
    }
    
    try {
      parsedServices = typeof services === 'string' ? JSON.parse(services) : (services || []);
    } catch (error) {
      console.error('Error parsing services:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid services data format'
      });
    }

    if (!seatsToReserve || seatsToReserve <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid number of seats to reserve'
      });
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    // Get cupo details first
    const cupo = await Cupo.findById(id)
      .populate([
        { 
          path: 'serviceId', 
          select: 'destino description type providerId sellingPrice baseCurrency',
          populate: {
            path: 'providerId',
            select: 'name type'
          }
        }
      ]);

    if (!cupo) {
      return res.status(404).json({
        success: false,
        message: 'Cupo not found'
      });
    }

    // Atomically reserve seats
    const updatedCupo = await Cupo.reserveSeats(id, seatsToReserve);

    // Create sale if clientId is provided
    let saleData = null;
    if (clientId) {
      try {
        // Use services from frontend if provided, otherwise create from cupo
        let servicesToUse = parsedServices || [];
        
        // If no services provided from frontend, create from cupo
        if (servicesToUse.length === 0) {
          if (!cupo.serviceId || !cupo.serviceId._id) {
            throw new Error('Service data is missing from cupo');
          }
          
          if (!cupo.serviceId.providerId || !cupo.serviceId.providerId._id) {
            throw new Error('Provider data is missing from service');
          }

          const sellingPrice = cupo.serviceId.sellingPrice || 0;
          // Use cupo's currency instead of service's base currency
          const cupoCurrency = cupo.metadata.currency || 'USD';
          
          servicesToUse = [{
            serviceId: cupo.serviceId._id.toString(),
            providerId: cupo.serviceId.providerId._id.toString(),
            serviceName: cupo.serviceId.destino || cupo.serviceId.title || 'Cupo Service',
            priceClient: sellingPrice,
            costProvider: sellingPrice * 0.8,
            currency: cupoCurrency, // Use cupo's currency
            quantity: seatsToReserve,
            serviceDates: {
              startDate: cupo.metadata.date || new Date(),
              endDate: cupo.metadata.date || new Date()
            }
          }];
        } else {
          // Filter out services with U$0 prices (these are likely the cupo service duplicates)
          servicesToUse = servicesToUse.filter(service => 
            service.priceClient > 0 || service.costProvider > 0
          );
          
          // Override all service currencies with cupo's currency
          const cupoCurrency = cupo.metadata.currency || 'USD';
          servicesToUse = servicesToUse.map(service => ({
            ...service,
            currency: cupoCurrency // Force all services to use cupo's currency
          }));
        }

        // Calculate totals for the sale
        const totalSalePrice = servicesToUse.reduce((sum, service) => 
          sum + (service.priceClient * service.quantity), 0
        );
        const totalCost = servicesToUse.reduce((sum, service) => 
          sum + service.costProvider, 0
        );
        const profit = totalSalePrice - totalCost;

        saleData = {
          clientId: clientId,
          passengers: parsedPassengers || [],
          services: servicesToUse,
          destination: {
            name: cupo.serviceId?.destino || 'Unknown Destination',
            country: cupo.serviceId?.location?.country || 'Unknown Country',
            city: cupo.serviceId?.location?.city || 'Unknown City'
          },
          totalSalePrice: totalSalePrice,
          totalCost: totalCost,
          profit: profit,
          saleCurrency: cupoCurrency, // Use cupo's currency for the entire sale
          pricingModel: 'unit', // Required field for new flow
          notes: `Reservation from cupo: ${cupo.serviceId?.destino || 'Unknown Service'} - ${cupo.metadata.date?.toLocaleDateString() || new Date().toLocaleDateString()}`,
          status: 'open',
          paymentMethod: paymentMethod || 'pending',
          cupoId: cupo._id // Link the sale to the quota
        };

        // Handle uploaded invoice files and associate them with services
        const documents = [];
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            // Extract service ID from filename (format: invoice_serviceId)
            const serviceId = file.fieldname.replace('invoice_', '');
            documents.push({
              filename: file.filename,
              originalName: file.originalname,
              path: file.path,
              url: `/uploads/sales/${file.filename}`, // Add required URL field
              mimetype: file.mimetype,
              size: file.size,
              serviceId: serviceId,
              type: 'invoice'
            });
          });
        }

        // Associate documents with their respective services
        const servicesWithDocuments = servicesToUse.map(service => {
          const serviceDocuments = documents.filter(doc => doc.serviceId === service.serviceId);
          return {
            ...service,
            documents: serviceDocuments
          };
        });

        // Fix passenger data - include both main client and companions
        const fixedPassengers = [];
        for (const passenger of parsedPassengers) {
          if (passenger.isMainClient && passenger.clientId) {
            // Handle main client - use client data directly without creating passenger record
            // This prevents duplication in the second stage of the sale wizard
            const client = await Client.findById(passenger.clientId);
            if (!client) {
              throw new Error('Client not found');
            }
            
            // Use the client data directly for the main client
            // This matches the behavior in regular sale creation
            fixedPassengers.push({
              passengerId: {
                _id: client._id,
                name: client.name,
                surname: client.surname,
                email: client.email || 'N/A',
                phone: client.phone || 'N/A',
                passportNumber: client.passportNumber || 'N/A',
                dni: client.dni || ''
              },
              price: passenger.price || 0,
              notes: passenger.notes || '',
              isMainClient: true
            });
          } else {
            // Handle companions
            fixedPassengers.push({
              passengerId: passenger.passengerId,
              price: passenger.price || 0,
              notes: passenger.notes || '',
              isMainClient: false
            });
          }
        }

        // Fix services data - ensure all services have required fields
        const fixedServices = servicesToUse.map(service => {
          const fixedService = {
            serviceId: service.serviceId,
            providerId: service.providerId,
            serviceName: service.serviceName || 'Unknown Service', // Ensure serviceName is present
            priceClient: service.priceClient || 0,
            costProvider: service.costProvider || 0,
            currency: service.currency || 'USD',
            quantity: service.quantity || 1,
            serviceDates: service.serviceDates || {
              startDate: new Date(),
              endDate: new Date()
            }
          };
          
          // Remove invoiceFile from service data as it's handled separately
          delete fixedService.invoiceFile;
          
          return fixedService;
        });

        // Create the sale
        const sale = new Sale({
          ...saleData,
          passengers: fixedPassengers,
          services: servicesWithDocuments,
          documents: documents,
          createdBy: userId
        });

        console.log('Attempting to save sale with data:', saleData);
        await sale.save();
        console.log('Sale created successfully with ID:', sale._id);

        // Populate sale for response
        await sale.populate([
          { path: 'clientId', select: 'name surname email' },
          { path: 'passengers.passengerId', select: 'name surname email' },
          { path: 'services.serviceId', select: 'destino description type' },
          { path: 'services.providerId', select: 'name type' },
          { path: 'createdBy', select: 'username email' }
        ]);

        saleData = sale;
      } catch (saleError) {
        console.error('Error creating sale:', saleError);
        console.error('Sale data that failed:', saleData);
        // Don't fail the reservation if sale creation fails, but log the error
        saleData = null;
      }
    }

    res.json({
      success: true,
      message: 'Seats reserved successfully',
      data: {
        cupo: updatedCupo,
        sale: saleData,
        reservationDetails: {
          seatsReserved: seatsToReserve,
          remainingSeats: updatedCupo.availableSeats,
          service: cupo.serviceId.destino,
          date: cupo.metadata.date
        }
      }
    });

  } catch (error) {
    console.error('Reserve seats error:', error);
    
    if (error.message === 'Insufficient seats available or cupo not found') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while reserving seats'
    });
  }
};

// GET /api/cupos/available - Get available cupos for a service and date
const getAvailableCupos = async (req, res) => {
  try {
    const { serviceId, date, minSeats = 1 } = req.query;
    
    if (!serviceId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and date are required'
      });
    }

    const cupos = await Cupo.findAvailable(serviceId, new Date(date), parseInt(minSeats))
      .populate([
        { path: 'serviceId', select: 'destino description type providerId sellingPrice baseCurrency' },
        { path: 'serviceId.providerId', select: 'name type' }
      ]);

    res.json({
      success: true,
      data: { cupos }
    });

  } catch (error) {
    console.error('Get available cupos error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching available cupos'
    });
  }
};

// GET /api/cupos/calendar - Get cupos grouped by date for calendar view
const getCuposCalendar = async (req, res) => {
  try {
    const { startDate, endDate, serviceId } = req.query;
    
    const query = { status: 'active' };
    
    if (serviceId) {
      query.serviceId = serviceId;
    }
    
    if (startDate && endDate) {
      query['metadata.date'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const cupos = await Cupo.find(query)
      .populate([
        { path: 'serviceId', select: 'destino description type providerId sellingPrice baseCurrency' },
        { path: 'serviceId.providerId', select: 'name type' }
      ])
      .sort({ 'metadata.date': 1 });

    // Group cupos by date
    const calendarData = cupos.reduce((acc, cupo) => {
      const dateKey = cupo.metadata.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(cupo);
      return acc;
    }, {});

    res.json({
      success: true,
      data: { calendarData }
    });

  } catch (error) {
    console.error('Get cupos calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching calendar data'
    });
  }
};

module.exports = {
  createCupo,
  getAllCupos,
  getCupo,
  updateCupo,
  deleteCupo,
  reserveSeats,
  getAvailableCupos,
  getCuposCalendar
};