const ServiceTemplate = require('../models/ServiceTemplate');
const { CATEGORIES_FOR_SELECT } = require('../constants/serviceTemplateCategories');

// Get all service templates
const getAllServiceTemplates = async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    
    let query = {};
    
    // Only filter by isActive if explicitly provided
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    
    console.log('🔍 Service templates query:', query);
    
    const serviceTemplates = await ServiceTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('serviceType', 'name category')
      .sort({ name: 1 });
    
    console.log('📋 Found service templates:', serviceTemplates.length);
    console.log('📊 Service templates:', serviceTemplates.map(t => ({ id: t._id, name: t.name, isActive: t.isActive })));
    
    res.json({
      success: true,
      data: {
        serviceTemplates,
        count: serviceTemplates.length
      }
    });
  } catch (error) {
    console.error('Error fetching service templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service templates'
    });
  }
};

// Get service templates for sale wizard (only active templates suitable for new sales)
const getServiceTemplatesForSaleWizard = async (req, res) => {
  try {
    const { search, category } = req.query;
    
    let query = {
      isActive: true, // Only active templates
      name: { 
        $exists: true, 
        $ne: null, 
        $ne: '',
        $not: /^undefined/i, // Name must not start with "undefined"
        $not: /^sdfsd/i // Name must not start with "sdfsd"
      },
      category: { $exists: true, $ne: null, $ne: '' } // Category must exist and not be empty
    };
    
    if (search) {
      query.name = { 
        ...query.name,
        $regex: search, 
        $options: 'i' 
      };
    }
    
    if (category) {
      query.category = { 
        ...query.category,
        $regex: category, 
        $options: 'i' 
      };
    }
    
    console.log('🔍 Sale wizard service templates query:', query);
    
    // First, let's see what's actually in the database
    const allTemplates = await ServiceTemplate.find({});
    console.log('🗄️ All templates in database:', allTemplates.length);
    allTemplates.forEach(t => {
      console.log(`  - ID: ${t._id}, Name: "${t.name}", Category: "${t.category}", Active: ${t.isActive}`);
    });
    
    const serviceTemplates = await ServiceTemplate.find(query)
      .populate('createdBy', 'name email')
      .populate('serviceType', 'name category')
      .sort({ name: 1 });
    
    console.log('📋 Found service templates for sale wizard:', serviceTemplates.length);
    console.log('📊 Sale wizard service templates:', serviceTemplates.map(t => ({ id: t._id, name: t.name, category: t.category })));
    
    res.json({
      success: true,
      data: {
        serviceTemplates,
        count: serviceTemplates.length
      }
    });
  } catch (error) {
    console.error('Error fetching service templates for sale wizard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service templates for sale wizard'
    });
  }
};

// Clean up corrupted service templates
const cleanupServiceTemplates = async (req, res) => {
  try {
    console.log('🧹 Starting service template cleanup...');
    
    // Find and delete corrupted templates
    const corruptedTemplates = await ServiceTemplate.find({
      $or: [
        { name: { $regex: /^undefined/i } },
        { name: { $regex: /^sdfsd/i } },
        { name: { $exists: false } },
        { name: null },
        { name: '' },
        { category: { $exists: false } },
        { category: null },
        { category: '' }
      ]
    });
    
    console.log(`🗑️ Found ${corruptedTemplates.length} corrupted templates to delete`);
    
    if (corruptedTemplates.length > 0) {
      const deleteResult = await ServiceTemplate.deleteMany({
        $or: [
          { name: { $regex: /^undefined/i } },
          { name: { $regex: /^sdfsd/i } },
          { name: { $exists: false } },
          { name: null },
          { name: '' },
          { category: { $exists: false } },
          { category: null },
          { category: '' }
        ]
      });
      
      console.log(`✅ Deleted ${deleteResult.deletedCount} corrupted templates`);
    }
    
    // Get remaining clean templates
    const cleanTemplates = await ServiceTemplate.find({
      isActive: true,
      name: { $exists: true, $ne: null, $ne: '' },
      name: { $not: /^undefined/i },
      name: { $not: /^sdfsd/i },
      category: { $exists: true, $ne: null, $ne: '' }
    }).sort({ name: 1 });
    
    console.log(`📋 Remaining clean templates: ${cleanTemplates.length}`);
    
    res.json({
      success: true,
      message: `Cleanup completed. Deleted ${corruptedTemplates.length} corrupted templates.`,
      data: {
        deletedCount: corruptedTemplates.length,
        remainingCount: cleanTemplates.length,
        cleanTemplates: cleanTemplates.map(t => ({ id: t._id, name: t.name, category: t.category }))
      }
    });
  } catch (error) {
    console.error('Error cleaning up service templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup service templates'
    });
  }
};

// Get service template by ID
const getServiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const serviceTemplate = await ServiceTemplate.findById(id)
      .populate('createdBy', 'name email')
      .populate('serviceType', 'name category');
    
    if (!serviceTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Service template not found'
      });
    }
    
    res.json({
      success: true,
      data: { serviceTemplate }
    });
  } catch (error) {
    console.error('Error fetching service template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service template'
    });
  }
};

// Create new service template
const createServiceTemplate = async (req, res) => {
  try {
    const { name, description, category, serviceType } = req.body;
    const createdBy = req.user.id;
    
    // Validate input data
    if (!name || name.trim() === '' || name.toLowerCase().includes('undefined') || name.toLowerCase().includes('sdfsd')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service template name. Name cannot be empty or contain invalid characters.'
      });
    }
    
    if (!category || category.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }
    
    // Check if service template with same name already exists
    const existingTemplate = await ServiceTemplate.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Service template with this name already exists'
      });
    }
    
    const serviceTemplate = new ServiceTemplate({
      name: name.trim(),
      description: description ? description.trim() : '',
      category: category.trim(),
      serviceType: serviceType || null,
      createdBy
    });
    
    await serviceTemplate.save();
    await serviceTemplate.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: { serviceTemplate },
      message: 'Service template created successfully'
    });
  } catch (error) {
    console.error('Error creating service template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service template'
    });
  }
};

// Update service template
const updateServiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, isActive, serviceType } = req.body;
    
    const serviceTemplate = await ServiceTemplate.findById(id);
    
    if (!serviceTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Service template not found'
      });
    }
    
    // Check if another service template with same name already exists
    if (name && name !== serviceTemplate.name) {
      const existingTemplate = await ServiceTemplate.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      
      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Service template with this name already exists'
        });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (serviceType !== undefined) updateData.serviceType = serviceType;
    
    const updatedTemplate = await ServiceTemplate.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    res.json({
      success: true,
      data: { serviceTemplate: updatedTemplate },
      message: 'Service template updated successfully'
    });
  } catch (error) {
    console.error('Error updating service template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service template'
    });
  }
};

// Delete service template
const deleteServiceTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    
    const serviceTemplate = await ServiceTemplate.findByIdAndDelete(id);
    
    if (!serviceTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Service template not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Service template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting service template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service template'
    });
  }
};

// Get service template categories (admin only)
const getServiceTemplateCategories = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        categories: CATEGORIES_FOR_SELECT
      }
    });
  } catch (error) {
    console.error('Error fetching service template categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service template categories'
    });
  }
};

module.exports = {
  getAllServiceTemplates,
  getServiceTemplatesForSaleWizard,
  cleanupServiceTemplates,
  getServiceTemplate,
  createServiceTemplate,
  updateServiceTemplate,
  deleteServiceTemplate,
  getServiceTemplateCategories
};