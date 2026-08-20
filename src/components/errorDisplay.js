/**
 * Error Display Component
 * 
 * UI component for displaying error messages in a modal dialog.
 * Shows user-friendly error messages with expandable technical details,
 * error type icons, and retry/dismiss buttons.
 * 
 * Requirements:
 * - 10.1: Display user-friendly error message when error occurs
 * - 10.2: Provide specific error details for debugging
 * - 10.3: Highlight missing fields when required field is missing
 * - 10.4: Display success messages when operations complete successfully
 */

import { AppError, ErrorTypes } from '../utils/errors.js';

class ErrorDisplay {
  /**
   * Create an ErrorDisplay instance
   * 
   * Uses the existing error modal in the HTML.
   * 
   * @example
   * const errorDisplay = new ErrorDisplay();
   * errorDisplay.show(new AppError('PARSE_ERROR', 'Failed to parse KML'));
   */
  constructor() {
    // Retry callback
    this.retryCallback = null;
    
    // Modal element ID (use existing modal from HTML)
    this.modalId = 'error-modal';
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Show the error modal with a user-friendly message
   * 
   * Displays the error modal with the appropriate message and details.
   * If a retry callback is provided, shows a retry button.
   * 
   * @param {AppError|Error} error - Error object to display
   * @param {Function|null} retryCallback - Optional callback for retry button
   * 
   * @example
   * errorDisplay.show(
   *   new AppError('FETCH_ERROR', 'Failed to fetch imagery'),
   *   () => { console.log('Retrying...'); }
   * );
   */
  show(error, retryCallback = null) {
    this.retryCallback = retryCallback;
    
    // Get error details
    const errorType = error instanceof AppError ? error.type : 'UNKNOWN_ERROR';
    const userMessage = error instanceof AppError ? error.getUserMessage() : error.message || 'An unknown error occurred';
    const technicalDetails = error instanceof AppError ? error.details : null;
    const errorStack = error.stack || 'No stack trace available';
    
    // Get modal elements
    const modal = document.getElementById(this.modalId);
    if (!modal) {
      console.error('Error modal not found in DOM');
      return;
    }
    
    const messageElement = document.getElementById('error-message');
    const detailsContainer = document.getElementById('error-details-container');
    const detailsElement = document.getElementById('error-details');
    const retryButton = document.getElementById('error-retry-btn');
    
    // Update message
    if (messageElement) {
      messageElement.textContent = userMessage;
    }
    
    // Update details
    if (detailsElement && detailsContainer) {
      const detailsText = this._formatErrorDetails(errorType, technicalDetails, errorStack);
      detailsElement.textContent = detailsText;
      detailsContainer.style.display = 'block';
    }
    
    // Show/hide retry button based on callback
    if (retryButton) {
      retryButton.style.display = retryCallback ? 'inline-block' : 'none';
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    console.error('Error displayed:', errorType, userMessage, technicalDetails);
  }
  
  /**
   * Hide the error modal
   * 
   * @example
   * errorDisplay.hide();
   */
  hide() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.style.display = 'none';
    }
    
    // Clear retry callback
    this.retryCallback = null;
  }
  
  /**
   * Set up event listeners for close, retry, and dismiss buttons
   * 
   * @private
   */
  _setupEventListeners() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      // Close button (X)
      const closeButton = document.getElementById('close-error-modal');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.hide());
      }
      
      // Retry button
      const retryButton = document.getElementById('error-retry-btn');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          this.hide();
          if (this.retryCallback) {
            this.retryCallback();
          }
        });
      }
      
      // Dismiss button
      const dismissButton = document.getElementById('error-dismiss-btn');
      if (dismissButton) {
        dismissButton.addEventListener('click', () => this.hide());
      }
      
      // Close modal when clicking outside content
      const modal = document.getElementById(this.modalId);
      if (modal) {
        modal.addEventListener('click', (event) => {
          if (event.target === modal) {
            this.hide();
          }
        });
      }
    }, 0);
  }
  
  /**
   * Format error details for display
   * 
   * @private
   * @param {string} errorType - Error type
   * @param {Object|null} details - Error details object
   * @param {string} stack - Error stack trace
   * @returns {string} Formatted text string
   */
  _formatErrorDetails(errorType, details, stack) {
    let text = `Error Type: ${errorType}\n\n`;
    
    if (details) {
      text += `Details:\n${JSON.stringify(details, null, 2)}\n\n`;
    }
    
    text += `Stack Trace:\n${stack}`;
    
    return text;
  }
}

export default ErrorDisplay;
export { ErrorDisplay };
