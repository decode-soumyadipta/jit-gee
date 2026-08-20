/**
 * Polygon Model
 * 
 * Represents a parsed polygon from a KML file, storing its name, GeoJSON geometry,
 * bounding box, and providing lazy conversion to Earth Engine geometry format.
 * 
 * Requirements:
 * - 5.1: Support Polygon geometry types
 * - 5.2: Support MultiPolygon geometry types
 * - 5.4: Convert parsed geometries to GeoJSON format
 * - 5.5: Preserve polygon names from KML file
 */

import coordinateCleaner from '../utils/coordinateCleaner.js';

class Polygon {
  /**
   * Create a Polygon instance
   * 
   * @param {Object} data - Polygon data
   * @param {string} data.name - Polygon name from KML file
   * @param {Object} data.geometry - GeoJSON geometry object
   * @param {string} data.geometry.type - Geometry type ('Polygon' or 'MultiPolygon')
   * @param {Array} data.geometry.coordinates - Coordinate arrays
   * @param {Object} data.bounds - Bounding box
   * @param {number} data.bounds.north - Maximum latitude
   * @param {number} data.bounds.south - Minimum latitude
   * @param {number} data.bounds.east - Maximum longitude
   * @param {number} data.bounds.west - Minimum longitude
   * 
   * @example
   * const polygon = new Polygon({
   *   name: 'Mining Area 1',
   *   geometry: {
   *     type: 'Polygon',
   *     coordinates: [[[77.5946, 12.9716], [77.5947, 12.9717], [77.5946, 12.9716]]]
   *   },
   *   bounds: {
   *     north: 12.9717,
   *     south: 12.9716,
   *     east: 77.5947,
   *     west: 77.5946
   *   }
   * });
   */
  constructor(data) {
    // Validate required fields
    if (!data || typeof data !== 'object') {
      throw new TypeError('Polygon data must be an object');
    }
    
    if (!data.name || typeof data.name !== 'string') {
      throw new TypeError('Polygon name must be a non-empty string');
    }
    
    if (!data.geometry || typeof data.geometry !== 'object') {
      throw new TypeError('Polygon geometry must be an object');
    }
    
    if (!data.geometry.type || (data.geometry.type !== 'Polygon' && data.geometry.type !== 'MultiPolygon')) {
      throw new TypeError('Polygon geometry type must be "Polygon" or "MultiPolygon"');
    }
    
    if (!data.geometry.coordinates || !Array.isArray(data.geometry.coordinates)) {
      throw new TypeError('Polygon geometry coordinates must be an array');
    }
    
    if (!data.bounds || typeof data.bounds !== 'object') {
      throw new TypeError('Polygon bounds must be an object');
    }
    
    // Validate bounds
    const requiredBounds = ['north', 'south', 'east', 'west'];
    for (const bound of requiredBounds) {
      if (typeof data.bounds[bound] !== 'number') {
        throw new TypeError(`Polygon bounds.${bound} must be a number`);
      }
    }
    
    // Store properties
    this.name = data.name;
    this.geometry = data.geometry;
    this.bounds = data.bounds;
    
    // Lazy-loaded Earth Engine geometry (null until first access)
    this.eeGeometry = null;
  }
  
  /**
   * Convert to Earth Engine geometry
   * 
   * Lazily converts the GeoJSON geometry to an Earth Engine Geometry.Polygon
   * or Geometry.MultiPolygon. The conversion is cached after first call.
   * 
   * @returns {ee.Geometry} Earth Engine geometry object
   * 
   * @example
   * const eeGeom = polygon.toEEGeometry();
   * // Returns: ee.Geometry.Polygon([[[77.5946, 12.9716], ...]])
   */
  toEEGeometry() {
    // Return cached geometry if already converted
    if (this.eeGeometry) {
      return this.eeGeometry;
    }
    
    // Check if Earth Engine API is available
    if (typeof ee === 'undefined') {
      throw new Error('Google Earth Engine API is not loaded. Call ee.Initialize() first.');
    }
    
    // Convert GeoJSON coordinates to Earth Engine format
    // This removes altitude values and ensures proper nesting
    const coords = coordinateCleaner.toEECoords(this.geometry);
    
    // Create Earth Engine geometry based on type
    if (this.geometry.type === 'Polygon') {
      this.eeGeometry = ee.Geometry.Polygon(coords);
    } else if (this.geometry.type === 'MultiPolygon') {
      this.eeGeometry = ee.Geometry.MultiPolygon(coords);
    }
    
    return this.eeGeometry;
  }
  
  /**
   * Get area in square meters
   * 
   * Calculates the area of the polygon using Earth Engine's area() method.
   * Requires Earth Engine API to be initialized.
   * 
   * @returns {number} Area in square meters
   * 
   * @example
   * const area = polygon.getArea();
   * // Returns: 1234567.89 (square meters)
   */
  getArea() {
    const eeGeom = this.toEEGeometry();
    return eeGeom.area().getInfo();
  }
  
  /**
   * Get a JSON representation of the polygon
   * 
   * Returns a plain object with all polygon properties (excluding eeGeometry).
   * Useful for serialization and debugging.
   * 
   * @returns {Object} Plain object representation
   * 
   * @example
   * const json = polygon.toJSON();
   * // Returns: { name: 'Mining Area 1', geometry: {...}, bounds: {...} }
   */
  toJSON() {
    return {
      name: this.name,
      geometry: this.geometry,
      bounds: this.bounds
    };
  }
  
  /**
   * Get a string representation of the polygon
   * 
   * @returns {string} String representation
   * 
   * @example
   * polygon.toString();
   * // Returns: "Polygon: Mining Area 1 (Polygon)"
   */
  toString() {
    return `Polygon: ${this.name} (${this.geometry.type})`;
  }
}

export default Polygon;
export { Polygon };
