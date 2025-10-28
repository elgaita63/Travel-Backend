// Backend font utilities for server-side rendering
// This ensures proper font rendering when generating files on Railway

const fs = require('fs');
const path = require('path');

// Font configuration for server-side rendering
const SERVER_FONTS = {
  primary: 'Arial, Helvetica, sans-serif',
  secondary: 'Times, "Times New Roman", serif',
  mono: 'Courier, "Courier New", monospace'
};

// CSS for server-side font rendering
const SERVER_FONT_CSS = `
  * {
    font-family: ${SERVER_FONTS.primary};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  
  body {
    margin: 0;
    padding: 0;
    font-family: ${SERVER_FONTS.primary};
    font-size: 14px;
    line-height: 1.5;
    color: #000;
    background: #fff;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: ${SERVER_FONTS.primary};
    font-weight: 600;
    margin: 0;
    line-height: 1.2;
  }
  
  p {
    font-family: ${SERVER_FONTS.primary};
    margin: 0;
    line-height: 1.5;
  }
  
  .font-mono {
    font-family: ${SERVER_FONTS.mono};
  }
  
  .font-bold {
    font-weight: 700;
  }
  
  .font-semibold {
    font-weight: 600;
  }
  
  .font-medium {
    font-weight: 500;
  }
  
  .font-normal {
    font-weight: 400;
  }
  
  .font-light {
    font-weight: 300;
  }
`;

// Function to create HTML with server-side font rendering
const createServerRenderedHTML = (content, title = 'Document') => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        ${SERVER_FONT_CSS}
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
};

// Function to create styled receipt HTML for server-side rendering
const createServerReceiptHTML = (receipt) => {
  return `
    <div style="width: 100%; background: white; font-family: ${SERVER_FONTS.primary};">
      <!-- Company Header -->
      <div style="background-color: #2563eb; color: white; padding: 20px; margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700; font-family: ${SERVER_FONTS.primary};">${receipt.companyDetails.name}</h2>
            <p style="margin: 5px 0; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.formattedCompanyAddress}</p>
            <p style="margin: 5px 0; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.companyDetails.phone} • ${receipt.companyDetails.email}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 12px; margin: 0; font-family: ${SERVER_FONTS.primary};">Generated:</p>
            <p style="font-weight: 600; margin: 0; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${new Date(receipt.generatedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <!-- Receipt Content -->
      <div style="padding: 20px;">
        <!-- Passenger Details -->
        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 15px; font-size: 18px; font-weight: 600; font-family: ${SERVER_FONTS.primary};">Passenger Details</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Name</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.passengerFullName}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Nationality</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.passengerDetails.nationality}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Passport Number</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.passengerDetails.passportNumber}</div>
            </div>
          </div>
        </div>

        <!-- Service Details -->
        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 15px; font-size: 18px; font-weight: 600; font-family: ${SERVER_FONTS.primary};">Service Details</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Service</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.serviceDetails.title}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Type</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.serviceDetails.type.replace('_', ' ')}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Provider</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.serviceDetails.providerName}</div>
            </div>
            <div style="grid-column: 1 / -1;">
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Dates</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.formattedServiceDates}</div>
            </div>
          </div>
        </div>

        <!-- Payment Details -->
        <div style="margin-bottom: 20px;">
          <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 15px; font-size: 18px; font-weight: 600; font-family: ${SERVER_FONTS.primary};">Payment Details</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Amount</div>
              <div style="font-weight: 700; color: black; font-size: 16px; font-family: ${SERVER_FONTS.primary};">${receipt.formattedPaymentAmount}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Payment Method</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${receipt.paymentDetails.method.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 5px; font-family: ${SERVER_FONTS.primary};">Payment Date</div>
              <div style="font-weight: 700; color: black; font-size: 14px; font-family: ${SERVER_FONTS.primary};">${new Date(receipt.paymentDetails.paymentDate).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Function to create styled report HTML for server-side rendering
const createServerReportHTML = (data, type = 'report') => {
  const title = type === 'report' ? 'Report' : type.charAt(0).toUpperCase() + type.slice(1);
  
  return `
    <div style="width: 100%; background: white; font-family: ${SERVER_FONTS.primary}; padding: 20px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #1f2937; margin-bottom: 20px; font-family: ${SERVER_FONTS.primary};">${title}</h1>
      <div style="font-family: ${SERVER_FONTS.primary};">
        ${data}
      </div>
    </div>
  `;
};

module.exports = {
  SERVER_FONTS,
  SERVER_FONT_CSS,
  createServerRenderedHTML,
  createServerReceiptHTML,
  createServerReportHTML
};