/**
 * Progress Indicator Component
 * 
 * UI component for displaying progress during long-running operations.
 * Shows a progress bar with percentage and status message.
 * 
 * Requirements:
 * - 7.9: Display progress indicator during fetch operation
 * - 8.7: Display export progress and completion status
 * - 9.6: Display progress for each polygon being processed
 * - 10.5: Provide loading indicators during long-running operations
 */

class ProgressIndicator {
  /**
   * Create a ProgressIndicator instance
   * 
   * Creates the progress indicator HTML structure and injects it into the document body.
   * The indicator is initially hidden and can be shown with the show() method.
   * 
   * @example
   * const progress = new ProgressIndicator();
   * progress.show();
   * progress.updateProgress(50);
   * progress.updateMessage('Processing polygon 1 of 2...');
   */
  constructor() {
    // Progress container element ID
    this.containerId = 'progress-container';
    
    // Current progress percentage (0-100)
    this.currentProgress = 0;
    
    // Current status message
    this.currentMessage = 'Processing...';
    
    // Render the component (initially hidden)
    this._render();
  }
  
  /**
   * Show the progress indicator
   * 
   * Displays the progress indicator overlay with initial progress and message.
   * 
   * @param {string} message - Initial status message (optional)
   * 
   * @example
   * progress.show('Fetching satellite imagery...');
   */
  show(message = 'Processing...') {
    this.currentMessage = message;
    this.currentProgress = 0;
    
    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.display = 'flex';
      this._updateUI();
    }
  }
  
  /**
   * Hide the progress indicator
   * 
   * Hides the progress indicator overlay.
   * 
   * @example
   * progress.hide();
   */
  hide() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.display = 'none';
    }
    
    // Reset progress
    this.currentProgress = 0;
    this.currentMessage = 'Processing...';
  }
  
  /**
   * Update the progress percentage
   * 
   * Updates the progress bar to reflect the current completion percentage.
   * 
   * @param {number} percentage - Progress percentage (0-100)
   * @throws {TypeError} If percentage is not a number
   * @throws {RangeError} If percentage is outside 0-100 range
   * 
   * @example
   * progress.updateProgress(75);
   */
  updateProgress(percentage) {
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      throw new TypeError('Percentage must be a number');
    }
    
    if (percentage < 0 || percentage > 100) {
      throw new RangeError('Percentage must be between 0 and 100');
    }
    
    this.currentProgress = percentage;
    this._updateUI();
  }
  
  /**
   * Update the status message
   * 
   * Updates the text displayed above the progress bar.
   * 
   * @param {string} message - Status message
   * @throws {TypeError} If message is not a string
   * 
   * @example
   * progress.updateMessage('Processing polygon 2 of 5...');
   */
  updateMessage(message) {
    if (typeof message !== 'string') {
      throw new TypeError('Message must be a string');
    }
    
    this.currentMessage = message;
    this._updateUI();
  }
  
  /**
   * Render the progress indicator HTML structure
   * 
   * Creates the progress overlay with message, progress bar, and percentage display.
   * 
   * @private
   */
  _render() {
    // Check if container already exists
    if (document.getElementById(this.containerId)) {
      return;
    }
    
    const progressHTML = `
      <div id="${this.containerId}" class="progress-container" style="display: none;">
        <div class="progress-content">
          <div id="progress-message" class="progress-message">Processing...</div>
          <div class="progress-bar">
            <div id="progress-bar-fill" class="progress-bar-fill" style="width: 0%;"></div>
          </div>
          <div id="progress-percentage" class="progress-percentage">0%</div>
        </div>
      </div>
    `;
    
    // Append to document body
    document.body.insertAdjacentHTML('beforeend', progressHTML);
  }
  
  /**
   * Update the UI to reflect current progress and message
   * 
   * @private
   */
  _updateUI() {
    const messageElement = document.getElementById('progress-message');
    const barFillElement = document.getElementById('progress-bar-fill');
    const percentageElement = document.getElementById('progress-percentage');
    
    if (messageElement) {
      messageElement.textContent = this.currentMessage;
    }
    
    if (barFillElement) {
      barFillElement.style.width = `${this.currentProgress}%`;
    }
    
    if (percentageElement) {
      percentageElement.textContent = `${Math.round(this.currentProgress)}%`;
    }
  }
}

export default ProgressIndicator;
export { ProgressIndicator };
