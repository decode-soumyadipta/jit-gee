/**
 * Google Earth Engine Client Component
 * 
 * Handles all interactions with the Google Earth Engine JavaScript API,
 * including initialization, authentication, and satellite imagery fetching.
 * 
 * Requirements:
 * - 6.1: Initiate Google Earth Engine authentication
 * - 6.2: Use OAuth2 authentication flow
 * - 6.3: Redirect users to Google authentication page
 * - 6.4: Store authentication tokens
 * - 6.5: Display error message with retry option on auth failure
 * - 7.3: Query Google Earth Engine for Sentinel imagery
 * - 7.4: Filter images by date range
 * - 7.5: Filter images by cloud cover percentage < 20%
 * - 7.6: Select appropriate bands based on satellite type
 * - 7.7: Create median composite from filtered ImageCollection
 * - 7.8: Clip imagery to polygon boundaries
 * - 7.10: Display informative message when no images available
 * - 13.1: Use COPERNICUS/S2_SR_HARMONIZED collection
 * - 13.2: Filter images by cloud cover percentage
 * - 13.3: Use maximum cloud cover threshold of 20%
 * - 13.4: Create median composite to reduce cloud artifacts
 * - 13.5: Filter images that intersect with AOI boundaries
 * - 13.6: Use Surface Reflectance (SR) products for Sentinel-2
 */

import CONFIG from '../utils/config.js';
import { AppError, ErrorTypes } from '../utils/errors.js';

class GEEClient {
  constructor() {
    this.initialized = false;
    this.authenticated = false;
    this.authRetryCount = 0;
    this.maxAuthRetries = 3;
  }

  /**
   * Initialize Google Earth Engine API
   * Loads the GEE JavaScript API from CDN and initializes the library
   * 
   * @returns {Promise<void>}
   * @throws {AppError} If initialization fails
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Wait for ee to be loaded (with timeout)
      await this._waitForEELoad();

      // Initialize Earth Engine with authentication
      await this._initializeWithAuth();
      
      this.initialized = true;
      console.log('Google Earth Engine initialized successfully');
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorTypes.AUTH_ERROR,
        'Failed to initialize Google Earth Engine',
        { originalError: error.message }
      );
    }
  }

  /**
   * Wait for Google Earth Engine API to load
   * @private
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds (default: 10000)
   * @returns {Promise<void>}
   */
  async _waitForEELoad(maxWaitTime = 10000) {
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkEE = () => {
        if (typeof ee !== 'undefined') {
          resolve();
        } else if (Date.now() - startTime > maxWaitTime) {
          reject(new AppError(
            ErrorTypes.AUTH_ERROR,
            'Google Earth Engine API failed to load. Please check your internet connection and try again.',
            { 
              suggestion: 'Ensure the API script is included in your HTML: <script src="https://earthengine.googleapis.com/v1/api.js"></script>',
              timeout: maxWaitTime
            }
          ));
        } else {
          setTimeout(checkEE, checkInterval);
        }
      };
      checkEE();
    });
  }

  /**
   * Internal method to initialize GEE with authentication
   * For browser-based apps, we need to use OAuth or have the user
   * authenticate through code.earthengine.google.com first
   * @private
   */
  async _initializeWithAuth() {
    return new Promise((resolve, reject) => {
      // For browser apps without OAuth setup, we need to guide users
      // to authenticate via the Code Editor first
      
      // Try to initialize - this will work if user is already authenticated
      // via code.earthengine.google.com in the same browser
      ee.initialize(
        null, // Use default API endpoint
        null, // Use default tile server  
        () => {
          // Success callback
          this.authenticated = true;
          console.log('✅ Google Earth Engine initialized successfully');
          console.log('✅ You are authenticated and ready to fetch imagery');
          if (CONFIG.gee.project) {
            console.log(`📍 Using project: ${CONFIG.gee.project}`);
          }
          resolve();
        },
        (error) => {
          // Error callback - user needs to authenticate
          console.error('❌ Earth Engine initialization failed:', error);
          reject(new Error(
            'Google Earth Engine authentication required.\n\n' +
            'SOLUTION:\n' +
            '1. Open https://code.earthengine.google.com/ in a new tab\n' +
            '2. Sign in with your Google Earth Engine account\n' +
            '3. Come back to this tab and reload the page\n\n' +
            'This shares authentication between the Code Editor and this app.'
          ));
        }
      );
    });
  }

  /**
   * Check if client is authenticated with Google Earth Engine
   * 
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Fetch satellite imagery for a given polygon and parameters
   * 
   * @param {Object} params - Fetch parameters
   * @param {ee.Geometry} params.polygon - Earth Engine geometry for AOI
   * @param {string} params.satellite - Satellite type ('SENTINEL-1' | 'SENTINEL-2')
   * @param {string} params.startDate - Start date in ISO format (YYYY-MM-DD)
   * @param {string} params.endDate - End date in ISO format (YYYY-MM-DD)
   * @param {number} [params.cloudCoverMax] - Maximum cloud cover percentage (default: 20)
   * @param {Array<string>} [params.bands] - Specific bands to select (optional)
   * 
   * @returns {Promise<Object>} Object containing ee.Image and metadata
   * @throws {AppError} If fetch fails or no imagery available
   */
  async fetchImagery(params) {
    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const {
        polygon,
        satellite,
        startDate,
        endDate,
        cloudCoverMax = CONFIG.cloudCoverMax,
        bands = null
      } = params;

      // Validate parameters
      this._validateFetchParams(params);

      // Get satellite configuration
      const satConfig = CONFIG.satellites[satellite];
      if (!satConfig) {
        throw new AppError(
          ErrorTypes.FETCH_ERROR,
          `Unsupported satellite type: ${satellite}`,
          { supportedTypes: Object.keys(CONFIG.satellites) }
        );
      }

      // Select bands (use provided or default from config)
      const selectedBands = bands || satConfig.bands;

      // Construct ImageCollection query
      let collection = ee.ImageCollection(satConfig.collection)
        .filterBounds(polygon)                    // Spatial filter (Req 13.5)
        .filterDate(startDate, endDate);          // Temporal filter (Req 7.4)

      // Add cloud cover filter for optical satellites (Sentinel-2)
      if (satellite === 'SENTINEL-2') {
        collection = collection.filter(
          ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudCoverMax)  // Req 7.5, 13.2, 13.3
        );
      }

      // Check if collection is empty
      const imageCount = await this._getCollectionSize(collection);
      if (imageCount === 0) {
        throw new AppError(
          ErrorTypes.FETCH_ERROR,
          'No imagery available for the selected parameters',
          {
            satellite,
            startDate,
            endDate,
            cloudCoverMax,
            suggestion: this._suggestAlternativeDateRange(startDate, endDate)
          }
        );
      }

      // Select bands (Req 7.6)
      collection = collection.select(selectedBands);

      // Create median composite to reduce cloud artifacts (Req 7.7, 13.4)
      let image = collection.median();

      // Clip to polygon boundaries (Req 7.8)
      image = image.clip(polygon);

      // Get metadata
      const metadata = {
        satellite,
        dateRange: { start: startDate, end: endDate },
        bands: selectedBands,
        cloudCoverMax,
        imageCount
      };

      console.log('Imagery fetched successfully:', metadata);

      return {
        eeImage: image,
        metadata
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Failed to fetch satellite imagery',
        { originalError: error.message, params }
      );
    }
  }

  /**
   * Validate fetch parameters
   * @private
   */
  _validateFetchParams(params) {
    const { polygon, satellite, startDate, endDate } = params;

    if (!polygon) {
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Polygon geometry is required',
        { field: 'polygon' }
      );
    }

    if (!satellite) {
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Satellite type is required',
        { field: 'satellite' }
      );
    }

    if (!startDate || !endDate) {
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Start and end dates are required',
        { field: 'dates' }
      );
    }

    // Validate date order
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Start date must be before end date',
        { startDate, endDate }
      );
    }
  }

  /**
   * Get the size of an ImageCollection
   * @private
   */
  async _getCollectionSize(collection) {
    return new Promise((resolve, reject) => {
      collection.size().evaluate((size, error) => {
        if (error) {
          reject(error);
        } else {
          resolve(size);
        }
      });
    });
  }

  /**
   * Suggest alternative date ranges when no imagery is available
   * @private
   */
  _suggestAlternativeDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rangeInDays = (end - start) / (1000 * 60 * 60 * 24);

    const suggestions = [];

    // Suggest expanding the date range
    if (rangeInDays < 30) {
      suggestions.push('Try expanding the date range to at least 30 days');
    }

    // Suggest different season
    const month = start.getMonth();
    if (month >= 5 && month <= 8) { // Summer months (Jun-Sep)
      suggestions.push('Try a different season (winter months may have less cloud cover in some regions)');
    }

    // Suggest relaxing cloud cover
    suggestions.push('Consider increasing the cloud cover threshold');

    return suggestions.join('. ');
  }

  /**
   * Reset authentication state (useful for testing or re-authentication)
   */
  resetAuth() {
    this.authenticated = false;
    this.authRetryCount = 0;
  }
}

export default GEEClient;
