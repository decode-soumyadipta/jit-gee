/**
 * Action Buttons Component
 * 
 * UI component for triggering KML upload, data fetch, and GeoTIFF download operations.
 * Manages button states (enabled/disabled, loading) and handles file selection.
 * 
 * Requirements:
 * - 4.1: Provide "Select AOI" button with option "in .kml"
 * - 4.2: Open file selection dialog when "Select AOI" button is clicked
 * - 7.1: Provide "Fetch" button
 * - 8.1: Provide "Download" button with option "in .tiff"
 * - 1.4: Display three action buttons at bottom section
 * - 1.5: Use simple button colors: blue, green, and yellow
 */

class ActionButtons {
  /**
   * Create an ActionButtons instance
   * 
   * Creates the action buttons HTML structure and injects it into the specified container.
   * Sets up event listeners for button clicks and file selection.
   * 
   * @param {string} containerId - ID of the container element to render the buttons in
   * @throws {Error} If container element is not found
   * 
   * @example
   * const buttons = new ActionButtons('action-buttons-container');
   * buttons.onAOISelect((file) => {
   *   console.log('KML file selected:', file.name);
   * });
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    // Callback functions
    this.aoiSelectCallback = null;
    this.fetchCallback = null;
    this.downloadCallback = null;
    
    // Button IDs
    this.aoiButtonId = 'aoi-btn';
    this.fetchButtonId = 'fetch-btn';
    this.downloadButtonId = 'download-btn';
    this.fileInputId = 'kml-file-input';
    
    // Render the component
    this._render();
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Enable or disable a specific button
   * 
   * @param {string} button - Button identifier ('aoi' | 'fetch' | 'download')
   * @param {boolean} enabled - True to enable, false to disable
   * @throws {TypeError} If button is not a valid identifier
   * 
   * @example
   * buttons.setEnabled('fetch', true);  // Enable fetch button
   * buttons.setEnabled('download', false);  // Disable download button
   */
  setEnabled(button, enabled) {
    if (!['aoi', 'fetch', 'download'].includes(button)) {
      throw new TypeError('Button must be "aoi", "fetch", or "download"');
    }
    
    const buttonId = this._getButtonId(button);
    const buttonElement = document.getElementById(buttonId);
    
    if (buttonElement) {
      buttonElement.disabled = !enabled;
    }
  }
  
  /**
   * Set loading state for a button
   * 
   * Shows a loading spinner and disables the button during async operations.
   * 
   * @param {string} button - Button identifier ('fetch' | 'download')
   * @param {boolean} loading - True to show loading, false to hide
   * @throws {TypeError} If button is not a valid identifier
   * 
   * @example
   * buttons.setLoading('fetch', true);  // Show loading on fetch button
   * buttons.setLoading('fetch', false);  // Hide loading
   */
  setLoading(button, loading) {
    if (!['fetch', 'download'].includes(button)) {
      throw new TypeError('Button must be "fetch" or "download"');
    }
    
    const buttonId = this._getButtonId(button);
    const buttonElement = document.getElementById(buttonId);
    
    if (buttonElement) {
      if (loading) {
        buttonElement.classList.add('loading');
        buttonElement.disabled = true;
      } else {
        buttonElement.classList.remove('loading');
        buttonElement.disabled = false;
      }
    }
  }
  
  /**
   * Register callback for AOI file selection
   * 
   * The callback receives the selected File object as an argument.
   * 
   * @param {Function} callback - Callback function (file: File) => void
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * buttons.onAOISelect((file) => {
   *   console.log('Selected file:', file.name);
   * });
   */
  onAOISelect(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.aoiSelectCallback = callback;
  }
  
  /**
   * Register callback for Fetch button click
   * 
   * @param {Function} callback - Callback function () => void
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * buttons.onFetch(() => {
   *   console.log('Fetch button clicked');
   * });
   */
  onFetch(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.fetchCallback = callback;
  }
  
  /**
   * Register callback for Download button click
   * 
   * @param {Function} callback - Callback function () => void
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * buttons.onDownload(() => {
   *   console.log('Download button clicked');
   * });
   */
  onDownload(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.downloadCallback = callback;
  }
  
  /**
   * Render the action buttons HTML structure
   * 
   * Creates the three action buttons and hidden file input.
   * 
   * @private
   */
  _render() {
    this.container.innerHTML = `
      <div class="action-buttons">
        <button id="${this.aoiButtonId}" class="btn btn-blue">
          Select AOI (in .kml)
        </button>
        <button id="${this.fetchButtonId}" class="btn btn-green" disabled>
          Fetch
        </button>
        <button id="${this.downloadButtonId}" class="btn btn-yellow" disabled>
          Download (in .tiff)
        </button>
      </div>
      <input type="file" id="${this.fileInputId}" accept=".kml" style="display: none;">
    `;
  }
  
  /**
   * Set up event listeners for button clicks and file selection
   * 
   * @private
   */
  _setupEventListeners() {
    const aoiButton = document.getElementById(this.aoiButtonId);
    const fetchButton = document.getElementById(this.fetchButtonId);
    const downloadButton = document.getElementById(this.downloadButtonId);
    const fileInput = document.getElementById(this.fileInputId);
    
    // AOI button opens file selection dialog
    if (aoiButton) {
      aoiButton.addEventListener('click', () => {
        if (fileInput) {
          fileInput.click();
        }
      });
    }
    
    // File input change triggers AOI select callback
    if (fileInput) {
      fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        
        if (file && this.aoiSelectCallback) {
          this.aoiSelectCallback(file);
        }
        
        // Reset file input so the same file can be selected again
        event.target.value = '';
      });
    }
    
    // Fetch button triggers fetch callback
    if (fetchButton) {
      fetchButton.addEventListener('click', () => {
        if (this.fetchCallback && !fetchButton.disabled) {
          this.fetchCallback();
        }
      });
    }
    
    // Download button triggers download callback
    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        if (this.downloadCallback && !downloadButton.disabled) {
          this.downloadCallback();
        }
      });
    }
  }
  
  /**
   * Get button element ID from button identifier
   * 
   * @private
   * @param {string} button - Button identifier ('aoi' | 'fetch' | 'download')
   * @returns {string} Button element ID
   */
  _getButtonId(button) {
    const buttonIds = {
      'aoi': this.aoiButtonId,
      'fetch': this.fetchButtonId,
      'download': this.downloadButtonId
    };
    
    return buttonIds[button];
  }
}

export default ActionButtons;
export { ActionButtons };
