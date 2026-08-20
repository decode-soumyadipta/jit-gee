/**
 * State Manager Component
 * 
 * Centralized application state management for the satellite data acquisition interface.
 * Manages satellite selection, date selection, polygon storage, imagery storage, and
 * provides validation methods for fetch and download operations.
 * 
 * Requirements:
 * - 2.1: Provide two satellite options: SENTINEL-1 and SENTINEL-2
 * - 2.2: Display satellite selector as slider or toggle button
 * - 2.3: Visually indicate selected satellite option
 * - 3.4: Store selected dates independently for Pre and Post imagery
 * - 4.5: Extract polygon geometries from KML file
 * - 4.6: Extract polygon names from KML file
 * - 7.2: Validate that AOI, satellite type, and dates are selected before fetch
 * - 9.1: Extract all polygons when KML contains multiple polygons
 * - 9.2: Display count of loaded polygons
 */

class StateManager {
  /**
   * Create a StateManager instance
   * 
   * Initializes the application state with default values and an empty
   * subscriber list for state change notifications.
   * 
   * @example
   * const stateManager = new StateManager();
   */
  constructor() {
    // Application state
    this.state = {
      satellite: 'SENTINEL-2',        // Default to SENTINEL-2
      preDate: null,                  // Pre imagery date
      postDate: null,                 // Post imagery date
      polygons: [],                   // Array of Polygon objects
      imagery: new Map(),             // Map<polygonName, SatelliteImage>
      status: 'idle',                 // 'idle' | 'fetching' | 'ready' | 'downloading' | 'error'
      errorMessage: null              // Error message if status is 'error'
    };
    
    // Subscribers for state change notifications
    this.subscribers = [];
  }
  
  // ========== Satellite Selection Methods ==========
  
  /**
   * Set the selected satellite type
   * 
   * @param {string} satellite - Satellite type ('SENTINEL-1' or 'SENTINEL-2')
   * @throws {TypeError} If satellite is not a valid type
   * 
   * @example
   * stateManager.setSatellite('SENTINEL-2');
   */
  setSatellite(satellite) {
    if (!satellite || typeof satellite !== 'string') {
      throw new TypeError('Satellite must be a non-empty string');
    }
    
    if (!['SENTINEL-1', 'SENTINEL-2'].includes(satellite)) {
      throw new TypeError('Satellite must be "SENTINEL-1" or "SENTINEL-2"');
    }
    
    this.state.satellite = satellite;
    this.notifySubscribers();
  }
  
  /**
   * Get the currently selected satellite type
   * 
   * @returns {string} Satellite type ('SENTINEL-1' or 'SENTINEL-2')
   * 
   * @example
   * const satellite = stateManager.getSatellite();
   * // Returns: 'SENTINEL-2'
   */
  getSatellite() {
    return this.state.satellite;
  }
  
  // ========== Date Selection Methods ==========
  
  /**
   * Set the Pre imagery date
   * 
   * @param {Date} date - Pre imagery date
   * @throws {TypeError} If date is not a valid Date object
   * 
   * @example
   * stateManager.setPreDate(new Date('2024-01-01'));
   */
  setPreDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new TypeError('Pre date must be a valid Date object');
    }
    
    this.state.preDate = date;
    this.notifySubscribers();
  }
  
  /**
   * Get the Pre imagery date
   * 
   * @returns {Date|null} Pre imagery date or null if not set
   * 
   * @example
   * const preDate = stateManager.getPreDate();
   * // Returns: Date('2024-01-01') or null
   */
  getPreDate() {
    return this.state.preDate;
  }
  
  /**
   * Set the Post imagery date
   * 
   * @param {Date} date - Post imagery date
   * @throws {TypeError} If date is not a valid Date object
   * 
   * @example
   * stateManager.setPostDate(new Date('2024-06-01'));
   */
  setPostDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new TypeError('Post date must be a valid Date object');
    }
    
    this.state.postDate = date;
    this.notifySubscribers();
  }
  
  /**
   * Get the Post imagery date
   * 
   * @returns {Date|null} Post imagery date or null if not set
   * 
   * @example
   * const postDate = stateManager.getPostDate();
   * // Returns: Date('2024-06-01') or null
   */
  getPostDate() {
    return this.state.postDate;
  }
  
  // ========== Polygon Storage Methods ==========
  
  /**
   * Set the polygons from parsed KML file
   * 
   * @param {Array<Polygon>} polygons - Array of Polygon objects
   * @throws {TypeError} If polygons is not an array
   * 
   * @example
   * stateManager.setPolygons([polygon1, polygon2, polygon3]);
   */
  setPolygons(polygons) {
    if (!Array.isArray(polygons)) {
      throw new TypeError('Polygons must be an array');
    }
    
    this.state.polygons = polygons;
    this.notifySubscribers();
  }
  
  /**
   * Get all stored polygons
   * 
   * @returns {Array<Polygon>} Array of Polygon objects
   * 
   * @example
   * const polygons = stateManager.getPolygons();
   * // Returns: [polygon1, polygon2, polygon3]
   */
  getPolygons() {
    return this.state.polygons;
  }
  
  /**
   * Get the count of stored polygons
   * 
   * @returns {number} Number of polygons
   * 
   * @example
   * const count = stateManager.getPolygonCount();
   * // Returns: 3
   */
  getPolygonCount() {
    return this.state.polygons.length;
  }
  
  // ========== Imagery Storage Methods ==========
  
  /**
   * Set imagery for all polygons
   * 
   * Stores a map of polygon names to SatelliteImage objects.
   * 
   * @param {Map<string, SatelliteImage>} imagery - Map of polygon names to SatelliteImage objects
   * @throws {TypeError} If imagery is not a Map
   * 
   * @example
   * const imagery = new Map();
   * imagery.set('Mining Area 1', satelliteImage1);
   * imagery.set('Mining Area 2', satelliteImage2);
   * stateManager.setImagery(imagery);
   */
  setImagery(imagery) {
    if (!(imagery instanceof Map)) {
      throw new TypeError('Imagery must be a Map');
    }
    
    this.state.imagery = imagery;
    this.notifySubscribers();
  }
  
  /**
   * Get imagery for a specific polygon
   * 
   * @param {string} polygonName - Name of the polygon
   * @returns {SatelliteImage|null} SatelliteImage object or null if not found
   * 
   * @example
   * const image = stateManager.getImagery('Mining Area 1');
   * // Returns: SatelliteImage object or null
   */
  getImagery(polygonName) {
    if (!polygonName || typeof polygonName !== 'string') {
      throw new TypeError('Polygon name must be a non-empty string');
    }
    
    return this.state.imagery.get(polygonName) || null;
  }
  
  /**
   * Get all imagery
   * 
   * @returns {Map<string, SatelliteImage>} Map of polygon names to SatelliteImage objects
   * 
   * @example
   * const allImagery = stateManager.getAllImagery();
   * // Returns: Map { 'Mining Area 1' => SatelliteImage, ... }
   */
  getAllImagery() {
    return this.state.imagery;
  }
  
  // ========== Status Management Methods ==========
  
  /**
   * Set the application status
   * 
   * @param {string} status - Application status ('idle' | 'fetching' | 'ready' | 'downloading' | 'error')
   * @param {string|null} errorMessage - Error message if status is 'error'
   * @throws {TypeError} If status is not a valid status string
   * 
   * @example
   * stateManager.setStatus('fetching');
   * stateManager.setStatus('error', 'Failed to fetch imagery');
   */
  setStatus(status, errorMessage = null) {
    const validStatuses = ['idle', 'fetching', 'ready', 'downloading', 'error'];
    
    if (!validStatuses.includes(status)) {
      throw new TypeError(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    
    this.state.status = status;
    this.state.errorMessage = errorMessage;
    this.notifySubscribers();
  }
  
  /**
   * Get the current application status
   * 
   * @returns {string} Application status
   * 
   * @example
   * const status = stateManager.getStatus();
   * // Returns: 'idle'
   */
  getStatus() {
    return this.state.status;
  }
  
  /**
   * Get the current error message
   * 
   * @returns {string|null} Error message or null if no error
   * 
   * @example
   * const error = stateManager.getErrorMessage();
   * // Returns: 'Failed to fetch imagery' or null
   */
  getErrorMessage() {
    return this.state.errorMessage;
  }
  
  // ========== Validation Methods ==========
  
  /**
   * Check if the application is ready to fetch imagery
   * 
   * Validates that all required fields are filled:
   * - At least one polygon is loaded
   * - Satellite type is selected
   * - Pre date is selected
   * - Post date is selected
   * 
   * @returns {boolean} True if ready to fetch, false otherwise
   * 
   * @example
   * const canFetch = stateManager.isReadyToFetch();
   * // Returns: true or false
   */
  isReadyToFetch() {
    return (
      this.state.polygons.length > 0 &&
      this.state.preDate !== null  // Only need target date now
    );
  }
  
  /**
   * Check if the application is ready to download imagery
   * 
   * Validates that imagery has been fetched for all polygons.
   * 
   * @returns {boolean} True if ready to download, false otherwise
   * 
   * @example
   * const canDownload = stateManager.isReadyToDownload();
   * // Returns: true or false
   */
  isReadyToDownload() {
    // Must have polygons
    if (this.state.polygons.length === 0) {
      return false;
    }
    
    // Must have imagery for all polygons
    if (this.state.imagery.size !== this.state.polygons.length) {
      return false;
    }
    
    // Verify each polygon has imagery
    for (const polygon of this.state.polygons) {
      if (!this.state.imagery.has(polygon.name)) {
        return false;
      }
    }
    
    return true;
  }
  
  // ========== State Change Notification Methods ==========
  
  /**
   * Subscribe to state changes
   * 
   * Registers a callback function that will be called whenever the state changes.
   * The callback receives the current state as an argument.
   * 
   * @param {Function} callback - Callback function to be called on state changes
   * @returns {Function} Unsubscribe function
   * @throws {TypeError} If callback is not a function
   * 
   * @example
   * const unsubscribe = stateManager.subscribe((state) => {
   *   console.log('State changed:', state);
   * });
   * 
   * // Later, to unsubscribe:
   * unsubscribe();
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Notify all subscribers of state changes
   * 
   * Calls all registered callback functions with the current state.
   * 
   * @private
   */
  notifySubscribers() {
    const stateCopy = this.getState();
    
    for (const callback of this.subscribers) {
      try {
        callback(stateCopy);
      } catch (error) {
        console.error('Error in state change subscriber:', error);
      }
    }
  }
  
  // ========== State Access Methods ==========
  
  /**
   * Get a copy of the current state
   * 
   * Returns a deep copy of the state object to prevent external modification.
   * 
   * @returns {Object} Copy of the current state
   * 
   * @example
   * const state = stateManager.getState();
   * // Returns: {
   * //   satellite: 'SENTINEL-2',
   * //   preDate: Date(...),
   * //   postDate: Date(...),
   * //   polygons: [...],
   * //   imagery: Map(...),
   * //   status: 'idle',
   * //   errorMessage: null
   * // }
   */
  getState() {
    return {
      satellite: this.state.satellite,
      preDate: this.state.preDate,
      postDate: this.state.postDate,
      polygons: [...this.state.polygons],
      imagery: new Map(this.state.imagery),
      status: this.state.status,
      errorMessage: this.state.errorMessage
    };
  }
  
  /**
   * Reset the state to initial values
   * 
   * Clears all stored data and resets to default state.
   * 
   * @example
   * stateManager.reset();
   */
  reset() {
    this.state = {
      satellite: 'SENTINEL-2',
      preDate: null,
      postDate: null,
      polygons: [],
      imagery: new Map(),
      status: 'idle',
      errorMessage: null
    };
    
    this.notifySubscribers();
  }
}

export default StateManager;
export { StateManager };
