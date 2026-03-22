// Local development configuration
module.exports = {
  // Database Configuration - LOCAL MONGODB
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/db_dev',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/db_dev',
  
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Frontend URL (for CORS)
  FRONTEND_URL: 'http://localhost:5173',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,

  // JWT Configuration
  JWT_SECRET: 'your_local_jwt_secret_key_here',
  
  // File Upload Configuration
  STORAGE_PROVIDER: 'local',
  UPLOAD_PATH: './uploads',
  
  // Email Configuration (optional for local development)
  SENDGRID_API_KEY: 'your_sendgrid_api_key_here',
  SENDGRID_FROM_EMAIL: 'noreply@localhost',
  SENDGRID_FROM_NAME: 'Travel Agency Local',
  
  // Twilio Configuration (optional for local development)
  TWILIO_SID: 'your_twilio_sid_here',
  TWILIO_TOKEN: 'your_twilio_token_here',
  TWILIO_WHATSAPP_FROM: 'whatsapp:+1234567890',
  
  // AWS Configuration (optional for local development)
  AWS_ACCESS_KEY_ID: 'your_aws_access_key_here',
  AWS_SECRET_ACCESS_KEY: 'your_aws_secret_key_here',
  AWS_REGION: 'us-east-1',
  AWS_S3_BUCKET: 'your_bucket_name_here',
  
  // Cloudinary Configuration (optional for local development)
  CLOUDINARY_CLOUD_NAME: 'your_cloudinary_cloud_name',
  CLOUDINARY_API_KEY: 'your_cloudinary_api_key',
  CLOUDINARY_API_SECRET: 'your_cloudinary_api_secret',
  
};