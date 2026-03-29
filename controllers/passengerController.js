const Passenger = require('../models/Passenger');
const Client = require('../models/Client');
const openaiVisionService = require('../services/openaiVisionService');
const path = require('path');
const supabase = require('../config/supabaseClient'); // Importamos el cliente con fusible

// POST /api/clients/:clientId/passengers - Add passenger to client
const addPassenger = async (req, res) => {
  try {
    const { clientId } = req.params;
    const passengerData = req.body;
    
    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const requiredFields = ['name', 'surname', 'dni'];
    const missingFields = requiredFields.filter(field => !passengerData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const existingPassenger = await Passenger.findOne({ clientId, dni: passengerData.dni });
    if (existingPassenger) {
      return res.status(409).json({ success: false, message: 'Passenger with this DNI/CUIT already exists for this client' });
    }

    passengerData.clientId = clientId;
    passengerData.mainClientId = clientId;
    passengerData.createdBy = req.user?.id || req.user?.user?.id;

    if (!passengerData.email || passengerData.email.trim() === '') delete passengerData.email;
    if (!passengerData.phone || passengerData.phone.trim() === '') delete passengerData.phone;

    const passenger = new Passenger(passengerData);
    await passenger.save();

    res.status(201).json({
      success: true,
      message: 'Passenger added successfully',
      data: { passenger, _id: passenger._id, id: passenger._id }
    });
  } catch (error) {
    console.error('Add passenger error:', error);
    res.status(500).json({ success: false, message: 'Internal server error while adding passenger' });
  }
};

// GET /api/passengers/:passengerId - Get passenger by ID
const getPassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;
    const passenger = await Passenger.findById(passengerId).populate('clientId', 'name surname email');
    if (!passenger) return res.status(404).json({ success: false, message: 'Passenger not found' });
    res.json({ success: true, data: { passenger } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching passenger' });
  }
};

// PUT /api/passengers/:passengerId - Update passenger (CON SOPORTE SUPABASE)
const updatePassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;
    let updateData = { ...req.body };

    // Si hay un archivo (buffer de memoria), lo subimos
    if (req.file) {
      try {
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `pass-companion-${passengerId}-${Date.now()}.${fileExt}`;

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
        console.log('✅ Pasaporte de acompañante subido:', publicUrl);
      } catch (supaError) {
        console.error('⚠️ Error Supabase en Pasajeros (Plan B):', supaError.message);
      }
    }

    const passenger = await Passenger.findByIdAndUpdate(
      passengerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!passenger) return res.status(404).json({ success: false, message: 'Passenger not found' });

    res.json({ success: true, message: 'Passenger updated successfully', data: { passenger } });
  } catch (error) {
    console.error('Update passenger error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/passengers/:passengerId
const deletePassenger = async (req, res) => {
  try {
    const { passengerId } = req.params;
    const passenger = await Passenger.findByIdAndDelete(passengerId);
    if (!passenger) return res.status(404).json({ success: false, message: 'Passenger not found' });
    res.json({ success: true, message: 'Passenger deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting passenger' });
  }
};

// GET /api/clients/:clientId/passengers
const getClientPassengers = async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const passengers = await Passenger.find({ clientId }).sort({ createdAt: -1 });
    res.json({ success: true, data: { client, passengers } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching passengers' });
  }
};

// POST /api/passengers/ocr - OpenAI Vision con Buffer + Subida a Supabase
const extractPassengerPassportData = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });

    console.log('🤖 Acompañante: Iniciando OCR y subida a la nube...');

    // 1. Extraemos datos con el buffer
    const openaiResult = await openaiVisionService.extractDocumentData(req.file.buffer);
    if (!openaiResult.success) return res.status(500).json({ success: false, message: 'OCR failed', error: openaiResult.error });

    // 2. Subida inmediata a Supabase para que el Front ya tenga la URL
    let passportUrl = null;
    try {
      const fileName = `pass-ocr-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('pports')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

      if (!uploadError) {
        const { data } = supabase.storage.from('pports').getPublicUrl(fileName);
        passportUrl = data.publicUrl;
        console.log('✅ Imagen de acompañante disponible en Supabase:', passportUrl);
      }
    } catch (supaErr) {
      console.error('⚠️ Error subiendo imagen de acompañante:', supaErr.message);
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
    console.error('❌ OCR error:', error);
    res.status(500).json({ success: false, message: 'Error during OCR' });
  }
};

// GET /api/passengers/:passengerId/passport-image - Redirección o Disco (CORREGIDO)
const getPassengerPassportImage = async (req, res) => {
  try {
    const { passengerId } = req.params;
    const passenger = await Passenger.findById(passengerId);
    
    if (!passenger || !passenger.passportImage) return res.status(404).json({ success: false, message: 'No image found' });

    // --- CIRUGÍA: Blindamos la detección de la URL de Supabase para evitar el Frankenstein ---
    const cleanPath = passenger.passportImage.trim();
    if (/^https?:\/\//i.test(cleanPath)) {
      console.log('🔗 Redirigiendo a URL externa de Supabase (Acompañante):', cleanPath);
      return res.redirect(cleanPath);
    }

    // Si es vieja (disco), servimos el archivo
    const imagePath = path.join(__dirname, '../uploads/passports', cleanPath);
    res.sendFile(imagePath);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching image' });
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