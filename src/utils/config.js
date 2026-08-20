/**
 * Configuration Model
 * 
 * Centralizes all satellite data source configurations, export parameters,
 * and UI theme settings for the satellite data acquisition interface.
 * 
 * Requirements:
 * - 2.4: Default satellite selection (SENTINEL-2)
 * - 7.6: Sentinel-2 band selection (B2, B3, B4, B8, B11, B12)
 * - 13.1: Sentinel-2 collection (COPERNICUS/S2_SR_HARMONIZED)
 * - 14.1: Export spatial resolution (10 meters per pixel)
 * - 14.2: Export maxPixels parameter (1e13)
 */

const CONFIG = {
  // Satellite configurations
  satellites: {
    'SENTINEL-1': {
      collection: 'COPERNICUS/S1_GRD',
      bands: ['VV', 'VH'],
      scale: 10,
      description: 'Sentinel-1 SAR Ground Range Detected'
    },
    'SENTINEL-2': {
      collection: 'COPERNICUS/S2_SR_HARMONIZED',
      bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
      scale: 10,
      description: 'Sentinel-2 Surface Reflectance Harmonized'
    }
  },
  
  // Default satellite selection (Requirement 2.4)
  defaultSatellite: 'SENTINEL-2',
  
  // Image filtering configuration
  cloudCoverMax: 20, // Maximum cloud cover percentage (Requirement 7.5)
  
  // Export settings
  export: {
    folder: 'MINE_SIH2025_GEE_Data',
    crs: 'EPSG:4326', // WGS84 coordinate reference system (Requirement 14.2)
    maxPixels: 1e13, // Maximum pixels for large areas (Requirement 14.2)
    fileFormat: 'GeoTIFF',
    dataType: 'float' // Export as Float data type (Requirement 14.3)
  },
  
  // UI color theme (government-style)
  ui: {
    colors: {
      primary: '#4A90E2',    // blue - for AOI button
      success: '#7ED321',    // green - for Fetch button
      warning: '#F5A623',    // yellow - for Download button
      background: '#FFFFFF', // white - main background
      text: '#333333',       // dark gray - text color
      border: '#CCCCCC',     // light gray - borders
      error: '#D0021B',      // red - error messages
      disabled: '#999999'    // gray - disabled elements
    },
    
    // Button color mapping
    buttons: {
      aoi: 'primary',      // blue
      fetch: 'success',    // green
      download: 'warning'  // yellow
    }
  },
  
  // Coordinate system configuration
  coordinates: {
    precision: 6, // Decimal places for coordinate precision (Requirement 12.5)
    longitudeRange: [-180, 180],
    latitudeRange: [-90, 90]
  },
  
  // File validation
  files: {
    allowedExtensions: ['.kml'],
    maxFileSize: 10 * 1024 * 1024 // 10 MB
  },
  
  // Google Earth Engine API
  gee: {
    // Project ID from your GEE account (from Data_acquisition.ipynb)
    project: 'mining-detection',
    
    // API configuration
    apiUrl: 'https://earthengine.googleapis.com',
    
    // Authentication uses Earth Engine's built-in popup authentication
    // No OAuth client ID required for basic usage
    authMethod: 'popup'
  }
};

// Freeze the configuration to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.satellites);
Object.freeze(CONFIG.satellites['SENTINEL-1']);
Object.freeze(CONFIG.satellites['SENTINEL-2']);
Object.freeze(CONFIG.export);
Object.freeze(CONFIG.ui);
Object.freeze(CONFIG.ui.colors);
Object.freeze(CONFIG.ui.buttons);
Object.freeze(CONFIG.coordinates);
Object.freeze(CONFIG.files);
Object.freeze(CONFIG.gee);

export default CONFIG;
