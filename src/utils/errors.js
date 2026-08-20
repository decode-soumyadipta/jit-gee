/**
 * Error Model for Satellite Data Web Interface
 * 
 * Provides structured error handling with user-friendly messages
 * for all error scenarios in the application.
 * 
 * Requirements: 10.1, 10.2
 */

/**
 * Custom application error class with type categorization
 * and user-friendly messaging.
 */
class AppError extends Error {
  /**
   * Create an application error
   * @param {string} type - Error type: 'PARSE_ERROR' | 'AUTH_ERROR' | 'FETCH_ERROR' | 'EXPORT_ERROR'
   * @param {string} message - Technical error message for logging
   * @param {*} details - Additional error context (optional)
   */
  constructor(type, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
  
  /**
   * Get user-friendly error message based on error type
   * @returns {string} User-friendly error message
   */
  getUserMessage() {
    const messages = {
      'PARSE_ERROR': 'Failed to parse KML file. Please ensure the file is valid.',
      'AUTH_ERROR': 'Authentication failed. Please sign in to Google Earth Engine.',
      'FETCH_ERROR': 'Failed to fetch satellite imagery. Please check your selections.',
      'EXPORT_ERROR': 'Failed to export GeoTIFF. Please try again.'
    };
    
    return messages[this.type] || 'An unexpected error occurred.';
  }
  
  /**
   * Get structured error information for logging
   * @returns {Object} Structured error data
   */
  toJSON() {
    return {
      timestamp: this.timestamp.toISOString(),
      type: this.type,
      message: this.message,
      details: this.details,
      stack: this.stack
    };
  }
}

// Error type constants
const ErrorTypes = {
  PARSE_ERROR: 'PARSE_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR'
};

export { AppError, ErrorTypes };
