const Destination = require('../models/Destination');

// GET /api/destinations - Get all destinations
const getDestinations = async (req, res) => {
  try {
    const { search, country, isActive = true } = req.query;
    
    let query = {};
    
    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by country
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }
    
    const destinations = await Destination.find(query)
      .populate('createdBy', 'username email')
      .sort({ name: 1, country: 1 });
    
    res.status(200).json({
      success: true,
      data: { destinations }
    });
    
  } catch (error) {
    console.error('Get destinations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching destinations'
    });
  }
};

// GET /api/destinations/:id - Get destination by ID
const getDestination = async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id)
      .populate('createdBy', 'username email');
    
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: { destination }
    });
    
  } catch (error) {
    console.error('Get destination error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching destination'
    });
  }
};

// POST /api/destinations - Create new destination
const createDestination = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const destinationData = {
      ...req.body,
      createdBy: userId
    };
    
    const destination = new Destination(destinationData);
    await destination.save();
    
    await destination.populate('createdBy', 'username email');
    
    res.status(201).json({
      success: true,
      message: 'Destination created successfully',
      data: { destination }
    });
    
  } catch (error) {
    console.error('Create destination error:', error);
    
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
      message: 'Internal server error while creating destination'
    });
  }
};

// PUT /api/destinations/:id - Update destination
const updateDestination = async (req, res) => {
  try {
    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username email');
    
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Destination updated successfully',
      data: { destination }
    });
    
  } catch (error) {
    console.error('Update destination error:', error);
    
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
      message: 'Internal server error while updating destination'
    });
  }
};

// DELETE /api/destinations/:id - Delete destination
const deleteDestination = async (req, res) => {
  try {
    const destination = await Destination.findByIdAndDelete(req.params.id);
    
    if (!destination) {
      return res.status(404).json({
        success: false,
        message: 'Destination not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Destination deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete destination error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting destination'
    });
  }
};

// POST /api/destinations/search - Search destinations with autocomplete
const searchDestinations = async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: { destinations: [] }
      });
    }
    
    const destinations = await Destination.find({
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { country: { $regex: query, $options: 'i' } },
        { city: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name country city popularServices')
    .limit(parseInt(limit))
    .sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      data: { destinations }
    });
    
  } catch (error) {
    console.error('Search destinations error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching destinations'
    });
  }
};

// POST /api/destinations/search-cities - Search cities with autocomplete
const searchCities = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: { cities: [] }
      });
    }
    
    const cities = await Destination.aggregate([
      {
        $match: {
          isActive: true,
          city: { $regex: query, $options: 'i' }
        }
      },
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          country: '$_id.country'
        }
      },
      {
        $sort: { city: 1 }
      },
      {
        $limit: limit
      }
    ]);
    
    res.json({
      success: true,
      data: { cities }
    });
    
  } catch (error) {
    console.error('Search cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching cities'
    });
  }
};

// POST /api/destinations/search-countries - Search countries with autocomplete
const searchCountries = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: { countries: [] }
      });
    }
    
    const countries = await Destination.aggregate([
      {
        $match: {
          isActive: true,
          country: { $regex: query, $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          country: '$_id'
        }
      },
      {
        $sort: { country: 1 }
      },
      {
        $limit: limit
      }
    ]);
    
    const countryList = countries.map(item => item.country);
    
    res.json({
      success: true,
      data: { countries: countryList }
    });
    
  } catch (error) {
    console.error('Search countries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while searching countries'
    });
  }
};

module.exports = {
  getDestinations,
  getDestination,
  createDestination,
  updateDestination,
  deleteDestination,
  searchDestinations,
  searchCities,
  searchCountries
};