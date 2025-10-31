/**
 * Fixed Service Template Categories
 * These categories are predefined and can only be managed by admin users
 */

const SERVICE_TEMPLATE_CATEGORIES = {
  PACKAGE: 'Package',
  HOTEL: 'Hotel', 
  AIR: 'Air',
  TRANSFERS: 'Transfers',
  ASSISTANCE: 'Assistance',
  CRUISE: 'Cruise',
  CAR_RENTAL: 'Car Rental',
  TOUR: 'Tour',
  OTHER: 'Other'
};

// Array of all categories for easy iteration
const CATEGORIES_ARRAY = Object.values(SERVICE_TEMPLATE_CATEGORIES);

// Array of categories for frontend dropdowns
const CATEGORIES_FOR_SELECT = CATEGORIES_ARRAY.map(category => ({
  value: category,
  label: category
}));

module.exports = {
  SERVICE_TEMPLATE_CATEGORIES,
  CATEGORIES_ARRAY,
  CATEGORIES_FOR_SELECT
};
