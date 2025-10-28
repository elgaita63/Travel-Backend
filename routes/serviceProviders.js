const express = require('express');
const router = express.Router();
const ServiceProvider = require('../models/ServiceProvider');
const { authenticate } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// Get all providers for a specific service
router.get('/service/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status = 'active', available = true } = req.query;

    const query = { serviceId };
    
    if (status) {
      query.status = status;
    }
    
    if (available === 'true') {
      query.isAvailable = true;
    }

    const serviceProviders = await ServiceProvider.find(query)
      .populate('providerId', 'name type contactInfo description rating status')
      .populate('serviceId', 'destino type description')
      .sort({ 'providerId.name': 1 });

    res.json({
      success: true,
      data: {
        serviceProviders,
        count: serviceProviders.length
      }
    });
  } catch (error) {
    console.error('Error fetching providers for service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch providers for service'
    });
  }
});

// Get all services for a specific provider
router.get('/provider/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { status = 'active', available = true } = req.query;

    const query = { providerId };
    
    if (status) {
      query.status = status;
    }
    
    if (available === 'true') {
      query.isAvailable = true;
    }

    const serviceProviders = await ServiceProvider.find(query)
      .populate('serviceId', 'destino type description status')
      .populate('providerId', 'name type description rating')
      .sort({ 'serviceId.destino': 1 });

    res.json({
      success: true,
      data: {
        serviceProviders,
        count: serviceProviders.length
      }
    });
  } catch (error) {
    console.error('Error fetching services for provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services for provider'
    });
  }
});

// Get service-provider combination details
router.get('/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;

    const serviceProvider = await ServiceProvider.findById(serviceProviderId)
      .populate('serviceId', 'destino type description')
      .populate('providerId', 'name type contactInfo description rating');

    if (!serviceProvider) {
      return res.status(404).json({
        success: false,
        message: 'Service-provider combination not found'
      });
    }

    res.json({
      success: true,
      data: { serviceProvider }
    });
  } catch (error) {
    console.error('Error fetching service-provider details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service-provider details'
    });
  }
});

// Create new service-provider relationship
router.post('/', async (req, res) => {
  try {
    const serviceProviderData = {
      ...req.body,
      createdBy: req.user.id
    };

    // Check if combination already exists
    const existing = await ServiceProvider.findOne({
      serviceId: serviceProviderData.serviceId,
      providerId: serviceProviderData.providerId
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Service-provider combination already exists'
      });
    }

    const serviceProvider = new ServiceProvider(serviceProviderData);
    await serviceProvider.save();

    await serviceProvider.populate('serviceId providerId');

    res.status(201).json({
      success: true,
      data: { serviceProvider },
      message: 'Service-provider relationship created successfully'
    });
  } catch (error) {
    console.error('Error creating service-provider relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service-provider relationship'
    });
  }
});

// Update service-provider relationship
router.put('/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;
    const updateData = req.body;

    const serviceProvider = await ServiceProvider.findByIdAndUpdate(
      serviceProviderId,
      updateData,
      { new: true, runValidators: true }
    ).populate('serviceId providerId');

    if (!serviceProvider) {
      return res.status(404).json({
        success: false,
        message: 'Service-provider combination not found'
      });
    }

    res.json({
      success: true,
      data: { serviceProvider },
      message: 'Service-provider relationship updated successfully'
    });
  } catch (error) {
    console.error('Error updating service-provider relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service-provider relationship'
    });
  }
});

// Delete service-provider relationship
router.delete('/:serviceProviderId', async (req, res) => {
  try {
    const { serviceProviderId } = req.params;

    const serviceProvider = await ServiceProvider.findByIdAndDelete(serviceProviderId);

    if (!serviceProvider) {
      return res.status(404).json({
        success: false,
        message: 'Service-provider combination not found'
      });
    }

    res.json({
      success: true,
      message: 'Service-provider relationship deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service-provider relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service-provider relationship'
    });
  }
});

// Get available service-provider combinations for multiple services
router.post('/combinations', async (req, res) => {
  try {
    const { serviceIds, date, status = 'active' } = req.body;

    if (!serviceIds || !Array.isArray(serviceIds)) {
      return res.status(400).json({
        success: false,
        message: 'Service IDs array is required'
      });
    }

    const query = {
      serviceId: { $in: serviceIds },
      status: status,
      isAvailable: true
    };

    // If date is provided, filter by contract availability
    if (date) {
      const targetDate = new Date(date);
      query.$or = [
        { 'contractDetails.startDate': { $exists: false } },
        { 'contractDetails.startDate': { $lte: targetDate } }
      ];
      query.$and = [
        {
          $or: [
            { 'contractDetails.endDate': { $exists: false } },
            { 'contractDetails.endDate': { $gte: targetDate } }
          ]
        }
      ];
    }

    const serviceProviders = await ServiceProvider.find(query)
      .populate('serviceId', 'destino type description')
      .populate('providerId', 'name type contactInfo description rating status')
      .sort({ 'serviceId.destino': 1, 'providerId.name': 1 });

    // Group by service
    const groupedByService = {};
    serviceProviders.forEach(sp => {
      // Skip if serviceId is null or undefined
      if (!sp.serviceId || !sp.serviceId._id) {
        return;
      }
      
      const serviceId = sp.serviceId._id.toString();
      if (!groupedByService[serviceId]) {
        groupedByService[serviceId] = {
          service: sp.serviceId,
          providers: []
        };
      }
      groupedByService[serviceId].providers.push(sp);
    });

    res.json({
      success: true,
      data: {
        combinations: groupedByService,
        totalCombinations: serviceProviders.length,
        servicesCount: Object.keys(groupedByService).length
      }
    });
  } catch (error) {
    console.error('Error fetching service-provider combinations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service-provider combinations'
    });
  }
});

module.exports = router;