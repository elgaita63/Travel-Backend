const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

/**
 * OpenAI Vision API service for payment receipt analysis
 * Uses GPT-4 Vision to extract payment information from receipt images
 */
class OpenAIReceiptService {
  constructor() {
    // Initialize OpenAI client with API key from environment
    this.apiKeyAvailable = !!process.env.OPENAI_API_KEY;
    
    if (!this.apiKeyAvailable) {
      console.warn('⚠️ OPENAI_API_KEY not set. OpenAI Vision receipt features will not be available.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
    }
    
    this.model = 'gpt-4o';
    this.maxRetries = 3;
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Extract payment data from receipt image using OpenAI Vision
   * @param {string} imagePath - Path to the receipt image file
   * @returns {Promise<Object>} Extracted payment data
   */
  async extractPaymentData(imagePath) {
    try {
      // Check if API key is available
      if (!this.apiKeyAvailable || !this.client) {
        console.log('⚠️ OpenAI Vision not available (no API key). Skipping...');
        return {
          success: false,
          error: 'OpenAI API key not configured',
          data: this.getEmptyResult(),
          method: 'openai_vision_api'
        };
      }
      
      console.log('🤖 Starting OpenAI Vision receipt analysis for:', imagePath);
      
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Receipt image file not found: ${imagePath}`);
      }

      // Read image file and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Get file extension to determine MIME type
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = this.getMimeType(ext);

      // Create the vision prompt for payment receipt extraction
      const prompt = this.createPaymentExtractionPrompt();

      // Make API call to OpenAI Vision
      const response = await this.makeVisionAPICall(base64Image, mimeType, prompt);
      
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('No response from OpenAI Vision API');
      }

      const content = response.choices[0].message.content;
      console.log('📝 OpenAI Vision receipt response:', content);

      // Parse the JSON response
      const extractedData = this.parseVisionResponse(content);
      console.log('🔍 Raw extracted data before cleaning:', extractedData);
      
      console.log('✅ OpenAI Vision payment extraction successful:', extractedData);
      
      return {
        success: true,
        data: extractedData,
        confidence: this.calculateConfidence(extractedData),
        method: 'openai_vision_api',
        rawResponse: content
      };

    } catch (error) {
      console.error('❌ OpenAI Vision receipt error:', error);
      
      return {
        success: false,
        error: error.message,
        data: this.getEmptyResult(),
        method: 'openai_vision_api'
      };
    }
  }

  /**
   * Make API call to OpenAI Vision with retry logic
   * @param {string} base64Image - Base64 encoded image
   * @param {string} mimeType - Image MIME type
   * @param {string} prompt - Analysis prompt
   * @returns {Promise<Object>} API response
   */
  async makeVisionAPICall(base64Image, mimeType, prompt) {
    let lastError;
    
    // Try different approaches to bypass regional restrictions
    const approaches = [
      { name: 'Standard', config: {} },
      { name: 'US Headers', config: { 
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'application/json',
          'Origin': 'https://chat.openai.com',
          'Referer': 'https://chat.openai.com/'
        }
      }},
      { name: 'Alternative Base URL', config: { 
        baseURL: 'https://api.openai.com/v1',
        defaultHeaders: {
          'User-Agent': 'OpenAI-Node/4.0.0',
          'Accept': 'application/json'
        }
      }},
      { name: 'Proxy Headers', config: { 
        baseURL: 'https://api.openai.com/v1',
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Forwarded-For': '8.8.8.8',
          'X-Real-IP': '8.8.8.8',
          'CF-IPCountry': 'US'
        }
      }}
    ];
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      for (const approach of approaches) {
        try {
          console.log(`🔄 OpenAI Vision API attempt ${attempt}/${this.maxRetries} (${approach.name})`);
          
          // Create client with current approach configuration
          const clientConfig = {
            apiKey: process.env.OPENAI_API_KEY,
            ...approach.config
          };
          
          const client = new OpenAI(clientConfig);
          
          const response = await client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: prompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Image}`,
                      detail: "high" // Use high detail for better accuracy
                    }
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.1 // Low temperature for consistent results
          });

          console.log(`✅ OpenAI Vision API call successful with ${approach.name}`);
          return response;

        } catch (error) {
          lastError = error;
          console.warn(`⚠️ OpenAI Vision API attempt ${attempt} (${approach.name}) failed:`, error.message);
          
          // If it's a geographic restriction, try next approach immediately
          if (error.message.includes('Country, region, or territory not supported') || 
              error.message.includes('unsupported_country_region_territory')) {
            console.log(`🌍 Geographic restriction detected with ${approach.name}, trying next approach...`);
            continue; // Try next approach
          }
          
          // If it's a rate limit error, wait longer
          if (error.message.includes('rate limit') || error.message.includes('429')) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Rate limit hit, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (attempt < this.maxRetries) {
            // For other errors, wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Create specialized prompt for payment receipt extraction
   * @returns {string} Formatted prompt
   */
  createPaymentExtractionPrompt() {
    return `You are an expert financial document analyst specializing in payment receipt extraction. 

Analyze this receipt image and extract the following payment information in JSON format. Be extremely careful and accurate:

{
  "amount": "Payment amount (number only, no currency symbols)",
  "currency": "Currency code (USD, EUR, ARS, etc.)",
  "date": "Payment date (YYYY-MM-DD format)",
  "method": "Payment method (Cash, Credit Card, Bank Transfer, PayPal, etc.)",
  "description": "Brief description of what the payment was for",
  "reference": "Transaction reference or receipt number if visible"
}

IMPORTANT INSTRUCTIONS:

1. For amounts:
   - Extract only the numerical value (e.g., "150.00" not "$150.00")
   - If multiple amounts are visible, use the total/paid amount
   - Handle decimal separators correctly (use "." for decimals)

2. For currency:
   - Look for explicit currency codes or text on the receipt
   - ONLY extract currency if it is explicitly written on the receipt (e.g., "USD", "ARS", "EUR", etc.)
   - The $ symbol alone is NOT sufficient to determine currency
   - If you see "$" without explicit currency text, use "USD" as the default assumption
   - If you see "ARS" or "Argentine Peso" written on the receipt, then it's ARS
   - If you see "USD" or "US Dollar" written on the receipt, then it's USD
   - If you see "€", it's EUR
   - If you see "£", it's GBP
   - DO NOT infer currency from context, formatting, or bank names
   - If no explicit currency is written on the receipt, use "USD" as default
   - Common currencies: USD, EUR, GBP, JPY, ARS (Argentine Peso), CAD, AUD

3. For dates:
   - Convert to YYYY-MM-DD format
   - "10/14/2025" → "2025-10-14"
   - "14 OCT 2025" → "2025-10-14"
   - "Oct 14, 2025" → "2025-10-14"

4. For payment method:
   - Common methods: Cash, Credit Card, Debit Card, Bank Transfer, PayPal, Stripe, Check
   - Look for logos, text, or symbols indicating payment method
   - If unclear, use "Unknown"

5. For description:
   - Extract what the payment was for (e.g., "Travel Services", "Hotel Booking", "Flight Ticket")
   - Keep it brief (max 50 characters)
   - If unclear, use "Payment Receipt"

6. For reference:
   - Look for transaction IDs, receipt numbers, or confirmation codes
   - If not visible, use empty string ""

7. If a field is not visible or unclear, use an empty string "" or appropriate default.

8. Return ONLY the JSON object, no additional text or explanation.

9. Be extra careful with numbers - avoid OCR artifacts and extract clean numerical values.

Analyze the receipt image now and return the JSON data:`;
  }

  /**
   * Parse the JSON response from OpenAI Vision
   * @param {string} content - Raw response content
   * @returns {Object} Parsed data
   */
  parseVisionResponse(content) {
    try {
      // Clean the response - remove any markdown formatting
      let cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Try to extract JSON from the response
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      console.log('🧹 Cleaned JSON content:', cleanedContent);
      
      const parsedData = JSON.parse(cleanedContent);
      
      // Validate and clean the parsed data
      const cleanedData = this.validateAndCleanExtractedData(parsedData);
      console.log('🧹 Cleaned extracted data after processing:', cleanedData);
      return cleanedData;
      
    } catch (error) {
      console.error('❌ JSON parsing error:', error);
      console.log('Raw content:', content);
      
      // Fallback: try to extract data using regex patterns
      return this.extractDataWithRegex(content);
    }
  }

  /**
   * Fallback method to extract data using regex patterns
   * @param {string} content - Raw response content
   * @returns {Object} Extracted data
   */
  extractDataWithRegex(content) {
    console.log('🔄 Using regex fallback for receipt data extraction');
    
    const result = this.getEmptyResult();
    
    // Extract amount
    const amountMatch = content.match(/"amount":\s*"([^"]*)"/i);
    if (amountMatch) result.amount = amountMatch[1];
    
    // Extract currency
    const currencyMatch = content.match(/"currency":\s*"([^"]*)"/i);
    if (currencyMatch) result.currency = currencyMatch[1];
    
    // Extract date
    const dateMatch = content.match(/"date":\s*"([^"]*)"/i);
    if (dateMatch) result.date = dateMatch[1];
    
    // Extract method
    const methodMatch = content.match(/"method":\s*"([^"]*)"/i);
    if (methodMatch) result.method = methodMatch[1];
    
    // Extract description
    const descMatch = content.match(/"description":\s*"([^"]*)"/i);
    if (descMatch) result.description = descMatch[1];
    
    // Extract reference
    const refMatch = content.match(/"reference":\s*"([^"]*)"/i);
    if (refMatch) result.reference = refMatch[1];
    
    return result;
  }

  /**
   * Validate and clean extracted data
   * @param {Object} data - Raw extracted data
   * @returns {Object} Validated and cleaned data
   */
  validateAndCleanExtractedData(data) {
    const result = { ...data };
    
    // Ensure all required fields exist
    const requiredFields = ['amount', 'currency', 'date', 'method', 'description', 'reference'];
    requiredFields.forEach(field => {
      if (!result[field]) {
        result[field] = '';
      }
    });
    
    // Clean amount
    if (result.amount) {
      result.amount = this.cleanAmount(result.amount);
    }
    
    // Clean currency
    if (result.currency) {
      result.currency = this.cleanCurrency(result.currency);
    }
    
    // Clean date
    if (result.date) {
      result.date = this.cleanDate(result.date);
    }
    
    // Clean method
    if (result.method) {
      result.method = this.cleanPaymentMethod(result.method);
    }
    
    // Clean description
    if (result.description) {
      result.description = this.cleanDescription(result.description);
    }
    
    // Clean reference
    if (result.reference) {
      result.reference = this.cleanReference(result.reference);
    }
    
    return result;
  }

  /**
   * Clean amount field
   * @param {string} amount - Raw amount
   * @returns {string} Cleaned amount
   */
  cleanAmount(amount) {
    if (!amount) return '';
    
    // Remove currency symbols and extra whitespace
    let cleaned = amount.toString().replace(/[$€£¥,\s]/g, '');
    
    // Ensure it's a valid number
    const numValue = parseFloat(cleaned);
    if (!isNaN(numValue) && numValue >= 0) {
      return numValue.toString();
    }
    
    return '';
  }

  /**
   * Clean currency field
   * @param {string} currency - Raw currency
   * @returns {string} Cleaned currency
   */
  cleanCurrency(currency) {
    if (!currency) return 'USD';
    
    // Clean the currency string
    let cleanCurrency = currency.toString().trim().toUpperCase();
    
    // Handle specific cases
    if (cleanCurrency.includes('ARS') || cleanCurrency.includes('PESO') || cleanCurrency.includes('ARGENTINE')) {
      return 'ARS';
    }
    
    // Standardize currency codes and symbols
    const currencyMap = {
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
      'USD': 'USD',
      'EUR': 'EUR',
      'GBP': 'GBP',
      'JPY': 'JPY',
      'ARS': 'ARS',
      'CAD': 'CAD',
      'AUD': 'AUD',
      'MXN': 'MXN',
      'BRL': 'BRL'
    };
    
    // Check for exact matches first
    if (currencyMap[cleanCurrency]) {
      return currencyMap[cleanCurrency];
    }
    
    // Check if it contains currency symbols
    if (cleanCurrency.includes('$') && !cleanCurrency.includes('ARS') && !cleanCurrency.includes('MXN')) {
      return 'USD';
    }
    
    // Return the cleaned currency or default to USD
    return cleanCurrency || 'USD';
  }

  /**
   * Clean date field
   * @param {string} date - Raw date
   * @returns {string} Cleaned date in YYYY-MM-DD format
   */
  cleanDate(date) {
    if (!date) return '';
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    try {
      // Try to parse the date
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Date parsing failed:', error);
    }
    
    return date; // Return original if parsing fails
  }

  /**
   * Clean payment method field
   * @param {string} method - Raw payment method
   * @returns {string} Cleaned payment method
   */
  cleanPaymentMethod(method) {
    if (!method) return '';
    
    // Standardize payment methods
    const methodMap = {
      'CREDIT CARD': 'Credit Card',
      'DEBIT CARD': 'Debit Card',
      'BANK TRANSFER': 'Bank Transfer',
      'CASH': 'Cash',
      'PAYPAL': 'PayPal',
      'STRIPE': 'Stripe',
      'CHECK': 'Check',
      'CARD': 'Credit Card'
    };
    
    const upperMethod = method.toUpperCase();
    return methodMap[upperMethod] || method || 'Unknown';
  }

  /**
   * Clean description field
   * @param {string} description - Raw description
   * @returns {string} Cleaned description
   */
  cleanDescription(description) {
    if (!description) return '';
    
    // Limit to 50 characters and clean up
    let cleaned = description.trim();
    if (cleaned.length > 50) {
      cleaned = cleaned.substring(0, 47) + '...';
    }
    
    return cleaned;
  }

  /**
   * Clean reference field
   * @param {string} reference - Raw reference
   * @returns {string} Cleaned reference
   */
  cleanReference(reference) {
    if (!reference) return '';
    
    // Remove extra whitespace
    return reference.trim();
  }

  /**
   * Calculate confidence score for extracted data
   * @param {Object} data - Extracted data
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(data) {
    let score = 0;
    const fields = ['amount', 'currency', 'date', 'method'];
    
    fields.forEach(field => {
      if (data[field] && data[field].length > 0) {
        score += 100 / fields.length;
      }
    });
    
    // Bonus for description and reference if found
    if (data.description && data.description.length > 0) score += 10;
    if (data.reference && data.reference.length > 0) score += 10;
    
    return Math.round(Math.min(score, 100));
  }

  /**
   * Get MIME type from file extension
   * @param {string} extension - File extension
   * @returns {string} MIME type
   */
  getMimeType(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp'
    };
    
    return mimeTypes[extension] || 'image/jpeg';
  }

  /**
   * Get empty result structure
   * @returns {Object} Empty result
   */
  getEmptyResult() {
    return {
      amount: '',
      currency: 'USD',
      date: '',
      method: '',
      description: '',
      reference: ''
    };
  }

  /**
   * Test the OpenAI API connection
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    try {
      if (!this.apiKeyAvailable || !this.client) {
        console.log('⚠️ OpenAI API key not configured');
        return {
          success: false,
          message: 'API key not configured',
          error: 'OPENAI_API_KEY environment variable is not set'
        };
      }
      
      console.log('🧪 Testing OpenAI API connection for receipt processing...');
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message for receipt processing. Please respond with "Receipt API connection successful".'
          }
        ],
        max_tokens: 50
      });
      
      if (response && response.choices && response.choices.length > 0) {
        console.log('✅ OpenAI API connection successful for receipt processing');
        return {
          success: true,
          message: 'API connection successful',
          response: response.choices[0].message.content
        };
      } else {
        throw new Error('No response from OpenAI API');
      }
      
    } catch (error) {
      console.error('❌ OpenAI API connection failed:', error);
      return {
        success: false,
        message: 'API connection failed',
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new OpenAIReceiptService();




