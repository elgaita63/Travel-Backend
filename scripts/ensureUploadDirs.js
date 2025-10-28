const { ensureUploadDirectory } = require('../utils/uploadUtils');
const path = require('path');

/**
 * Ensure all required upload directories exist on server startup
 */
function ensureAllUploadDirectories() {
  console.log('📁 Ensuring upload directories exist...');
  
  const uploadDirs = [
    'uploads',
    'uploads/receipts',
    'uploads/passports',
    'uploads/payments',
    'uploads/sales',
    'uploads/provider-documents'
  ];
  
  let successCount = 0;
  let failCount = 0;
  
  uploadDirs.forEach(dir => {
    const success = ensureUploadDirectory(dir);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.error(`❌ Failed to create directory: ${dir}`);
    }
  });
  
  console.log(`✅ Upload directories check complete: ${successCount} successful, ${failCount} failed`);
  
  if (failCount > 0) {
    console.warn('⚠️ Some upload directories could not be created. File uploads may fail.');
  }
  
  return failCount === 0;
}

module.exports = { ensureAllUploadDirectories };

// Run if called directly
if (require.main === module) {
  ensureAllUploadDirectories();
}
