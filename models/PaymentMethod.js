const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['currency', 'payment_method'],
    default: 'payment_method'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);