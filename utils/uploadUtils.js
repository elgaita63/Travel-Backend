const fs = require('fs');
const path = require('path');

/**
 * Utility functions for handling file uploads
 */

/**
 * Ensure upload directories exist
 * @param {string} dirPath - Directory path to create
 */
function ensureUploadDirectory(dirPath) {
  try {
    // Create directory recursively if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created upload directory: ${dirPath}`);
    }
    
    // Check if directory is writable
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch (error) {
    console.error(`❌ Error with upload directory ${dirPath}:`, error.message);
    return false;
  }
}

/**
 * Get upload directory path based on environment
 * @param {string} subDir - Subdirectory (e.g., 'receipts', 'passports')
 * @returns {string} Full directory path
 */
function getUploadDirectory(subDir = '') {
  const baseDir = process.env.UPLOAD_PATH || './uploads';
  const fullPath = subDir ? path.join(baseDir, subDir) : baseDir;
  
  // Ensure directory exists
  ensureUploadDirectory(fullPath);
  
  return fullPath;
}

/**
 * Safe file deletion with error handling
 * @param {string} filePath - Path to file to delete
 * @returns {boolean} Success status
 */
function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Deleted file: ${filePath}`);
      return true;
    }
    return true; // File doesn't exist, consider it "deleted"
  } catch (error) {
    console.warn(`⚠️ Failed to delete file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Check if file exists and is readable
 * @param {string} filePath - Path to file
 * @returns {boolean} File exists and is readable
 */
function isFileReadable(filePath) {
  try {
    return fs.existsSync(filePath) && fs.accessSync(filePath, fs.constants.R_OK) === undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param {string} filePath - Path to file
 * @returns {number} File size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Validate file before processing
 * @param {string} filePath - Path to file
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Object} Validation result
 */
function validateFile(filePath, maxSize = 10 * 1024 * 1024) {
  const result = {
    valid: false,
    error: null,
    size: 0
  };

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      result.error = 'File does not exist';
      return result;
    }

    // Check if file is readable
    if (!isFileReadable(filePath)) {
      result.error = 'File is not readable';
      return result;
    }

    // Check file size
    result.size = getFileSize(filePath);
    if (result.size === 0) {
      result.error = 'File is empty';
      return result;
    }

    if (result.size > maxSize) {
      result.error = `File too large (${Math.round(result.size / 1024 / 1024)}MB). Maximum allowed: ${Math.round(maxSize / 1024 / 1024)}MB`;
      return result;
    }

    result.valid = true;
    return result;
  } catch (error) {
    result.error = `File validation error: ${error.message}`;
    return result;
  }
}

module.exports = {
  ensureUploadDirectory,
  getUploadDirectory,
  safeDeleteFile,
  isFileReadable,
  getFileSize,
  validateFile
};
