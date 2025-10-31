const mongoose = require('mongoose');
const { SERVICE_TEMPLATE_CATEGORIES } = require('../constants/serviceTemplateCategories');

const serviceTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: {
      values: Object.values(SERVICE_TEMPLATE_CATEGORIES),
      message: 'Category must be one of: ' + Object.values(SERVICE_TEMPLATE_CATEGORIES).join(', ')
    },
    required: [true, 'Category is required'],
    default: SERVICE_TEMPLATE_CATEGORIES.OTHER
  },
  serviceType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceType',
    required: false // Make it optional for backward compatibility
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user ID is required']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
serviceTemplateSchema.index({ name: 1 });
serviceTemplateSchema.index({ category: 1 });
serviceTemplateSchema.index({ isActive: 1 });
serviceTemplateSchema.index({ createdBy: 1 });

// Static method to get available categories
serviceTemplateSchema.statics.getAvailableCategories = function() {
  return Object.values(SERVICE_TEMPLATE_CATEGORIES);
};

// Static method to get categories for frontend select
serviceTemplateSchema.statics.getCategoriesForSelect = function() {
  return Object.values(SERVICE_TEMPLATE_CATEGORIES).map(category => ({
    value: category,
    label: category
  }));
};

// Transform output
serviceTemplateSchema.methods.toJSON = function() {
  const serviceObject = this.toObject();
  serviceObject.id = serviceObject._id; // Include id field for frontend compatibility
  return serviceObject;
};

module.exports = mongoose.model('ServiceTemplate', serviceTemplateSchema);