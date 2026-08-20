/**
 * Satellite Selector Component
 * 
 * UI component for selecting between Sentinel-1 and Sentinel-2 satellite data sources.
 * Provides a toggle switch interface with visual feedback for the selected option.
 * 
 * Requirements:
 * - 2.1: Provide two satellite options: SENTINEL-1 and SENTINEL-2
 * - 2.2: Display satellite selector as slider or toggle button
 * - 2.3: Visually indicate selected satellite option
 * - 2.4: Default to SENTINEL-2 on initial load
 */

class SatelliteSelector {
  /**
   * Create a SatelliteSelector instance
   * 
   * Creates the toggle switch HTML structure and injects it into the specified container.
   * Sets up event listeners for user interactions.
   * 
   * @param {string} containerId - ID of the container element to render the selector in
   * @throws {Error} If container element is not found
   * 
   * @example
   * const selector = new SatelliteSelector('satellite-selector');
   * selector.onChange((satellite) => {
   *   console.log('Selected:', satellite);
   * });
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    // Current selection (default to SENTINEL-2)
    this.selected = 'SENTINEL-2';
    
    // Change callback
    this.changeCallback = null;
    
    // Render the component
    this._render();
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Get the currently selected satellite type
   * 
   * @returns {string} Selected satellite type ('SENTINEL-1' or 'SENTINEL-2')
   * 
   * @example
   * const satellite = selector.getSelected();
   * // Returns: 'SENTINEL-2'
   */
  getSelected() {
    return this.selected;
  }
  
  /**
   * Set the selected satellite type programmatically
   * 
   * Updates the UI to reflect the new selection and triggers the change callback.
   * 
   * @param {string} satellite - Satellite type ('SENTINEL-1' or 'SENTINEL-2')
   * @throws {TypeError} If satellite is not a valid type
   * 
   * @example
   * selector.setSelected('SENTINEL-1');
   */
  setSelected(satellite) {
    if (!satellite || typeof satellite !== 'string') {
      throw new TypeError('Satellite must be a non-empty string');
    }
    
    if (!['SENTINEL-1', 'SENTINEL-2'].includes(satellite)) {
      throw new TypeError('Satellite must be "SENTINEL-1" or "SENTINEL-2"');
    }
    
    // Update internal state
    this.selected = satellite;
    
    // Update UI
    this._updateUI();
    
    // Trigger change callback
    if (this.changeCallback) {
      this.changeCallback(this.selected);
    }
  }
  
  /**
   * Register a callback function to be called when the selection changes
   * 
   * The callback receives the newly selected satellite type as an argument.
   * 
   * @param {Function} callback - Callback function (satellite: string) => void
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * selector.onChange((satellite) => {
   *   console.log('User selected:', satellite);
   * });
   */
  onChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.changeCallback = callback;
  }
  
  /**
   * Render the satellite selector HTML structure
   * 
   * Creates the toggle switch with radio buttons and labels.
   * 
   * @private
   */
  _render() {
    this.container.innerHTML = `
      <div class="selector-container">
        <label class="selector-label">Satellite Type:</label>
        <div class="toggle-switch">
          <input type="radio" name="satellite" value="SENTINEL-1" id="satellite-s1">
          <label for="satellite-s1" class="toggle-label">SENTINEL-1</label>
          <input type="radio" name="satellite" value="SENTINEL-2" id="satellite-s2" checked>
          <label for="satellite-s2" class="toggle-label">SENTINEL-2</label>
        </div>
      </div>
    `;
  }
  
  /**
   * Set up event listeners for radio button changes
   * 
   * @private
   */
  _setupEventListeners() {
    const radioButtons = this.container.querySelectorAll('input[name="satellite"]');
    
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) {
          this.selected = event.target.value;
          
          // Trigger change callback
          if (this.changeCallback) {
            this.changeCallback(this.selected);
          }
        }
      });
    });
  }
  
  /**
   * Update the UI to reflect the current selection
   * 
   * Checks the appropriate radio button based on the current selection.
   * 
   * @private
   */
  _updateUI() {
    const radioButtons = this.container.querySelectorAll('input[name="satellite"]');
    
    radioButtons.forEach(radio => {
      if (radio.value === this.selected) {
        radio.checked = true;
      }
    });
  }
}

export default SatelliteSelector;
export { SatelliteSelector };
