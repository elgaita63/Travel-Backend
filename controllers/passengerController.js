const Passenger = require('../models/Passenger');
const Client = require('../models/Client');
const openaiVisionService = require('../services/openaiVisionService');
const path = require('path');
const fs = require('fs');

// POST /api/clients/:clientId/passengers - Add passenger to client
const addPassenger = async (req, res) => {
  try {
    const { clientId } = req.params;
    const passengerData = req.body;
    
    console.log('=== ADD PASSENGER DEBUG ===');
    console.log('Client ID:', clientId);
    console.log('Passenger data received:', JSON.stringify(passengerData, null, 2));
    console.log('Passport image in data:', passengerData.passportImage);
    console.log('DNI validation check:', {
      dni: passengerData.dni,
      length: passengerData.dni?.length,
      isString: typeof passengerData.dni,
      isEmpty: !passengerData.dni || passengerData.dni.trim() === ''
    });
    console.log('==========================');

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Validate required fields - only name, surname, and dni are required
    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !passengerData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if passenger with same DNI already exists for this client
    const existingPassenger = await Passenger.findOne({
      clientId,
      dni: passengerData.dni
    });

    if (existingPassenger) {
      return res.status(409).json({
        success: false,
        message: 'Passenger with this DNI/CUIT already exists for this client'
      });
    }

    // Add clientId, mainClientId and createdBy to passenger data
    passengerData.clientId = clientId;
    passengerData.mainClientId = clientId; // Link to main client for companion queries
    passengerData.createdBy = req.user?.id || req.user?.user?.id;

    // Handle email field - only include if it's not empty
    if (!passengerData.email || passengerData.email.trim() === '') {
      delete passengerData.email;
    }

    // Handle phone field - only include if it's not empty
    if (!passengerData.phone || passengerData.phone.trim() === '') {
      delete passengerData.phone;
    }

    // Handle passport image - store the filename if provided
    console.log('🔍 Passport image handling:', {
      hasPassportImage: !!passengerData.passportImage,
      passportImageValue: passengerData.passportImage,
      type: typeof passengerData.passportImage
    });
    
    if (passengerData.passportImage) {
      // The passportImage field should contain the filename from upload
      console.log('✅ Passport image will be saved:', passengerData.passportImage);
    } else {
      console.log('❌ No passport image provided');
    }

    const passenger = new Passenger(passengerData);
    await passenger.save();

    console.log('=== PASSENGER SAVED DEBUG ===');
    console.log('Saved passenger:', passenger);
    console.log('Passport image in saved passenger:', passenger.passportImage);
    console.log('==============================');

    res.status(201).json({
      success: true,
      message: 'Passenger added successfully',
      data: { 
        passenger,
        _id: passenger._id,
        id: passenger._id
      }
    });

  } catch (error) {
    console.error('Add passenger error:', error);
    
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
      message: 'Internal server error while adding passenger'
    });
  }
};

// GET /api/passengers/:passengerId - Get passenger by ID
const getPassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;
    
    const passenger = await Passenger.findById(passengerId).populate('clientId', 'name surname email');
    
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found'
      });
    }

    res.json({
      success: true,
      data: { passenger }
    });

  } catch (error) {
    console.error('Get passenger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passenger'
    });
  }
};

// PUT /api/passengers/:passengerId - Update passenger
const updatePassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;
    const updateData = req.body;

    const passenger = await Passenger.findByIdAndUpdate(
      passengerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found'
      });
    }

    res.json({
      success: true,
      message: 'Passenger updated successfully',
      data: { passenger }
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

    res.status(500).json({
      success: false,
      message: 'Internal server error while updating passenger'
    });
  }
};

// DELETE /api/passengers/:passengerId - Delete passenger
const deletePassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;

    const passenger = await Passenger.findByIdAndDelete(passengerId);
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found'
      });
    }

    res.json({
      success: true,
      message: 'Passenger deleted successfully'
    });

  } catch (error) {
    console.error('Delete passenger error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting passenger'
    });
  }
};

// GET /api/clients/:clientId/passengers - Get all passengers for a client
const getClientPassengers = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const passengers = await Passenger.find({ 
      clientId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        client: {
          id: client._id,
          name: client.name,
          surname: client.surname,
          email: client.email
        },
        passengers
      }
    });

  } catch (error) {
    console.error('Get client passengers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passengers'
    });
  }
};

// POST /api/passengers/ocr - Upload passenger passport image and extract data using OpenAI Vision
const extractPassengerPassportData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No passport image uploaded'
      });
    }

    const imagePath = req.file.path;
    console.log('🤖 Processing passenger passport image with OpenAI Vision:', imagePath);

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
      message: 'Passenger passport data extracted successfully',
      data: {
        extractedData: openaiResult.data,
        confidence: openaiResult.confidence,
        imagePath: req.file.filename,
        passportImage: req.file.filename,
        method: 'openai_vision_api'
      }
    });

  } catch (error) {
    console.error('❌ Passenger OpenAI Vision extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OpenAI Vision processing',
      error: error.message
    });
  }
};

// GET /api/passengers/:passengerId/passport-image - Get passenger passport image
const getPassengerPassportImage = async (req, res) => {
  try {
    const { passengerId } = req.params;
    
    const passenger = await Passenger.findById(passengerId);
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: 'Passenger not found'
      });
    }

    if (!passenger.passportImage) {
      return res.status(404).json({
        success: false,
        message: 'No passport image found for this passenger'
      });
    }

    const imagePath = path.join(__dirname, '../uploads/passports', passenger.passportImage);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        message: 'Passport image file not found'
      });
    }
    
    res.sendFile(imagePath);

  } catch (error) {
    console.error('Get passenger passport image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching passport image'
    });
  }
};

module.exports = {
  addPassenger,
  getPassenger,
  updatePassenger,
  deletePassenger,
  getClientPassengers,
  extractPassengerPassportData,
  getPassengerPassportImage
};