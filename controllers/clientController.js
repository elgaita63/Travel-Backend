const Client = require('../models/Client');
const Passenger = require('../models/Passenger');
const Sale = require('../models/Sale');
const openaiVisionService = require('../services/openaiVisionService');
const path = require('path');

// POST /api/clients - Create a new client
const createClient = async (req, res) => {
  try {
    const clientData = req.body;
    
    // Add the user ID who created this client
    clientData.createdBy = req.user.id;
    
    // Validate required fields - only name, surname, and dni are required
    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !clientData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if client with same DNI already exists
    const existingClientByDni = await Client.findOne({
      dni: clientData.dni
    });

    if (existingClientByDni) {
      return res.status(409).json({
        success: false,
        message: 'Acompañante with this DNI/CUIT already exists'
      });
    }

    // Check if client with same email already exists (if email is provided)
    if (clientData.email) {
      const existingClientByEmail = await Client.findOne({
        email: clientData.email
      });

      if (existingClientByEmail) {
        return res.status(409).json({
          success: false,
          message: 'Passenger with this email already exists'
        });
      }
    }

    const client = new Client(clientData);
    await client.save();

    res.status(201).json({
      success: true,
      message: 'Passenger created successfully',
      data: { client }
    });

  } catch (error) {
    console.error('Create passenger error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'Duplicate field error';
      
      if (field === 'email') {
        message = 'Passenger with this email already exists';
      } else if (field === 'dni') {
        message = 'Passenger with this DNI/CUIT already exists';
      } else if (field === 'passportNumber') {
        message = 'Passenger with this passport number already exists';
      }
      
      return res.status(409).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating passenger'
    });
  }
};

// GET /api/clients/:clientId - Get client with passengers
const getClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Get only companions for this client (exclude the main client's own passenger record)
    const passengers = await Passenger.find({ 
      clientId,
      relationshipType: 'companion'  // Only get companions, not the main client's own record
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        client,
        passengers
      }
    });

  } catch (error) {
    console.error('Get passenger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passenger'
    });
  }
};

// GET /api/clients - Get all clients (for admin)
const getAllClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', isMainClient } = req.query;
    
    const query = {};
    
    // Filter by main client status if specified
    if (isMainClient !== undefined) {
      query.isMainClient = isMainClient === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { passportNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Client.countDocuments(query);

    res.json({
      success: true,
      data: {
        clients,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all passengers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passengers'
    });
  }
};

// GET /api/clients/with-sales - Get all clients with their sales information
const getAllClientsWithSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', includeNoSales = 'true' } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { passportNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get sales for each client
    const clientsWithSales = await Promise.all(
      clients.map(async (client) => {
        const sales = await Sale.find({ clientId: client._id })
          .populate('services.serviceId', 'title type')
          .populate('services.providerId', 'name')
          .sort({ createdAt: -1 });

        // Calculate total sales amount and profit for this client
        const totalSales = sales.reduce((sum, sale) => sum + (sale.totalSalePrice || 0), 0);
        const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
        const salesCount = sales.length;
        
        // Get the most recent sale
        const latestSale = sales.length > 0 ? sales[0] : null;

        return {
          ...client.toObject(),
          sales,
          salesCount,
          totalSales,
          totalProfit,
          latestSale,
          hasSales: salesCount > 0
        };
      })
    );

    // Filter out clients with no sales if requested
    const filteredClients = includeNoSales === 'true' 
      ? clientsWithSales 
      : clientsWithSales.filter(client => client.hasSales);

    const total = await Client.countDocuments(query);
    const totalWithFilter = includeNoSales === 'true' ? total : clientsWithSales.filter(client => client.hasSales).length;

    res.json({
      success: true,
      data: {
        clients: filteredClients,
        total: totalWithFilter,
        page: parseInt(page),
        pages: Math.ceil(totalWithFilter / limit)
      }
    });

  } catch (error) {
    console.error('Get all passengers with sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passengers with sales'
    });
  }
};

// PUT /api/clients/:clientId - Update client
const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const updateData = req.body;

    const client = await Client.findByIdAndUpdate(
      clientId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Passenger updated successfully',
      data: { client }
    });

  } catch (error) {
    console.error('Update passenger error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'Duplicate field error';
      
      if (field === 'email') {
        message = 'Passenger with this email already exists';
      } else if (field === 'dni') {
        message = 'Passenger with this DNI/CUIT already exists';
      } else if (field === 'passportNumber') {
        message = 'Passenger with this passport number already exists';
      }
      
      return res.status(409).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating client'
    });
  }
};

// DELETE /api/clients/:clientId - Delete client
const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    // Check if client has passengers
    const passengersCount = await Passenger.countDocuments({ clientId });
    if (passengersCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete client with existing passengers. Delete passengers first.'
      });
    }

    const client = await Client.findByIdAndDelete(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting client'
    });
  }
};

// POST /api/clients/ocr - Upload passport image and extract data using OpenAI Vision
const extractPassportData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No passport image uploaded'
      });
    }

    const imagePath = req.file.path;
    console.log('🤖 Processing passport image with OpenAI Vision:', imagePath);

    // Extract data using OpenAI Vision
    const openaiResult = await openaiVisionService.extractDocumentData(imagePath);

    if (!openaiResult.success) {
      return res.status(500).json({
        success: false,
        message: 'OpenAI Vision processing failed',
        error: openaiResult.error
      });
    }

    console.log(`✅ OpenAI Vision extraction successful (confidence: ${openaiResult.confidence}%)`);

    res.json({
      success: true,
      message: 'Passport data extracted successfully',
      data: {
        extractedData: openaiResult.data,
        confidence: openaiResult.confidence,
        imagePath: req.file.filename,
        method: 'openai_vision_api'
      }
    });

  } catch (error) {
    console.error('❌ OpenAI Vision extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OpenAI Vision processing',
      error: error.message
    });
  }
};

// GET /api/clients/:clientId/passport-image - Get passport image
const getPassportImage = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    if (!client.passportImage) {
      return res.status(404).json({
        success: false,
        message: 'No passport image found for this client'
      });
    }

    const imagePath = path.join(__dirname, '../uploads/passports', client.passportImage);
    res.sendFile(imagePath);

  } catch (error) {
    console.error('Get passport image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passport image'
    });
  }
};

// POST /api/clients/bulk - Create client with companions
const createClientWithCompanions = async (req, res) => {
  try {
    const { mainClient, companions = [] } = req.body;
    
    // Validate main client required fields
    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !mainClient[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields for main client: ${missingFields.join(', ')}`
      });
    }

    // Check if main client with same DNI already exists
    const existingClient = await Client.findOne({ dni: mainClient.dni });
    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: 'Passenger with this DNI/CUIT already exists'
      });
    }

    // Validate companions
    for (let i = 0; i < companions.length; i++) {
      const companion = companions[i];
      const companionMissingFields = requiredFields.filter(field => !companion[field]);
      if (companionMissingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields for companion ${i + 1}: ${companionMissingFields.join(', ')}`
        });
      }
      
      // Check if companion with same DNI already exists
      const existingCompanion = await Client.findOne({ dni: companion.dni });
      if (existingCompanion) {
        return res.status(409).json({
          success: false,
          message: `Acompañantes ${i + 1} with DNI/CUIT ${companion.dni} already exists`
        });
      }
    }

    // Create main client
    const mainClientData = {
      ...mainClient,
      createdBy: req.user.id,
      isMainClient: true
    };
    
    const createdMainClient = new Client(mainClientData);
    await createdMainClient.save();

    // Create companions as Passenger records
    const createdCompanions = [];
    for (const companion of companions) {
      const companionData = {
        ...companion,
        clientId: createdMainClient._id, // Link to main client
        mainClientId: createdMainClient._id, // Link to main client for companion queries
        createdBy: req.user.id,
        relationshipType: 'companion'
      };
      
      // Handle DNI uniqueness for passengers
      if (companionData.dni) {
        const existingPassenger = await Passenger.findOne({ dni: companionData.dni });
        if (existingPassenger) {
          return res.status(409).json({
            success: false,
            message: `A passenger with DNI/CUIT ${companionData.dni} already exists`
          });
        }
      }
      
      // Handle passport number uniqueness for passengers
      if (companionData.passportNumber) {
        const existingPassport = await Passenger.findOne({ passportNumber: companionData.passportNumber });
        if (existingPassport) {
          return res.status(409).json({
            success: false,
            message: `A passenger with passport number ${companionData.passportNumber} already exists`
          });
        }
      }
      
      const createdCompanion = new Passenger(companionData);
      await createdCompanion.save();
      createdCompanions.push(createdCompanion);
    }

    res.status(201).json({
      success: true,
      message: 'Client and companions created successfully',
      data: {
        mainClient: createdMainClient,
        companions: createdCompanions
      }
    });

  } catch (error) {
    console.error('Create client with companions error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(409).json({
        success: false,
        message: `A passenger with this ${field} already exists: ${value}`,
        field,
        value
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while creating passenger with acompañantes'
    });
  }
};

// POST /api/clients/:clientId/promote - Promote companion to main client
const promoteCompanionToMain = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // First try to find as a Client record (old structure)
    let companion = await Client.findById(clientId);
    if (companion) {
      if (companion.isMainClient) {
        return res.status(400).json({
          success: false,
          message: 'This client is already a main client'
        });
      }

      // Update companion to be main client
      companion.isMainClient = true;
      companion.mainClientId = null;
      await companion.save();

      return res.json({
        success: true,
        message: 'Companion promoted to main client successfully',
        data: { client: companion }
      });
    }

    // If not found as Client, try as Passenger record (new structure)
    const passenger = await Passenger.findById(clientId);
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found'
      });
    }

    if (passenger.relationshipType !== 'companion') {
      return res.status(400).json({
        success: false,
        message: 'This passenger is not a companion'
      });
    }

    // Debug passenger data
    console.log('Passenger data:', JSON.stringify(passenger, null, 2));
    console.log('Passenger email type:', typeof passenger.email, 'value:', passenger.email);
    console.log('Passenger passportNumber type:', typeof passenger.passportNumber, 'value:', passenger.passportNumber);

    // Create a new main client from the passenger data
    const mainClientData = {
      name: passenger.name,
      surname: passenger.surname,
      dni: passenger.dni,
      dob: passenger.dob,
      phone: passenger.phone,
      passportImage: passenger.passportImage,
      nationality: passenger.nationality,
      expirationDate: passenger.expirationDate,
      createdBy: passenger.createdBy,
      isMainClient: true
    };

    // Only include email if it's not null, undefined, or empty
    if (passenger.email && typeof passenger.email === 'string' && passenger.email.trim() !== '') {
      mainClientData.email = passenger.email;
      console.log('Added email to mainClientData:', passenger.email);
    } else {
      console.log('Skipping email - value:', passenger.email, 'type:', typeof passenger.email);
      // Don't include email field at all when it's null/undefined
      // This allows multiple clients without email addresses due to sparse unique index
    }

    // Only include passportNumber if it's not null, undefined, or empty
    if (passenger.passportNumber && typeof passenger.passportNumber === 'string' && passenger.passportNumber.trim() !== '') {
      mainClientData.passportNumber = passenger.passportNumber;
      console.log('Added passportNumber to mainClientData:', passenger.passportNumber);
    } else {
      console.log('Skipping passportNumber - value:', passenger.passportNumber, 'type:', typeof passenger.passportNumber);
      // Explicitly ensure passportNumber is not included in the document
      delete mainClientData.passportNumber;
    }

    // Check if a client with this DNI already exists
    const existingClient = await Client.findOne({ dni: passenger.dni });
    if (existingClient) {
      return res.status(409).json({
        success: false,
        message: 'A passenger with this DNI already exists'
      });
    }

    // Email is optional - no need to check for existing clients without email
    // The sparse unique index will handle this properly

    // Debug logging
    console.log('Creating main client with data:', JSON.stringify(mainClientData, null, 2));
    console.log('Passenger email:', passenger.email);
    console.log('Passenger passportNumber:', passenger.passportNumber);

    // Create client using a different approach to avoid email conflicts
    let newMainClient;
    try {
      // First try to find if a client with this DNI already exists (double check)
      const existingClientByDni = await Client.findOne({ dni: mainClientData.dni });
      if (existingClientByDni) {
        return res.status(409).json({
          success: false,
          message: 'A passenger with this DNI already exists'
        });
      }

      // Create a clean client object without any problematic fields
      const cleanClientData = {
        name: mainClientData.name,
        surname: mainClientData.surname,
        dni: mainClientData.dni,
        dob: mainClientData.dob,
        phone: mainClientData.phone,
        passportImage: mainClientData.passportImage,
        nationality: mainClientData.nationality,
        expirationDate: mainClientData.expirationDate,
        createdBy: mainClientData.createdBy,
        isMainClient: mainClientData.isMainClient
      };

      // Only add passportNumber if it exists and is valid
      if (mainClientData.passportNumber && mainClientData.passportNumber.trim() !== '') {
        cleanClientData.passportNumber = mainClientData.passportNumber;
      }

      // Only add email if it exists and is valid
      if (mainClientData.email && mainClientData.email.trim() !== '') {
        cleanClientData.email = mainClientData.email;
      }

      console.log('Creating client with clean data:', JSON.stringify(cleanClientData, null, 2));

      // Use findOneAndUpdate with upsert to handle conflicts gracefully
      newMainClient = await Client.findOneAndUpdate(
        { dni: cleanClientData.dni },
        cleanClientData,
        { 
          upsert: true, 
          new: true, 
          runValidators: false, // Skip validators to avoid schema issues
          setDefaultsOnInsert: true
        }
      );
      
      if (!newMainClient) {
        throw new Error('Failed to create client');
      }
    } catch (insertError) {
      console.error('Error creating client:', insertError);
      
      // Handle specific MongoDB errors
      if (insertError.code === 11000) {
        const field = Object.keys(insertError.keyPattern)[0];
        return res.status(409).json({
          success: false,
          message: `A passenger with this ${field} already exists`
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to create client: ' + insertError.message
        });
      }
    }

    // Delete the passenger record since the user is now a main client
    // This prevents duplicates in the companion selection list
    await Passenger.findByIdAndDelete(passenger._id);

    res.json({
      success: true,
      message: 'Companion promoted to main client successfully',
      data: { 
        client: newMainClient
      }
    });

  } catch (error) {
    console.error('Promote companion error:', error);
    
    // Handle specific MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `A passenger with this ${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while promoting companion',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/clients/all-passengers - Get all clients and companions as passengers
const getAllPassengers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', type = 'all' } = req.query;
    
    let allPassengers = [];
    let total = 0;
    
    if (type === 'main') {
      // Get only main clients
      let clientQuery = { isMainClient: true };
      
      if (search) {
        clientQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { surname: { $regex: search, $options: 'i' } },
          { dni: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { passportNumber: { $regex: search, $options: 'i' } }
        ];
      }
      
      allPassengers = await Client.find(clientQuery)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      total = await Client.countDocuments(clientQuery);
    } else if (type === 'companions') {
      // Get only companions
      let passengerQuery = { relationshipType: 'companion' };
      
      if (search) {
        passengerQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { surname: { $regex: search, $options: 'i' } },
          { dni: { $regex: search, $options: 'i' } },
          { passportNumber: { $regex: search, $options: 'i' } }
        ];
      }
      
      allPassengers = await Passenger.find(passengerQuery)
        .populate('clientId', 'name surname dni email phone')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      total = await Passenger.countDocuments(passengerQuery);
    } else {
      // Get both main clients and companions
      const mainClientsQuery = { isMainClient: true };
      const companionsQuery = { relationshipType: 'companion' };
      
      if (search) {
        const searchRegex = { $regex: search, $options: 'i' };
        mainClientsQuery.$or = [
          { name: searchRegex },
          { surname: searchRegex },
          { dni: searchRegex },
          { email: searchRegex },
          { passportNumber: searchRegex }
        ];
        companionsQuery.$or = [
          { name: searchRegex },
          { surname: searchRegex },
          { dni: searchRegex },
          { passportNumber: searchRegex }
        ];
      }
      
      // Get main clients
      const mainClients = await Client.find(mainClientsQuery)
        .sort({ createdAt: -1 });
      
      // Get companions
      const companions = await Passenger.find(companionsQuery)
        .populate('clientId', 'name surname dni email phone')
        .sort({ createdAt: -1 });
      
      // Combine and sort by creation date
      allPassengers = [...mainClients, ...companions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice((page - 1) * limit, page * limit);
      
      total = mainClients.length + companions.length;
    }

    res.json({
      success: true,
      data: {
        passengers: allPassengers,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all passengers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passengers'
    });
  }
};

// GET /api/clients/:clientId/companions - Get companions for a specific main client
const getClientCompanions = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { search = '' } = req.query;

    // First verify the client exists and is a main client
    const mainClient = await Client.findById(clientId);
    if (!mainClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    if (!mainClient.isMainClient) {
      return res.status(400).json({
        success: false,
        message: 'Client is not a main client'
      });
    }

    // Build search query for companions
    const query = {
      mainClientId: clientId,
      relationshipType: 'companion'
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { passportNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const companions = await Passenger.find(query)
      .sort({ createdAt: -1 })
      .populate('clientId', 'name surname email phone passportNumber');



    // Transform companions to match the expected frontend format
    const formattedCompanions = companions.map(companion => ({
      _id: companion._id,
      name: companion.name,
      surname: companion.surname,
      dni: companion.dni,
      email: companion.email,
      phone: companion.phone,
      passportNumber: companion.passportNumber,
      type: 'companion',
      isMainClient: false,
      mainClientId: companion.mainClientId
    }));



    res.json({
      success: true,
      data: { companions: formattedCompanions }
    });

  } catch (error) {
    console.error('Get client companions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching companions'
    });
  }
};


// GET /api/clients/all-for-selection - Get all clients and passengers for selection (excluding specific main client)
const getAllForSelection = async (req, res) => {
  try {
    const { search = '', excludeClientId } = req.query;
    
    const query = {};
    if (excludeClientId) {
      query._id = { $ne: excludeClientId };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { passportNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Get all main clients (excluding the selected one)
    const mainClients = await Client.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    // Get all companions (excluding those belonging to the selected main client)
    const companionQuery = {};
    if (excludeClientId) {
      companionQuery.mainClientId = { $ne: excludeClientId };
      // Also exclude companions that are the selected client themselves
      companionQuery._id = { $ne: excludeClientId };
    }
    if (search) {
      companionQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { passportNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const companions = await Passenger.find(companionQuery)
      .sort({ createdAt: -1 })
      .populate('clientId', 'name surname email phone passportNumber')
      .limit(100);

    // Combine and format the results
    const allForSelection = [
      ...mainClients.map(client => ({
        _id: client._id,
        name: client.name,
        surname: client.surname,
        dni: client.dni,
        email: client.email,
        phone: client.phone,
        passportNumber: client.passportNumber,
        type: 'main_client',
        isMainClient: true
      })),
      ...companions.map(companion => ({
        _id: companion._id,
        name: companion.name,
        surname: companion.surname,
        dni: companion.dni,
        email: companion.email,
        phone: companion.phone,
        passportNumber: companion.passportNumber,
        type: 'companion',
        isMainClient: false,
        mainClientId: companion.mainClientId
      }))
    ];

    // Remove duplicates based on DNI or email to prevent the same person appearing twice
    // This is a safety measure in case promotion didn't properly clean up the passenger record
    const uniqueSelection = [];
    const seenIdentifiers = new Set();
    
    for (const person of allForSelection) {
      const identifier = person.dni || person.email;
      if (identifier && !seenIdentifiers.has(identifier)) {
        seenIdentifiers.add(identifier);
        uniqueSelection.push(person);
      } else if (!identifier) {
        // If no DNI or email, use name + surname as fallback identifier
        const fallbackIdentifier = `${person.name}_${person.surname}`;
        if (!seenIdentifiers.has(fallbackIdentifier)) {
          seenIdentifiers.add(fallbackIdentifier);
          uniqueSelection.push(person);
        }
      }
    }

    res.json({
      success: true,
      data: { allForSelection: uniqueSelection }
    });

  } catch (error) {
    console.error('Get all for selection error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching selection data'
    });
  }
};

module.exports = {
  createClient,
  getClient,
  getAllClients,
  getAllClientsWithSales,
  updateClient,
  deleteClient,
  extractPassportData,
  getPassportImage,
  createClientWithCompanions,
  promoteCompanionToMain,
  getAllPassengers,
  getClientCompanions,
  getAllForSelection
};