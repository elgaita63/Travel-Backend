const Service = require('../models/Service');
const Provider = require('../models/Provider');
const ServiceProvider = require('../models/ServiceProvider');

// POST /api/services - Create a new service
const createService = async (req, res) => {
  try {
    const serviceData = req.body;
    
    // Validate required fields
    const requiredFields = ['destino', 'type', 'description', 'providerId'];
    const missingFields = requiredFields.filter(field => !serviceData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Check if provider exists
    const provider = await Provider.findById(serviceData.providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Note: ProviderType model is not available, skipping typeId assignment
    // The service will be created with the provided type as a string

    // Add the authenticated user's ID as the creator
    serviceData.createdBy = req.user.id;

    const service = new Service(serviceData);
    await service.save();

    // Create ServiceProvider relationship
    const serviceProvider = new ServiceProvider({
      serviceId: service._id,
      providerId: service.providerId,
      costProvider: serviceData.costProvider || service.sellingPrice || 100,
      currency: serviceData.currency || service.baseCurrency || 'USD',
      commissionRate: serviceData.commissionRate || 10,
      paymentTerms: serviceData.paymentTerms || 'net_30',
      isAvailable: true,
      capacity: serviceData.capacity || { min: 1, max: 1 },
      notes: serviceData.providerNotes || 'Default provider partnership',
      status: 'active',
      createdBy: req.user.id
    });
    await serviceProvider.save();

    // Populate provider information
    await service.populate('providerId', 'name type contactInfo');

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: { 
        service,
        serviceProvider: {
          id: serviceProvider._id,
          costProvider: serviceProvider.costProvider,
          currency: serviceProvider.currency,
          commissionRate: serviceProvider.commissionRate,
          paymentTerms: serviceProvider.paymentTerms
        }
      }
    });

  } catch (error) {
    console.error('Create service error:', error);
    
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
      message: 'Internal server error while creating service'
    });
  }
};

// GET /api/services - Get all services with filtering and pagination
const getAllServices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      type = '', 
      providerId = ''
    } = req.query;
    
    const query = {};
    
    // Add search filter
    if (search) {
      query.$or = [
        { destino: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add type filter
    if (type) {
      query.type = type;
    }
    
    // Note: Provider filtering will be handled after fetching services
    // since we need to check all service providers, not just the original providerId

    const services = await Service.find(query)
      .populate('providerId', 'name type contactInfo')
      .populate('typeId', 'name description')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get all service providers for each service
    const servicesWithProviders = await Promise.all(
      services.map(async (service) => {
        const serviceProviders = await ServiceProvider.find({ serviceId: service._id })
          .populate('providerId', 'name type contactInfo');
        
        return {
          ...service.toObject(),
          allProviders: serviceProviders.map(sp => ({
            _id: sp.providerId._id,
            name: sp.providerId.name,
            type: sp.providerId.type,
            contactInfo: sp.providerId.contactInfo,
            costProvider: sp.costProvider,
            currency: sp.currency,
            commissionRate: sp.commissionRate,
            paymentTerms: sp.paymentTerms,
            status: sp.status
          }))
        };
      })
    );

    // Apply provider filter after fetching all service providers
    let filteredServices = servicesWithProviders;
    if (providerId) {
      filteredServices = servicesWithProviders.filter(service => 
        service.allProviders.some(provider => provider._id.toString() === providerId)
      );
    }

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: {
        services: filteredServices,
        total: filteredServices.length,
        page: parseInt(page),
        pages: Math.ceil(filteredServices.length / limit)
      }
    });

  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching services'
    });
  }
};

// GET /api/services/:id - Get service by ID
const getService = async (req, res) => {
  try {
    const { id } = req.params;
    
    const service = await Service.findById(id)
      .populate('providerId', 'name type contactInfo')
      .populate('typeId', 'name description');
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: { service }
    });

  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching service'
    });
  }
};

// PUT /api/services/:id - Update service
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // If providerId is being updated, validate the new provider
    if (updateData.providerId) {
      const provider = await Provider.findById(updateData.providerId);
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }
    }

    // Handle typeId if type is being updated
    if (updateData.type) {
      if (updateData.type === '') {
        updateData.typeId = undefined;
      } else {
        const ProviderType = require('../models/ProviderType');
        const providerType = await ProviderType.findOne({ 
          name: { $regex: new RegExp(`^${updateData.type}$`, 'i') },
          isActive: true
        });
        
        if (providerType) {
          updateData.typeId = providerType._id;
        }
      }
    }

    const service = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('providerId', 'name type contactInfo')
     .populate('typeId', 'name description');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service }
    });

  } catch (error) {
    console.error('Update service error:', error);
    
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
      message: 'Internal server error while updating service'
    });
  }
};

// DELETE /api/services/:id - Delete service
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findByIdAndDelete(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting service'
    });
  }
};

// GET /api/services/provider/:providerId - Get services by provider
const getServicesByProvider = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Check if provider exists
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const services = await Service.find({ providerId })
      .populate('providerId', 'name type contactInfo')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Service.countDocuments({ providerId });

    res.json({
      success: true,
      data: {
        provider,
        services,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get services by provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching services by provider'
    });
  }
};

// GET /api/services/types - Get available service types
const getServiceTypes = async (req, res) => {
  try {
    const types = ['hotel', 'airline', 'transfer', 'excursion', 'insurance'];
    
    res.json({
      success: true,
      data: { types }
    });

  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching service types'
    });
  }
};

module.exports = {
  createService,
  getAllServices,
  getService,
  updateService,
  deleteService,
  getServicesByProvider,
  getServiceTypes
};