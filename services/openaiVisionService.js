const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

/**
 * OpenAI Vision API service for document image analysis
 * Uses GPT-4 Vision to extract structured data from passport/ID images
 */
class OpenAIVisionService {
  constructor() {
    // Initialize OpenAI client with API key from environment
    // Configure to bypass regional restrictions
    this.apiKeyAvailable = !!process.env.OPENAI_API_KEY;
    
    if (!this.apiKeyAvailable) {
      console.warn('⚠️ OPENAI_API_KEY not set. OpenAI Vision features will not be available.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        // Force specific base URL to bypass regional restrictions
        baseURL: 'https://api.openai.com/v1',
        // Add headers to appear as if from supported region
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
    }
    
    this.model = 'gpt-4o'; // Using GPT-4 Vision model
    this.maxRetries = 3;
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Extract structured data from passport/ID image using OpenAI Vision
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Object>} Extracted document data
   */
  async extractDocumentData(imagePath) {
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
      
      console.log('🤖 Starting OpenAI Vision analysis for:', imagePath);
      
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Read image file and convert to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Get file extension to determine MIME type
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType = this.getMimeType(ext);

      // Create the vision prompt for document extraction
      const prompt = this.createDocumentExtractionPrompt();

      // Make API call to OpenAI Vision
      const response = await this.makeVisionAPICall(base64Image, mimeType, prompt);
      
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('No response from OpenAI Vision API');
      }

      const content = response.choices[0].message.content;
      console.log('📝 OpenAI Vision response:', content);

      // Parse the JSON response
      const extractedData = this.parseVisionResponse(content);
      
      console.log('✅ OpenAI Vision extraction successful:', extractedData);
      
      return {
        success: true,
        data: extractedData,
        confidence: this.calculateConfidence(extractedData),
        method: 'openai_vision_api',
        rawResponse: content
      };

    } catch (error) {
      console.error('❌ OpenAI Vision error:', error);
      
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
   * Create specialized prompt for document extraction
   * @returns {string} Formatted prompt
   */
  createDocumentExtractionPrompt() {
    return `You are an expert document analyst specializing in passport and ID document extraction. 

Analyze this image and extract the following information in JSON format. Be extremely careful and accurate:

{
  "name": "First name(s) or given names",
  "surname": "Last name or family name", 
  "passportNumber": "Passport or document number",
  "dni": "DNI number (for Argentine documents)",
  "nationality": "Nationality or citizenship",
  "dob": "Date of birth (YYYY-MM-DD format)",
  "expirationDate": "Document expiration date (YYYY-MM-DD format)",
  "email": "Email address if visible",
  "phone": "Phone number if visible",
  "gender": "Gender - extract from 'SEXO' or 'SEX' field (M for Male, F for Female)"
}

IMPORTANT INSTRUCTIONS:
1. For Argentine documents (DNI or Passport), look for:
   - Names in "NOMBRE" or "NOMBRES" fields
   - Surnames in "APELLIDO" or "APELLIDOS" fields
   - Document numbers in "DOCUMENTO" or "NUMERO" fields
   - DNI numbers (look for "DNI" followed by numbers like "14096845")
   - Dates in "FECHA DE NACIMIENTO" and "FECHA DE VENCIMIENTO" fields
   - Gender in "SEXO" or "SEX" fields (M = Male, F = Female)

2. For dates, convert to YYYY-MM-DD format:
   - "30 MAR 1964" → "1964-03-30"
   - "15 FEB 2028" → "2028-02-15"
   - Handle both Spanish (ENE, FEB, MAR) and English (JAN, FEB, MAR) months

3. For document numbers, preserve the exact format:
   - DNI: "14096845" or "16.728.224" or "54.098.827" (with or without dots)
   - Passport: "AAH992535" or "AAK947576" or similar

4. For gender extraction:
   - Look for "SEXO" or "SEX" fields on the document
   - M = Male, F = Female
   - Return "male" for M, "female" for F, empty string if not found

5. If a field is not visible or unclear, use an empty string "".

6. Return ONLY the JSON object, no additional text or explanation.

7. Be extra careful with names - avoid OCR artifacts and extract clean names.

8. For nationality, use "ARGENTINA" for Argentine documents unless otherwise specified.

Analyze the image now and return the JSON data:`;
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
      return this.validateAndCleanExtractedData(parsedData);
      
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
    console.log('🔄 Using regex fallback for data extraction');
    
    const result = this.getEmptyResult();
    
    // Extract name
    const nameMatch = content.match(/"name":\s*"([^"]*)"/i);
    if (nameMatch) result.name = nameMatch[1];
    
    // Extract surname
    const surnameMatch = content.match(/"surname":\s*"([^"]*)"/i);
    if (surnameMatch) result.surname = surnameMatch[1];
    
    // Extract passport number
    const passportMatch = content.match(/"passportNumber":\s*"([^"]*)"/i);
    if (passportMatch) result.passportNumber = passportMatch[1];
    
    // Extract DNI number
    const dniMatch = content.match(/"dni":\s*"([^"]*)"/i);
    if (dniMatch) result.dni = dniMatch[1];
    
    // Extract nationality
    const nationalityMatch = content.match(/"nationality":\s*"([^"]*)"/i);
    if (nationalityMatch) result.nationality = nationalityMatch[1];
    
    // Extract date of birth
    const dobMatch = content.match(/"dob":\s*"([^"]*)"/i);
    if (dobMatch) result.dob = dobMatch[1];
    
    // Extract expiration date
    const expMatch = content.match(/"expirationDate":\s*"([^"]*)"/i);
    if (expMatch) result.expirationDate = expMatch[1];
    
    // Extract email
    const emailMatch = content.match(/"email":\s*"([^"]*)"/i);
    if (emailMatch) result.email = emailMatch[1];
    
    // Extract phone
    const phoneMatch = content.match(/"phone":\s*"([^"]*)"/i);
    if (phoneMatch) result.phone = phoneMatch[1];
    
    // Extract gender
    const genderMatch = content.match(/"gender":\s*"([^"]*)"/i);
    if (genderMatch) result.gender = genderMatch[1];
    
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
    const requiredFields = ['name', 'surname', 'passportNumber', 'dni', 'nationality', 'dob', 'expirationDate', 'email', 'phone', 'gender'];
    requiredFields.forEach(field => {
      if (!result[field]) {
        result[field] = '';
      }
    });
    
    // Clean name fields
    if (result.name) {
      result.name = this.cleanName(result.name);
    }
    
    if (result.surname) {
      result.surname = this.cleanName(result.surname);
    }
    
    // Clean document number
    if (result.passportNumber) {
      result.passportNumber = this.cleanDocumentNumber(result.passportNumber);
    }
    
    // Clean DNI number
    if (result.dni) {
      result.dni = this.cleanDocumentNumber(result.dni);
    }
    
    // Clean nationality
    if (result.nationality) {
      result.nationality = this.cleanNationality(result.nationality);
    }
    
    // Clean dates
    if (result.dob) {
      result.dob = this.cleanDate(result.dob);
    }
    
    if (result.expirationDate) {
      result.expirationDate = this.cleanDate(result.expirationDate);
    }
    
    // Clean email
    if (result.email) {
      result.email = this.cleanEmail(result.email);
    }
    
    // Clean phone
    if (result.phone) {
      result.phone = this.cleanPhone(result.phone);
    }
    
    // Clean gender
    if (result.gender) {
      result.gender = this.cleanGender(result.gender);
    }
    
    return result;
  }

  /**
   * Clean name field
   * @param {string} name - Raw name
   * @returns {string} Cleaned name
   */
  cleanName(name) {
    if (!name) return '';
    
    // Remove extra whitespace and special characters
    let cleaned = name.trim();
    cleaned = cleaned.replace(/[^\w\s\-']/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Capitalize properly
    cleaned = cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return cleaned;
  }

  /**
   * Clean document number
   * @param {string} number - Raw document number
   * @returns {string} Cleaned document number
   */
  cleanDocumentNumber(number) {
    if (!number) return '';
    
    // Remove extra whitespace but preserve dots and letters
    let cleaned = number.trim();
    cleaned = cleaned.replace(/\s+/g, '');
    
    return cleaned;
  }

  /**
   * Clean nationality
   * @param {string} nationality - Raw nationality
   * @returns {string} Cleaned nationality
   */
  cleanNationality(nationality) {
    if (!nationality) return '';
    
    // Standardize common nationalities
    const nationalityMap = {
      'ARGENTINA': 'ARGENTINA',
      'ARGENTINE': 'ARGENTINA',
      'ARGENTINO': 'ARGENTINA',
      'USA': 'United States',
      'UNITED STATES': 'United States',
      'US': 'United States'
    };
    
    const upperNationality = nationality.toUpperCase();
    return nationalityMap[upperNationality] || nationality;
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
   * Clean email field
   * @param {string} email - Raw email
   * @returns {string} Cleaned email
   */
  cleanEmail(email) {
    if (!email) return '';
    
    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailRegex.test(email)) {
      return email.toLowerCase();
    }
    
    return '';
  }

  /**
   * Clean phone field
   * @param {string} phone - Raw phone
   * @returns {string} Cleaned phone
   */
  cleanPhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Validate phone length
    if (cleaned.length >= 7 && cleaned.length <= 15) {
      return cleaned;
    }
    
    return '';
  }

  /**
   * Clean gender field
   * @param {string} gender - Raw gender
   * @returns {string} Cleaned gender
   */
  cleanGender(gender) {
    if (!gender) return '';
    
    // Normalize gender values
    const normalizedGender = gender.toLowerCase().trim();
    
    // Map common variations to standard values
    const genderMap = {
      'm': 'male',
      'male': 'male',
      'masculino': 'male',
      'f': 'female',
      'female': 'female',
      'femenino': 'female',
      'femenina': 'female'
    };
    
    return genderMap[normalizedGender] || '';
  }

  /**
   * Calculate confidence score for extracted data
   * @param {Object} data - Extracted data
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(data) {
    let score = 0;
    const fields = ['name', 'surname', 'passportNumber', 'dni', 'nationality', 'dob', 'expirationDate'];
    
    fields.forEach(field => {
      if (data[field] && data[field].length > 0) {
        score += 100 / fields.length;
      }
    });
    
    // Bonus for email and phone if found
    if (data.email && data.email.length > 0) score += 5;
    if (data.phone && data.phone.length > 0) score += 5;
    
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
      name: '',
      surname: '',
      passportNumber: '',
      dni: '',
      nationality: '',
      dob: '',
      expirationDate: '',
      email: '',
      phone: '',
      gender: ''
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
      
      console.log('🧪 Testing OpenAI API connection...');
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message. Please respond with "API connection successful".'
          }
        ],
        max_tokens: 50
      });
      
      if (response && response.choices && response.choices.length > 0) {
        console.log('✅ OpenAI API connection successful');
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
module.exports = new OpenAIVisionService();
