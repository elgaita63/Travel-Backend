const Client = require('../models/Client');
const Passenger = require('../models/Passenger');
const Sale = require('../models/Sale');
const openaiVisionService = require('../services/openaiVisionService');
const path = require('path');
const supabase = require('../config/supabaseClient'); // Importamos el cliente con fusible

// POST /api/clients - Create a new client
const createClient = async (req, res) => {
  try {
    const clientData = req.body;
    clientData.createdBy = req.user.id;
    
    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !clientData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const existingClientByDni = await Client.findOne({ dni: clientData.dni });
    if (existingClientByDni) {
      return res.status(409).json({
        success: false,
        message: 'Acompañante with this DNI/CUIT already exists'
      });
    }

    if (clientData.email) {
      const existingClientByEmail = await Client.findOne({ email: clientData.email });
      if (existingClientByEmail) {
        return res.status(409).json({
          success: false,
          message: 'Passenger with this email already exists'
        });
      }
    }

    // Guardamos el cliente (incluyendo la URL de passportImage si viene del OCR)
    const client = new Client(clientData);
    await client.save();

    res.status(201).json({
      success: true,
      message: 'Passenger created successfully',
      data: { client }
    });
  } catch (error) {
    console.error('Create passenger error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while creating passenger' });
  }
};

// GET /api/clients/:clientId - Get client with passengers
const getClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const passengers = await Passenger.find({ 
      clientId,
      relationshipType: 'companion'
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: { client, passengers } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/clients - Get all clients
const getAllClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', isMainClient } = req.query;
    const query = {};
    if (isMainClient !== undefined) query.isMainClient = isMainClient === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { dni: { $regex: search, $options: 'i' } }
      ];
    }
    const clients = await Client.find(query).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Client.countDocuments(query);
    res.json({ success: true, data: { clients, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching passengers' });
  }
};

// GET /api/clients/with-sales - Get all clients with their sales information
const getAllClientsWithSales = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', includeNoSales = 'true' } = req.query;
    const query = {};
    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { surname: { $regex: search, $options: 'i' } }];
    }
    const clients = await Client.find(query).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const clientsWithSales = await Promise.all(clients.map(async (client) => {
      const sales = await Sale.find({ clientId: client._id }).sort({ createdAt: -1 });
      return { ...client.toObject(), salesCount: sales.length, hasSales: sales.length > 0 };
    }));
    res.json({ success: true, data: { clients: clientsWithSales } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sales info' });
  }
};

// PUT /api/clients/:clientId - Update client
const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    let updateData = { ...req.body };

    if (req.file) {
      try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `passport-${clientId}-${Date.now()}.${fileExt}`;

        const { data, error: uploadError } = await supabase.storage
          .from('pports')
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pports')
          .getPublicUrl(fileName);

        updateData.passportImage = publicUrl;
        console.log('✅ URL de pasaporte actualizada en Supabase:', publicUrl);
      } catch (supaError) {
        console.error('⚠️ Error subiendo a Supabase (Plan B activo):', supaError.message);
      }
    }

    const client = await Client.findByIdAndUpdate(clientId, updateData, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    res.json({ success: true, message: 'Passenger updated successfully', data: { client } });
  } catch (error) {
    console.error('Update passenger error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while updating client' });
  }
};

// DELETE /api/clients/:clientId
const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const passengersCount = await Passenger.countDocuments({ clientId });
    if (passengersCount > 0) return res.status(400).json({ success: false, message: 'Delete passengers first' });
    const client = await Client.findByIdAndDelete(clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting client' });
  }
};

// POST /api/clients/ocr - OCR con Buffer y subida inmediata a Supabase
const extractPassportData = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No passport image uploaded' });
    
    console.log('🤖 Titular: Iniciando proceso OCR y subida a la nube...');

    // 1. Extraemos los datos con OpenAI usando el BUFFER
    const openaiResult = await openaiVisionService.extractDocumentData(req.file.buffer);
    if (!openaiResult.success) return res.status(500).json({ success: false, message: 'OCR failed', error: openaiResult.error });

    // 2. Subimos a Supabase durante el OCR para tener la URL
    let passportUrl = null;
    try {
      const fileExt = req.file.originalname.split('.').pop() || 'jpg';
      const fileName = `ocr-temp-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pports')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('pports').getPublicUrl(fileName);
        passportUrl = data.publicUrl;
        console.log('✅ Imagen OCR disponible en Supabase:', passportUrl);
      }
    } catch (supaErr) {
      console.error('⚠️ Error subiendo imagen temporal en OCR:', supaErr.message);
    }

    res.json({
      success: true,
      data: { 
        extractedData: openaiResult.data, 
        confidence: openaiResult.confidence, 
        passportImage: passportUrl, // URL real de Supabase
        method: 'openai_vision_api' 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'OCR error', error: error.message });
  }
};

// GET /api/clients/:clientId/passport-image - Soporte para URL o Disco (CORREGIDO)
const getPassportImage = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client || !client.passportImage) return res.status(404).json({ success: false, message: 'No image found' });

    // --- CIRUGÍA: Blindamos la detección de la URL de Supabase ---
    const cleanPath = client.passportImage.trim();
    if (/^https?:\/\//i.test(cleanPath)) {
      console.log('🔗 Redirigiendo a URL externa de Supabase:', cleanPath);
      return res.redirect(cleanPath);
    }

    // Si es un nombre de archivo (viejos), servimos del disco
    const imagePath = path.join(__dirname, '../uploads/passports', cleanPath);
    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching image' });
  }
};

const createClientWithCompanions = async (req, res) => {
  try {
    const { mainClient, companions = [] } = req.body;
    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !mainClient[field]);
    if (missingFields.length > 0) return res.status(400).json({ success: false, message: `Missing fields: ${missingFields.join(', ')}` });

    const existingClient = await Client.findOne({ dni: mainClient.dni });
    if (existingClient) return res.status(409).json({ success: false, message: 'Passenger with this DNI already exists' });

    const mainClientData = { ...mainClient, createdBy: req.user.id, isMainClient: true };
    const createdMainClient = new Client(mainClientData);
    await createdMainClient.save();

    const createdCompanions = [];
    for (const companion of companions) {
      const companionData = { ...companion, clientId: createdMainClient._id, mainClientId: createdMainClient._id, createdBy: req.user.id, relationshipType: 'companion' };
      const createdCompanion = new Passenger(companionData);
      await createdCompanion.save();
      createdCompanions.push(createdCompanion);
    }

    res.status(201).json({ success: true, data: { mainClient: createdMainClient, companions: createdCompanions } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error in bulk creation' });
  }
};

const promoteCompanionToMain = async (req, res) => {
  try {
    const { clientId } = req.params;
    const passenger = await Passenger.findById(clientId);
    if (!passenger) return res.status(404).json({ success: false, message: 'Passenger not found' });

    const mainClientData = { ...passenger.toObject(), isMainClient: true, _id: undefined };
    const newMainClient = new Client(mainClientData);
    await newMainClient.save();
    await Passenger.findByIdAndDelete(passenger._id);

    res.json({ success: true, message: 'Promoted successfully', data: { client: newMainClient } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error promoting companion' });
  }
};

const getAllPassengers = async (req, res) => {
  try {
    const mainClients = await Client.find({ isMainClient: true }).sort({ createdAt: -1 });
    const companions = await Passenger.find({ relationshipType: 'companion' }).sort({ createdAt: -1 });
    res.json({ success: true, data: { passengers: [...mainClients, ...companions] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching all' });
  }
};

const getClientCompanions = async (req, res) => {
  try {
    const companions = await Passenger.find({ mainClientId: req.params.clientId, relationshipType: 'companion' });
    res.json({ success: true, data: { companions } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching companions' });
  }
};

const getAllForSelection = async (req, res) => {
  try {
    const mainClients = await Client.find({}).sort({ createdAt: -1 });
    const companions = await Passenger.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: { allForSelection: [...mainClients, ...companions] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching selection' });
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