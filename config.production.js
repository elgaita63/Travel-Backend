// Production configuration for backend
module.exports = {
// Database Configuration - AHORA APUNTANDO A TEST
  MONGODB_URL: 'mongodb+srv://Evaudo:.LH3q2TxPb8yywD@cluster0.so163ar.mongodb.net/marenostrum_test?retryWrites=true&w=majority',
  MONGODB_URI: 'mongodb+srv://Evaudo:.LH3q2TxPb8yywD@cluster0.so163ar.mongodb.net/marenostrum_test?retryWrites=true&w=majority',

  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: 'production',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: 'https://travel-management-system1.netlify.app',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your_production_jwt_secret_key_here',
  
  // File Upload Configuration
  STORAGE_PROVIDER: 'local',
  UPLOAD_PATH: './uploads',
  
  // Email Configuration
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || 'your_sendgrid_api_key_here',
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@travel-ai.com',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || 'Travel AI Agency',
  
  // Twilio Configuration
  TWILIO_SID: process.env.TWILIO_SID || 'your_twilio_sid_here',
  TWILIO_TOKEN: process.env.TWILIO_TOKEN || 'your_twilio_token_here',
  TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+1234567890',
  
  // AWS Configuration
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'your_aws_access_key_here',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'your_aws_secret_key_here',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'your_bucket_name_here',
  
  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloudinary_cloud_name',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || 'your_cloudinary_api_key',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'your_cloudinary_api_secret',
  
  // OpenAI Configuration for Vision API
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
};