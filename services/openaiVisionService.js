const OpenAI = require('openai');

/**
 * OpenAI Vision API service for document image analysis
 * Versión optimizada para MEMORIA (Buffers)
 */
class OpenAIVisionService {
  constructor() {
    this.apiKeyAvailable = !!process.env.OPENAI_API_KEY;
    
    if (!this.apiKeyAvailable) {
      console.warn('⚠️ OPENAI_API_KEY not set. OpenAI Vision features will not be available.');
      this.client = null;
    } else {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
    }
    
    this.model = 'gpt-4o';
    this.maxRetries = 3;
    this.timeout = 30000;
  }

  /**
   * Extrae datos usando el BUFFER de la imagen en memoria
   * @param {Buffer} imageBuffer - Buffer de la imagen (desde req.file.buffer)
   */
  async extractDocumentData(imageBuffer) {
    try {
      if (!this.apiKeyAvailable || !this.client) {
        return { success: false, error: 'OpenAI API key not configured', data: this.getEmptyResult() };
      }
      
      console.log('🤖 Starting OpenAI Vision analysis from Memory Buffer...');
      
      // 1. Convertimos el buffer directamente a Base64
      const base64Image = imageBuffer.toString('base64');
      
      // 2. Usamos un MIME type estándar (JPEG/PNG son compatibles)
      const mimeType = 'image/jpeg';

      const prompt = this.createDocumentExtractionPrompt();

      // 3. Llamada a la API con la configuración de reintentos que ya tenías
      const response = await this.makeVisionAPICall(base64Image, mimeType, prompt);
      
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error('No response from OpenAI Vision API');
      }

      const content = response.choices[0].message.content;
      const extractedData = this.parseVisionResponse(content);
      
      console.log('✅ OpenAI Vision extraction successful');
      
      return {
        success: true,
        data: extractedData,
        confidence: this.calculateConfidence(extractedData),
        method: 'openai_vision_api'
      };

    } catch (error) {
      console.error('❌ OpenAI Vision error:', error);
      return { success: false, error: error.message, data: this.getEmptyResult() };
    }
  }

  // --- Mantenemos tus métodos de apoyo intactos para no romper la lógica de extracción ---

  async makeVisionAPICall(base64Image, mimeType, prompt) {
    let lastError;
    const approaches = [
      { name: 'Standard', config: {} },
      { name: 'Proxy Headers', config: { 
        defaultHeaders: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-Forwarded-For': '8.8.8.8'
        }
      }}
    ];
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      for (const approach of approaches) {
        try {
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...approach.config });
          
          const response = await client.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.1
          });

          return response;
        } catch (error) {
          lastError = error;
          if (attempt < this.maxRetries) await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    throw lastError;
  }

  createDocumentExtractionPrompt() {
    return `You are an expert document analyst specializing in passport and ID document extraction. 
    Analyze this image and extract the following information in JSON format:
    {
      "name": "", "surname": "", "passportNumber": "", "dni": "", "nationality": "",
      "dob": "YYYY-MM-DD", "expirationDate": "YYYY-MM-DD", "gender": "male/female"
    }
    Return ONLY the JSON.`;
  }

  parseVisionResponse(content) {
    try {
      let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      return JSON.parse(cleaned);
    } catch (e) {
      return this.getEmptyResult();
    }
  }

  calculateConfidence(data) {
    let score = 0;
    const fields = ['name', 'surname', 'dni'];
    fields.forEach(f => { if (data[f]) score += 33; });
    return Math.min(score, 100);
  }

  getEmptyResult() {
    return { name: '', surname: '', passportNumber: '', dni: '', nationality: '', dob: '', expirationDate: '', gender: '' };
  }
}

module.exports = new OpenAIVisionService();