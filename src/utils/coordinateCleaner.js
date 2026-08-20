/**
 * Coordinate Cleaner Component
 * 
 * Handles coordinate transformations from KML (which may include altitude)
 * to the 2D format required by Google Earth Engine, while preserving precision.
 * 
 * Requirements:
 * - 5.3: Remove altitude (Z) values from 3D coordinates
 * - 12.2: Convert 3D coordinates to 2D coordinates
 * - 12.5: Preserve coordinate precision to at least 6 decimal places
 */

import CONFIG from './config.js';

class CoordinateCleaner {
  /**
   * Clean single coordinate array by removing altitude values
   * 
   * Converts 3D coordinates [lon, lat, alt] to 2D coordinates [lon, lat]
   * while preserving precision to 6 decimal places.
   * 
   * @param {Array<Array<number>>} coords - Array of coordinate tuples [lon, lat] or [lon, lat, alt]
   * @returns {Array<Array<number>>} Array of 2D coordinate tuples [lon, lat]
   * 
   * @example
   * cleanCoords([[77.5946, 12.9716, 920], [77.5947, 12.9717, 925]])
   * // Returns: [[77.5946, 12.9716], [77.5947, 12.9717]]
   */
  cleanCoords(coords) {
    if (!Array.isArray(coords)) {
      throw new TypeError('coords must be an array');
    }
    
    return coords.map(coord => {
      if (!Array.isArray(coord) || coord.length < 2) {
        throw new TypeError('Each coordinate must be an array with at least 2 elements');
      }
      
      const lon = coord[0];
      const lat = coord[1];
      
      // Validate coordinate ranges
      if (typeof lon !== 'number' || typeof lat !== 'number') {
        throw new TypeError('Longitude and latitude must be numbers');
      }
      
      if (lon < CONFIG.coordinates.longitudeRange[0] || lon > CONFIG.coordinates.longitudeRange[1]) {
        throw new RangeError(`Longitude ${lon} is out of valid range [-180, 180]`);
      }
      
      if (lat < CONFIG.coordinates.latitudeRange[0] || lat > CONFIG.coordinates.latitudeRange[1]) {
        throw new RangeError(`Latitude ${lat} is out of valid range [-90, 90]`);
      }
      
      // Preserve precision to 6 decimal places
      const cleanLon = parseFloat(lon.toFixed(CONFIG.coordinates.precision));
      const cleanLat = parseFloat(lat.toFixed(CONFIG.coordinates.precision));
      
      return [cleanLon, cleanLat];
    });
  }
  
  /**
   * Convert GeoJSON geometry to Earth Engine compatible coordinate format
   * 
   * Handles nested coordinate arrays for Polygon and MultiPolygon types.
   * Removes altitude values and ensures proper nesting for GEE.
   * 
   * @param {Object} geojson - GeoJSON geometry object
   * @returns {Array} Earth Engine compatible coordinate array
   * 
   * @example
   * // Polygon
   * toEECoords({
   *   type: 'Polygon',
   *   coordinates: [[[77.5946, 12.9716, 920], [77.5947, 12.9717, 925], [77.5946, 12.9716, 920]]]
   * })
   * // Returns: [[[77.5946, 12.9716], [77.5947, 12.9717], [77.5946, 12.9716]]]
   */
  toEECoords(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      throw new TypeError('geojson must be an object');
    }
    
    if (!geojson.type) {
      throw new TypeError('geojson must have a type property');
    }
    
    if (!geojson.coordinates) {
      throw new TypeError('geojson must have a coordinates property');
    }
    
    const { type, coordinates } = geojson;
    
    switch (type) {
      case 'Polygon':
        // Polygon: array of linear rings (first is outer, rest are holes)
        // coordinates: [[[lon, lat, alt?], ...], ...]
        return coordinates.map(ring => this.cleanCoords(ring));
        
      case 'MultiPolygon':
        // MultiPolygon: array of polygons
        // coordinates: [[[[lon, lat, alt?], ...], ...], ...]
        return coordinates.map(polygon =>
          polygon.map(ring => this.cleanCoords(ring))
        );
        
      case 'Point':
        throw new TypeError('Point geometry is not supported. Only Polygon and MultiPolygon are supported.');
        
      case 'LineString':
        throw new TypeError('LineString geometry is not supported. Only Polygon and MultiPolygon are supported.');
        
      case 'MultiPoint':
        throw new TypeError('MultiPoint geometry is not supported. Only Polygon and MultiPolygon are supported.');
        
      case 'MultiLineString':
        throw new TypeError('MultiLineString geometry is not supported. Only Polygon and MultiPolygon are supported.');
        
      default:
        throw new TypeError(`Unsupported geometry type: ${type}. Only Polygon and MultiPolygon are supported.`);
    }
  }
  
  /**
   * Validate that coordinates have proper precision (6 decimal places)
   * 
   * Checks if coordinate values are within valid ranges and have
   * appropriate precision for Earth Engine operations.
   * 
   * @param {Array<Array<number>>} coords - Array of 2D coordinate tuples
   * @returns {boolean} True if all coordinates are valid
   * 
   * @example
   * validatePrecision([[77.594600, 12.971600]]) // Returns: true
   * validatePrecision([[77.5946, 12.9716]]) // Returns: true
   * validatePrecision([[200, 12.9716]]) // Returns: false (lon out of range)
   */
  validatePrecision(coords) {
    if (!Array.isArray(coords)) {
      return false;
    }
    
    return coords.every(coord => {
      if (!Array.isArray(coord) || coord.length !== 2) {
        return false;
      }
      
      const [lon, lat] = coord;
      
      // Check if values are numbers
      if (typeof lon !== 'number' || typeof lat !== 'number') {
        return false;
      }
      
      // Check if values are finite (not NaN, Infinity, -Infinity)
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return false;
      }
      
      // Check coordinate ranges
      if (lon < CONFIG.coordinates.longitudeRange[0] || lon > CONFIG.coordinates.longitudeRange[1]) {
        return false;
      }
      
      if (lat < CONFIG.coordinates.latitudeRange[0] || lat > CONFIG.coordinates.latitudeRange[1]) {
        return false;
      }
      
      // Check precision (should not have more than 6 decimal places)
      // Convert to string and check decimal places
      const lonStr = lon.toString();
      const latStr = lat.toString();
      
      const lonDecimals = lonStr.includes('.') ? lonStr.split('.')[1].length : 0;
      const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
      
      // Allow up to 6 decimal places (or fewer)
      if (lonDecimals > CONFIG.coordinates.precision || latDecimals > CONFIG.coordinates.precision) {
        return false;
      }
      
      return true;
    });
  }
}

// Export singleton instance
const coordinateCleaner = new CoordinateCleaner();
export default coordinateCleaner;
export { CoordinateCleaner };
