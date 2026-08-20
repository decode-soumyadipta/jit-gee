/**
 * Date Picker Component
 * Version: 2.0 - Added support for single target date picker
 * 
 * UI component for selecting dates for Pre and Post imagery windows.
 * Provides a button interface that opens the browser's native date picker.
 * 
 * Requirements:
 * - 3.1: Provide separate date selection for Pre and Post windows
 * - 3.2: Display calendar picker when user clicks on DATE dropdown
 * - 3.3: Allow users to select any valid date
 * - 3.4: Store selected dates independently for Pre and Post imagery
 * - 3.5: Display the selected date in the corresponding window
 */

class DatePicker {
  /**
   * Create a DatePicker instance
   * 
   * Creates the date picker HTML structure for either Pre or Post window
   * and injects it into the specified container. Sets up event listeners
   * for user interactions.
   * 
   * @param {string} windowType - Type of window ('pre' or 'post')
   * @param {string} containerId - ID of the container element to render the picker in
   * @throws {Error} If container element is not found
   * @throws {TypeError} If windowType is not 'pre' or 'post'
   * 
   * @example
   * const prePicker = new DatePicker('pre', 'pre-date-container');
   * prePicker.onChange((date) => {
   *   console.log('Pre date selected:', date);
   * });
   */
  constructor(windowType, containerId) {
    if (!['pre', 'post', 'target'].includes(windowType)) {
      throw new TypeError('Window type must be "pre", "post", or "target"');
    }
    
    this.windowType = windowType;
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    // Current selected date
    this.selectedDate = null;
    
    // Change callback
    this.changeCallback = null;
    
    // Generate unique IDs for this instance
    this.buttonId = `${windowType}-date-btn`;
    this.inputId = `${windowType}-date-input`;
    this.valueId = `${windowType}-date-value`;
    
    // Render the component
    this._render();
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Get the currently selected date
   * 
   * @returns {Date|null} Selected date or null if not set
   * 
   * @example
   * const date = picker.getDate();
   * // Returns: Date('2024-01-01') or null
   */
  getDate() {
    return this.selectedDate;
  }
  
  /**
   * Set the date programmatically
   * 
   * Updates the UI to display the new date and triggers the change callback.
   * 
   * @param {Date} date - Date object to set
   * @throws {TypeError} If date is not a valid Date object
   * 
   * @example
   * picker.setDate(new Date('2024-01-01'));
   */
  setDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new TypeError('Date must be a valid Date object');
    }
    
    // Update internal state
    this.selectedDate = date;
    
    // Update UI
    this._updateUI();
    
    // Trigger change callback
    if (this.changeCallback) {
      this.changeCallback(this.selectedDate);
    }
  }
  
  /**
   * Show the calendar picker
   * 
   * Programmatically opens the browser's native date picker by triggering
   * a click on the hidden date input element.
   * 
   * @example
   * picker.show();
   */
  show() {
    const input = document.getElementById(this.inputId);
    if (input) {
      input.showPicker ? input.showPicker() : input.click();
    }
  }
  
  /**
   * Hide the calendar picker
   * 
   * Closes the calendar picker by blurring the input element.
   * Note: Browser native date pickers may not support programmatic closing.
   * 
   * @example
   * picker.hide();
   */
  hide() {
    const input = document.getElementById(this.inputId);
    if (input) {
      input.blur();
    }
  }
  
  /**
   * Register a callback function to be called when the date changes
   * 
   * The callback receives the newly selected date as an argument.
   * 
   * @param {Function} callback - Callback function (date: Date) => void
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * picker.onChange((date) => {
   *   console.log('User selected:', date);
   * });
   */
  onChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.changeCallback = callback;
  }
  
  /**
   * Render the date picker HTML structure
   * 
   * Creates the date window with button and hidden input.
   * For 'target' type, assumes HTML already exists and just sets up references.
   * 
   * @private
   */
  _render() {
    // For 'target' type, HTML is already in the page, so don't render
    if (this.windowType === 'target') {
      // HTML already exists, just verify elements are present
      const button = document.getElementById(this.buttonId);
      const input = document.getElementById(this.inputId);
      const value = document.getElementById(this.valueId);
      
      if (!button || !input || !value) {
        throw new Error(`Target date picker elements not found in HTML`);
      }
      return;
    }
    
    // For 'pre' and 'post', create the HTML
    const windowTitle = this.windowType === 'pre' ? 'Pre' : 'Post';
    
    this.container.innerHTML = `
      <div class="date-window">
        <h3>${windowTitle}</h3>
        <button class="date-button" id="${this.buttonId}">
          <span class="date-label">Select Date</span>
          <span class="date-value" id="${this.valueId}">Not selected</span>
        </button>
        <input type="date" id="${this.inputId}" class="date-input-hidden">
      </div>
    `;
  }
  
  /**
   * Set up event listeners for button clicks and input changes
   * 
   * @private
   */
  _setupEventListeners() {
    const button = document.getElementById(this.buttonId);
    const input = document.getElementById(this.inputId);
    
    // Button click opens the date picker
    if (button) {
      button.addEventListener('click', () => {
        this.show();
      });
    }
    
    // Input change updates the selected date
    if (input) {
      input.addEventListener('change', (event) => {
        const dateString = event.target.value;
        
        if (dateString) {
          // Parse the date string (format: YYYY-MM-DD)
          const date = new Date(dateString + 'T00:00:00');
          
          if (!isNaN(date.getTime())) {
            this.selectedDate = date;
            this._updateUI();
            
            // Trigger change callback
            if (this.changeCallback) {
              this.changeCallback(this.selectedDate);
            }
          }
        }
      });
    }
  }
  
  /**
   * Update the UI to display the current selected date
   * 
   * Formats the date and updates the button text.
   * 
   * @private
   */
  _updateUI() {
    const valueElement = document.getElementById(this.valueId);
    const inputElement = document.getElementById(this.inputId);
    
    if (this.selectedDate) {
      // Format date as readable string (e.g., "January 1, 2024")
      const formattedDate = this._formatDate(this.selectedDate);
      
      if (valueElement) {
        valueElement.textContent = formattedDate;
      }
      
      // Update hidden input value (format: YYYY-MM-DD)
      if (inputElement) {
        inputElement.value = this._toISODateString(this.selectedDate);
      }
    } else {
      if (valueElement) {
        valueElement.textContent = 'Not selected';
      }
      
      if (inputElement) {
        inputElement.value = '';
      }
    }
  }
  
  /**
   * Format date as readable string
   * 
   * @private
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string (e.g., "January 1, 2024")
   */
  _formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
  
  /**
   * Convert date to ISO date string (YYYY-MM-DD)
   * 
   * @private
   * @param {Date} date - Date to convert
   * @returns {string} ISO date string
   */
  _toISODateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export default DatePicker;
export { DatePicker };
