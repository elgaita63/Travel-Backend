const mongoose = require('mongoose');

const serviceTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service type name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Service type name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['Hotel', 'Flight', 'Transfer', 'Excursion', 'Insurance', 'Other'],
    default: 'Other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better query performance
serviceTypeSchema.index({ name: 1 });
serviceTypeSchema.index({ category: 1 });
serviceTypeSchema.index({ isActive: 1 });

// Virtual for formatted name
serviceTypeSchema.virtual('formattedName').get(function() {
  return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

// Method to increment usage count
serviceTypeSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Static method to find active service types
serviceTypeSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find by category
serviceTypeSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ name: 1 });
};

module.exports = mongoose.model('ServiceType', serviceTypeSchema);
