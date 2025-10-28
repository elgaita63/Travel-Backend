const ServiceType = require('../models/ServiceType');
const ServiceTemplate = require('../models/ServiceTemplate');

// Get all service types
const getAllServiceTypes = async (req, res) => {
  try {
    const { category, active = true } = req.query;
    
    let query = {};
    if (active === 'true') {
      query.isActive = true;
    }
    if (category) {
      query.category = category;
    }

    const serviceTypes = await ServiceType.find(query)
      .sort({ usageCount: -1, name: 1 })
      .select('-__v');

    res.json({
      success: true,
      data: {
        serviceTypes,
        count: serviceTypes.length
      }
    });
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service types',
      error: error.message
    });
  }
};

// Get service type by ID
const getServiceTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceType = await ServiceType.findById(id).select('-__v');
    
    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    res.json({
      success: true,
      data: { serviceType }
    });
  } catch (error) {
    console.error('Error fetching service type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service type',
      error: error.message
    });
  }
};

// Create new service type
const createServiceType = async (req, res) => {
  try {
    const { name, description, category } = req.body;
    const userId = req.user?.id || req.user?._id; // Handle different user ID formats

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Service type name is required'
      });
    }

    // Check if service type already exists
    const existingServiceType = await ServiceType.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existingServiceType) {
      return res.status(409).json({
        success: false,
        message: 'Service type with this name already exists'
      });
    }

    // Create new service type
    const serviceType = new ServiceType({
      name: name.trim(),
      description: description?.trim() || '',
      category: category || 'Other',
      createdBy: userId
    });

    await serviceType.save();

    res.status(201).json({
      success: true,
      message: 'Service type created successfully',
      data: { serviceType }
    });
  } catch (error) {
    console.error('Error creating service type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service type',
      error: error.message
    });
  }
};

// Update service type
const updateServiceType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, isActive } = req.body;

    const serviceType = await ServiceType.findById(id);
    
    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    // Check if new name conflicts with existing service types
    if (name && name.trim() !== serviceType.name) {
      const existingServiceType = await ServiceType.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingServiceType) {
        return res.status(409).json({
          success: false,
          message: 'Service type with this name already exists'
        });
      }
    }

    // Update fields
    if (name !== undefined) serviceType.name = name.trim();
    if (description !== undefined) serviceType.description = description?.trim() || '';
    if (category !== undefined) serviceType.category = category;
    if (isActive !== undefined) serviceType.isActive = isActive;

    await serviceType.save();

    res.json({
      success: true,
      message: 'Service type updated successfully',
      data: { serviceType }
    });
  } catch (error) {
    console.error('Error updating service type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service type',
      error: error.message
    });
  }
};

// Delete service type (soft delete by setting isActive to false)
const deleteServiceType = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceType = await ServiceType.findById(id);
    
    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found'
      });
    }

    // Check if service type is being used by any service templates
    const serviceTemplatesUsingType = await ServiceTemplate.find({
      'serviceType': id,
      isActive: true
    });

    if (serviceTemplatesUsingType.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete service type. It is being used by ${serviceTemplatesUsingType.length} service template(s). Please update or delete those templates first.`
      });
    }

    // Soft delete by setting isActive to false
    serviceType.isActive = false;
    await serviceType.save();

    res.json({
      success: true,
      message: 'Service type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service type',
      error: error.message
    });
  }
};

// Get service type usage statistics
const getServiceTypeStats = async (req, res) => {
  try {
    const stats = await ServiceType.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalServiceTypes = await ServiceType.countDocuments({ isActive: true });
    const mostUsed = await ServiceType.findOne({ isActive: true })
      .sort({ usageCount: -1 })
      .select('name usageCount');

    res.json({
      success: true,
      data: {
        stats,
        totalServiceTypes,
        mostUsed
      }
    });
  } catch (error) {
    console.error('Error fetching service type stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service type statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllServiceTypes,
  getServiceTypeById,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  getServiceTypeStats
};
