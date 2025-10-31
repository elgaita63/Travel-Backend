class CurrencyService {
  constructor() {
    // Currency service now only provides supported currencies
    // Exchange rates must be provided manually
  }

  /**
   * Get supported currencies (USD and ARS only)
   */
  getSupportedCurrencies() {
    return [
      { code: 'USD', name: 'US Dollar', symbol: 'U$' },
      { code: 'ARS', name: 'Argentine Peso', symbol: '$' }
    ];
  }

  /**
   * Validate currency code
   * @param {string} currency - Currency code to validate
   * @returns {boolean}
   */
  isValidCurrency(currency) {
    const supportedCurrencies = this.getSupportedCurrencies();
    return supportedCurrencies.some(c => c.code === currency.toUpperCase());
  }

  /**
   * Get currency info by code
   * @param {string} code - Currency code
   * @returns {object|null}
   */
  getCurrencyInfo(code) {
    const supportedCurrencies = this.getSupportedCurrencies();
    return supportedCurrencies.find(c => c.code === code.toUpperCase()) || null;
  }
}

// Create singleton instance
const currencyService = new CurrencyService();

module.exports = currencyService;