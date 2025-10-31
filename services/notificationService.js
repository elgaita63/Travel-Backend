const sgMail = require('@sendgrid/mail');

// Check if credentials are properly configured
const isSendGridConfigured = process.env.SENDGRID_API_KEY && 
  process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here' &&
  process.env.SENDGRID_API_KEY.length > 10;

// Initialize SendGrid only if properly configured
if (isSendGridConfigured) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️  SendGrid not configured - email notifications will be mocked');
}

class NotificationService {
  constructor() {
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@travelagency.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'Travel Agency';
    this.isSendGridConfigured = isSendGridConfigured;
  }

  /**
   * Send email notification via SendGrid
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content (optional)
   * @returns {Promise<Object>} SendGrid response
   */
  async sendEmail(to, subject, html, text = null) {
    // If SendGrid is not configured, return a mock success response
    if (!this.isSendGridConfigured) {
      console.log(`📧 [MOCK] Email would be sent to ${to}: ${subject}`);
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        statusCode: 200,
        provider: 'sendgrid-mock'
      };
    }

    try {
      const msg = {
        to: to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: subject,
        html: html,
        ...(text && { text: text })
      };

      const response = await sgMail.send(msg);
      
      console.log(`📧 Email sent successfully to ${to}:`, response[0].statusCode);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode,
        provider: 'sendgrid'
      };
    } catch (error) {
      console.error('SendGrid error:', error);
      
      // If SendGrid fails, log the error but don't throw
      // This allows the system to continue functioning
      return {
        success: false,
        error: error.message,
        provider: 'sendgrid'
      };
    }
  }


  /**
   * Get service configuration status
   * @returns {Object} Service status information
   */
  getServiceStatus() {
    return {
      sendGrid: {
        configured: this.isSendGridConfigured,
        fromEmail: this.fromEmail,
        fromName: this.fromName
      },
      mode: this.isSendGridConfigured ? 'production' : 'development'
    };
  }

  /**
   * Send email notification
   * @param {Object} client - Client object with contact info
   * @param {string} subject - Email subject
   * @param {string} emailContent - HTML email content
   * @param {Object} preferences - Client notification preferences
   * @returns {Promise<Object>} Results
   */
  async sendNotification(client, subject, emailContent, preferences = {}) {
    const results = {
      email: null,
      clientId: client._id,
      timestamp: new Date(),
      mode: this.getServiceStatus().mode
    };

    // Send email if enabled and client has email
    if (preferences.email !== false && client.email) {
      results.email = await this.sendEmail(
        client.email,
        subject,
        emailContent
      );
    }

    return results;
  }

  /**
   * Generate trip reminder email content
   * @param {Object} sale - Sale object with trip details
   * @param {Object} client - Client object
   * @returns {Object} Email content
   */
  generateTripReminderContent(sale, client) {
    const tripDate = new Date(sale.services[0]?.metadata?.date || sale.createdAt);
    const formattedDate = tripDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailSubject = `Trip Reminder - Your Travel is in 72 Hours!`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Trip Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .trip-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌍 Trip Reminder</h1>
            <p>Your travel is approaching!</p>
          </div>
          <div class="content">
            <h2>Hello ${client.name} ${client.surname}!</h2>
            <p>This is a friendly reminder that your trip is scheduled to begin in <strong>72 hours</strong> on <strong>${formattedDate}</strong>.</p>
            
            <div class="trip-details">
              <h3>Trip Details:</h3>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Total Cost:</strong> $${sale.totalSalePrice.toFixed(2)}</p>
              <p><strong>Status:</strong> ${sale.status}</p>
            </div>
            
            <p>Please ensure you have all necessary documents and are prepared for your journey.</p>
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Safe travels!</p>
            <p><strong>Travel Agency Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: emailSubject,
      emailContent
    };
  }

  /**
   * Generate return notification content
   * @param {Object} sale - Sale object with trip details
   * @param {Object} client - Client object
   * @returns {Object} Email content
   */
  generateReturnNotificationContent(sale, client) {
    const emailSubject = `Welcome Back! How was your trip?`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome Back</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .trip-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 Welcome Back!</h1>
            <p>We hope you had an amazing trip!</p>
          </div>
          <div class="content">
            <h2>Hello ${client.name} ${client.surname}!</h2>
            <p>Welcome back! We hope you had a wonderful and memorable trip.</p>
            
            <div class="trip-details">
              <h3>Your Trip Summary:</h3>
              <p><strong>Total Cost:</strong> $${sale.totalSalePrice.toFixed(2)}</p>
              <p><strong>Status:</strong> ${sale.status}</p>
            </div>
            
            <p>We would love to hear about your experience! Please share your feedback with us.</p>
            <p>If you're planning your next adventure, we're here to help make it even better!</p>
            
            <p>Thank you for choosing us for your travel needs.</p>
            <p><strong>Travel Agency Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: emailSubject,
      emailContent
    };
  }

  /**
   * Generate passport expiry reminder content
   * @param {Object} client - Client object
   * @param {number} daysUntilExpiry - Days until passport expires
   * @returns {Object} Email content
   */
  generatePassportExpiryContent(client, daysUntilExpiry) {
    const emailSubject = `Passport Expiry Reminder - Action Required`;
    
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Passport Expiry Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .passport-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Passport Expiry Reminder</h1>
            <p>Action Required</p>
          </div>
          <div class="content">
            <h2>Hello ${client.name} ${client.surname}!</h2>
            <p>This is an important reminder about your passport expiration.</p>
            
            <div class="passport-details">
              <h3>Passport Information:</h3>
              <p><strong>Passport Number:</strong> ${client.passportNumber}</p>
              <p><strong>Expiration Date:</strong> ${new Date(client.expirationDate).toLocaleDateString()}</p>
              <p><strong>Days Until Expiry:</strong> ${daysUntilExpiry} days</p>
            </div>
            
            <p><strong>Important:</strong> Many countries require passports to be valid for at least 6 months beyond your travel dates.</p>
            <p>We recommend renewing your passport as soon as possible to avoid any travel disruptions.</p>
            
            <p>If you need assistance with passport renewal or have any questions, please contact us.</p>
            
            <p><strong>Travel Agency Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: emailSubject,
      emailContent
    };
  }


  /**
   * Test notification service (for development)
   * @param {string} email - Test email address
   * @returns {Promise<Object>} Test results
   */
  async testNotification(email) {
    const testResults = {
      email: null,
      timestamp: new Date()
    };

    if (email) {
      testResults.email = await this.sendEmail(
        email,
        'Test Notification - Travel Agency',
        '<h1>Test Email</h1><p>This is a test notification from the Travel Agency system.</p>'
      );
    }

    return testResults;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;