const mongoose = require('mongoose');

const currencyUnitSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  symbol: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CurrencyUnit', currencyUnitSchema);