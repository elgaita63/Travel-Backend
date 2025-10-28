const CurrencyUnit = require('../models/CurrencyUnit');
const PaymentMethod = require('../models/PaymentMethod');

// GET /api/manage-currencies - Get all currency units and payment methods
const getAll = async (req, res) => {
  try {
    const [currencyUnits, paymentMethods] = await Promise.all([
      CurrencyUnit.find({ isActive: true }).sort({ code: 1 }),
      PaymentMethod.find({ isActive: true }).sort({ name: 1 })
    ]);

    res.json({
      success: true,
      data: {
        currencyUnits,
        paymentMethods
      }
    });
  } catch (error) {
    console.error('Get all currencies error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// POST /api/manage-currencies/currency - Add new currency unit
const addCurrencyUnit = async (req, res) => {
  try {
    const { code, name, symbol } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Currency code and name are required'
      });
    }

    const currencyUnit = new CurrencyUnit({
      code: code.toUpperCase().trim(),
      name: name.trim(),
      symbol: symbol ? symbol.trim() : ''
    });

    await currencyUnit.save();

    res.status(201).json({
      success: true,
      message: 'Currency unit added successfully',
      data: { currencyUnit }
    });
  } catch (error) {
    console.error('Add currency unit error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Currency unit already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// POST /api/manage-currencies/payment-method - Add new payment method
const addPaymentMethod = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Payment method name is required'
      });
    }

    const paymentMethod = new PaymentMethod({
      name: name.trim(),
      type: 'payment_method'
    });

    await paymentMethod.save();

    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      data: { paymentMethod }
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Payment method already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// DELETE /api/manage-currencies/currency/:id - Delete currency unit
const deleteCurrencyUnit = async (req, res) => {
  try {
    const { id } = req.params;

    await CurrencyUnit.findByIdAndUpdate(id, { isActive: false });

    res.json({
      success: true,
      message: 'Currency unit deleted successfully'
    });
  } catch (error) {
    console.error('Delete currency unit error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// DELETE /api/manage-currencies/payment-method/:id - Delete payment method
const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;

    await PaymentMethod.findByIdAndUpdate(id, { isActive: false });

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// PUT /api/manage-currencies/currency/:id - Update currency unit
const updateCurrencyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, symbol } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Currency unit ID is required'
      });
    }

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Currency code and name are required'
      });
    }

    if (code.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Currency code must be exactly 3 characters'
      });
    }

    // Check if another currency unit with the same code exists (excluding current one)
    const existing = await CurrencyUnit.findOne({ 
      code: code.toUpperCase().trim(), 
      _id: { $ne: id },
      isActive: true
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A currency unit with this code already exists'
      });
    }

    const currencyUnit = await CurrencyUnit.findByIdAndUpdate(
      id,
      {
        code: code.toUpperCase().trim(),
        name: name.trim(),
        symbol: symbol ? symbol.trim() : ''
      },
      { new: true, runValidators: true }
    );

    if (!currencyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Currency unit not found'
      });
    }

    res.json({
      success: true,
      message: 'Currency unit updated successfully',
      data: { currencyUnit }
    });
  } catch (error) {
    console.error('Update currency unit error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A currency unit with this code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// PUT /api/manage-currencies/payment-method/:id - Update payment method
const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Payment method ID is required'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Payment method name is required'
      });
    }

    // Check if another payment method with the same name exists (excluding current one)
    const existing = await PaymentMethod.findOne({ 
      name: name.trim(), 
      _id: { $ne: id },
      isActive: true
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A payment method with this name already exists'
      });
    }

    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      data: { paymentMethod }
    });
  } catch (error) {
    console.error('Update payment method error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A payment method with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAll,
  addCurrencyUnit,
  addPaymentMethod,
  updateCurrencyUnit,
  updatePaymentMethod,
  deleteCurrencyUnit,
  deletePaymentMethod
};