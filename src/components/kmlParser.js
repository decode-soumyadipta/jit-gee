/**
 * KML Parser Component
 * 
 * Parses KML files containing polygon geometries and converts them to
 * GeoJSON format compatible with Google Earth Engine.
 * 
 * Requirements:
 * - 4.4: Read KML file contents
 * - 4.5: Extract polygon geometries from KML file
 * - 4.6: Extract polygon names from KML file
 * - 5.1: Support Polygon geometry types
 * - 5.2: Support MultiPolygon geometry types
 * - 5.4: Convert parsed geometries to GeoJSON format
 * - 5.5: Preserve polygon names from KML file
 * - 5.6: Skip unsupported geometry types and log warnings
 */

import { AppError, ErrorTypes } from '../utils/errors.js';
import Polygon from '../models/polygon.js';

class KMLParser {
  /**
   * Parse KML file and extract polygon geometries
   * 
   * Reads a KML file using the browser File API, parses the XML structure,
   * extracts Placemark elements containing Polygon or MultiPolygon geometries,
   * and converts them to GeoJSON format.
   * 
   * @param {File} file - KML file from file input
   * @returns {Promise<ParsedKML>} Parsed KML data with polygons array
   * 
   * @throws {AppError} PARSE_ERROR if file reading or parsing fails
   * 
   * @example
   * const parser = new KMLParser();
   * const result = await parser.parseFile(kmlFile);
   * console.log(`Parsed ${result.count} polygons`);
   */
  async parseFile(file) {
    try {
      // Validate file extension (Requirement 4.3)
      if (!this.validateFileExtension(file.name)) {
        throw new AppError(
          ErrorTypes.PARSE_ERROR,
          'Invalid file extension. Only .kml files are accepted.',
          { 
            filename: file.name,
            expectedExtension: '.kml'
          }
        );
      }
      
      // Read file contents as text
      const kmlText = await this._readFileAsText(file);
      
      // Parse XML using DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      
      // Check for XML parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new AppError(
          ErrorTypes.PARSE_ERROR,
          'Invalid KML XML structure',
          { error: parserError.textContent }
        );
      }
      
      // Extract all Placemark elements (handle both with and without namespace)
      let placemarks = xmlDoc.querySelectorAll('Placemark');
      
      // If no placemarks found, try with namespace prefix
      if (placemarks.length === 0) {
        placemarks = xmlDoc.getElementsByTagName('Placemark');
      }
      
      if (placemarks.length === 0) {
        throw new AppError(
          ErrorTypes.PARSE_ERROR,
          'No Placemark elements found in KML file',
          { filename: file.name }
        );
      }
      
      // Parse each placemark
      const polygons = [];
      const errors = [];
      
      for (let i = 0; i < placemarks.length; i++) {
        try {
          const placemark = placemarks[i];
          const polygon = this._parsePlacemark(placemark, i);
          
          if (polygon) {
            polygons.push(polygon);
          }
        } catch (error) {
          // Collect errors but continue parsing remaining placemarks
          errors.push({
            index: i,
            message: error.message,
            details: error.details || null
          });
          
          // Log warning for skipped placemark
          console.warn(`Skipping Placemark ${i}: ${error.message}`);
        }
      }
      
      // If no polygons were successfully parsed, throw error
      if (polygons.length === 0) {
        throw new AppError(
          ErrorTypes.PARSE_ERROR,
          'No valid polygon geometries found in KML file',
          { 
            filename: file.name,
            totalPlacemarks: placemarks.length,
            errors: errors
          }
        );
      }
      
      return {
        polygons: polygons,
        count: polygons.length,
        errors: errors
      };
      
    } catch (error) {
      // Re-throw AppError as-is
      if (error instanceof AppError) {
        throw error;
      }
      
      // Wrap other errors in AppError
      throw new AppError(
        ErrorTypes.PARSE_ERROR,
        `Failed to parse KML file: ${error.message}`,
        { 
          filename: file.name,
          originalError: error.message
        }
      );
    }
  }
  
  /**
   * Validate file extension
   * 
   * Checks if the filename has a .kml extension (case-insensitive).
   * 
   * @param {string} filename - Name of the file to validate
   * @returns {boolean} True if file has .kml extension, false otherwise
   * 
   * @example
   * validateFileExtension('data.kml')  // Returns: true
   * validateFileExtension('data.KML')  // Returns: true
   * validateFileExtension('data.txt')  // Returns: false
   */
  validateFileExtension(filename) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }
    
    // Get file extension (case-insensitive)
    const extension = filename.toLowerCase().split('.').pop();
    return extension === 'kml';
  }
  
  /**
   * Parse a single Placemark element
   * 
   * @private
   * @param {Element} placemark - Placemark XML element
   * @param {number} index - Placemark index for error reporting
   * @returns {Polygon|null} Parsed Polygon object or null if unsupported
   * @throws {Error} If placemark contains invalid data
   */
  _parsePlacemark(placemark, index) {
    // Extract polygon name
    const name = this.extractName(placemark, index);
    
    // Check for MultiGeometry containing Polygons FIRST (before checking for single Polygon)
    // This is important because MultiGeometry contains Polygon elements
    let multiGeometry = placemark.querySelector('MultiGeometry');
    if (!multiGeometry) {
      const multiGeometries = placemark.getElementsByTagName('MultiGeometry');
      multiGeometry = multiGeometries.length > 0 ? multiGeometries[0] : null;
    }
    
    if (multiGeometry) {
      let polygonElements = multiGeometry.querySelectorAll('Polygon');
      if (polygonElements.length === 0) {
        polygonElements = multiGeometry.getElementsByTagName('Polygon');
      }
      
      if (polygonElements.length > 0) {
        const geometry = this._parseMultiPolygon(polygonElements);
        const bounds = this._calculateBounds(geometry.coordinates);
        
        return new Polygon({
          name: name,
          geometry: geometry,
          bounds: bounds
        });
      }
    }
    
    // Check for single Polygon geometry (handle both querySelector and getElementsByTagName)
    let polygonElement = placemark.querySelector('Polygon');
    if (!polygonElement) {
      const polygons = placemark.getElementsByTagName('Polygon');
      polygonElement = polygons.length > 0 ? polygons[0] : null;
    }
    
    if (polygonElement) {
      const geometry = this._parsePolygon(polygonElement);
      const bounds = this._calculateBounds(geometry.coordinates);
      
      return new Polygon({
        name: name,
        geometry: geometry,
        bounds: bounds
      });
    }
    
    // Check for unsupported geometry types
    const unsupportedTypes = ['Point', 'LineString', 'LinearRing'];
    for (const type of unsupportedTypes) {
      let element = placemark.querySelector(type);
      if (!element) {
        const elements = placemark.getElementsByTagName(type);
        element = elements.length > 0 ? elements[0] : null;
      }
      if (element && type !== 'LinearRing') { // LinearRing is part of Polygon, so skip it
        throw new Error(`Unsupported geometry type: ${type}. Only Polygon and MultiPolygon are supported.`);
      }
    }
    
    // No supported geometry found
    throw new Error('No Polygon or MultiPolygon geometry found in Placemark');
  }
  
  /**
   * Extract polygon name from Placemark element
   * 
   * Extracts the name from the <name> element within the Placemark.
   * If no name is found, generates a default name using the index.
   * 
   * @param {Element} placemark - Placemark XML element
   * @param {number} index - Placemark index for default naming
   * @returns {string} Polygon name
   * 
   * @example
   * extractName(placemarkElement, 0)
   * // Returns: "Mining Area 1" (from <name> element)
   * // Or: "Polygon_0" (if no <name> element)
   */
  extractName(placemark, index) {
    let nameElement = placemark.querySelector('name');
    
    // Try getElementsByTagName if querySelector doesn't work
    if (!nameElement) {
      const nameElements = placemark.getElementsByTagName('name');
      nameElement = nameElements.length > 0 ? nameElements[0] : null;
    }
    
    if (nameElement && nameElement.textContent.trim()) {
      return nameElement.textContent.trim();
    }
    
    // Generate default name if not found
    return `Polygon_${index}`;
  }
  
  /**
   * Parse Polygon element to GeoJSON
   * 
   * @private
   * @param {Element} polygonElement - Polygon XML element
   * @returns {Object} GeoJSON Polygon geometry
   */
  _parsePolygon(polygonElement) {
    const coordinates = [];
    
    // Parse outer boundary (handle both querySelector and getElementsByTagName)
    let outerBoundary = polygonElement.querySelector('outerBoundaryIs LinearRing coordinates');
    if (!outerBoundary) {
      const outerBoundaryIs = polygonElement.getElementsByTagName('outerBoundaryIs')[0];
      if (outerBoundaryIs) {
        const linearRing = outerBoundaryIs.getElementsByTagName('LinearRing')[0];
        if (linearRing) {
          outerBoundary = linearRing.getElementsByTagName('coordinates')[0];
        }
      }
    }
    
    if (!outerBoundary) {
      throw new Error('Polygon missing outerBoundaryIs/LinearRing/coordinates');
    }
    
    const outerCoords = this._parseCoordinates(outerBoundary.textContent);
    coordinates.push(outerCoords);
    
    // Parse inner boundaries (holes)
    let innerBoundaries = polygonElement.querySelectorAll('innerBoundaryIs LinearRing coordinates');
    if (innerBoundaries.length === 0) {
      const innerBoundaryIsElements = polygonElement.getElementsByTagName('innerBoundaryIs');
      const innerCoordsList = [];
      for (const innerBoundaryIs of innerBoundaryIsElements) {
        const linearRing = innerBoundaryIs.getElementsByTagName('LinearRing')[0];
        if (linearRing) {
          const coordsElement = linearRing.getElementsByTagName('coordinates')[0];
          if (coordsElement) {
            innerCoordsList.push(coordsElement);
          }
        }
      }
      innerBoundaries = innerCoordsList;
    }
    
    for (const innerBoundary of innerBoundaries) {
      const innerCoords = this._parseCoordinates(innerBoundary.textContent);
      coordinates.push(innerCoords);
    }
    
    return {
      type: 'Polygon',
      coordinates: coordinates
    };
  }
  
  /**
   * Parse multiple Polygon elements to GeoJSON MultiPolygon
   * 
   * @private
   * @param {NodeList} polygonElements - Array of Polygon XML elements
   * @returns {Object} GeoJSON MultiPolygon geometry
   */
  _parseMultiPolygon(polygonElements) {
    const coordinates = [];
    
    for (const polygonElement of polygonElements) {
      const polygon = this._parsePolygon(polygonElement);
      coordinates.push(polygon.coordinates);
    }
    
    return {
      type: 'MultiPolygon',
      coordinates: coordinates
    };
  }
  
  /**
   * Parse coordinates string from KML
   * 
   * KML coordinates are formatted as: "lon,lat,alt lon,lat,alt ..."
   * or "lon,lat lon,lat ..." (without altitude)
   * 
   * @private
   * @param {string} coordsText - Coordinates text from KML
   * @returns {Array<Array<number>>} Array of [lon, lat] or [lon, lat, alt] tuples
   * @throws {Error} If coordinates are malformed
   */
  _parseCoordinates(coordsText) {
    if (!coordsText || typeof coordsText !== 'string') {
      throw new Error('Coordinates text is empty or invalid');
    }
    
    // Split by whitespace and filter empty strings
    const coordPairs = coordsText.trim().split(/\s+/).filter(s => s.length > 0);
    
    if (coordPairs.length < 3) {
      throw new Error('Polygon must have at least 3 coordinate pairs');
    }
    
    const coordinates = [];
    
    for (let i = 0; i < coordPairs.length; i++) {
      const parts = coordPairs[i].split(',');
      
      if (parts.length < 2) {
        throw new Error(`Invalid coordinate format at position ${i}: ${coordPairs[i]}`);
      }
      
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      
      // Validate parsed numbers
      if (isNaN(lon) || isNaN(lat)) {
        throw new Error(`Invalid coordinate values at position ${i}: lon=${parts[0]}, lat=${parts[1]}`);
      }
      
      // Include altitude if present (will be removed by CoordinateCleaner later)
      if (parts.length >= 3) {
        const alt = parseFloat(parts[2]);
        if (!isNaN(alt)) {
          coordinates.push([lon, lat, alt]);
        } else {
          coordinates.push([lon, lat]);
        }
      } else {
        coordinates.push([lon, lat]);
      }
    }
    
    return coordinates;
  }
  
  /**
   * Calculate bounding box for geometry coordinates
   * 
   * Computes the minimum bounding rectangle (MBR) for the given coordinates.
   * Handles both Polygon and MultiPolygon coordinate structures.
   * 
   * @private
   * @param {Array} coordinates - GeoJSON coordinates array
   * @returns {Object} Bounding box with north, south, east, west
   */
  _calculateBounds(coordinates) {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    
    // Flatten coordinates to get all coordinate pairs
    const allCoords = this._flattenCoordinates(coordinates);
    
    for (const coord of allCoords) {
      const lon = coord[0];
      const lat = coord[1];
      
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    
    return {
      north: maxLat,
      south: minLat,
      east: maxLon,
      west: minLon
    };
  }
  
  /**
   * Flatten nested coordinate arrays to single array of coordinate pairs
   * 
   * @private
   * @param {Array} coordinates - Nested coordinate array
   * @returns {Array<Array<number>>} Flat array of coordinate pairs
   */
  _flattenCoordinates(coordinates) {
    const result = [];
    
    const flatten = (arr) => {
      for (const item of arr) {
        if (Array.isArray(item) && item.length > 0) {
          // Check if this is a coordinate pair (array of numbers)
          if (typeof item[0] === 'number') {
            result.push(item);
          } else {
            // Recursively flatten nested arrays
            flatten(item);
          }
        }
      }
    };
    
    flatten(coordinates);
    return result;
  }
  
  /**
   * Read file contents as text using FileReader API
   * 
   * @private
   * @param {File} file - File object from input
   * @returns {Promise<string>} File contents as text
   */
  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (event) => {
        reject(new Error(`Failed to read file: ${event.target.error}`));
      };
      
      reader.readAsText(file);
    });
  }
  
  /**
   * Convert KML geometry to GeoJSON (public utility method)
   * 
   * This is a convenience method that can be used independently
   * to convert already-parsed KML geometry elements to GeoJSON.
   * 
   * @param {Element} kmlGeometry - KML geometry element (Polygon or MultiGeometry)
   * @returns {Object} GeoJSON geometry object
   * 
   * @example
   * const geojson = parser.toGeoJSON(polygonElement);
   * // Returns: { type: 'Polygon', coordinates: [...] }
   */
  toGeoJSON(kmlGeometry) {
    if (!kmlGeometry || !kmlGeometry.tagName) {
      throw new TypeError('kmlGeometry must be a valid XML Element');
    }
    
    const tagName = kmlGeometry.tagName;
    
    if (tagName === 'Polygon') {
      return this._parsePolygon(kmlGeometry);
    } else if (tagName === 'MultiGeometry') {
      let polygonElements = kmlGeometry.querySelectorAll('Polygon');
      if (polygonElements.length === 0) {
        polygonElements = kmlGeometry.getElementsByTagName('Polygon');
      }
      if (polygonElements.length > 0) {
        return this._parseMultiPolygon(polygonElements);
      } else {
        throw new Error('MultiGeometry contains no Polygon elements');
      }
    } else {
      throw new Error(`Unsupported geometry type: ${tagName}`);
    }
  }
}

/**
 * @typedef {Object} ParsedKML
 * @property {Array<Polygon>} polygons - Array of parsed Polygon objects
 * @property {number} count - Number of successfully parsed polygons
 * @property {Array<Object>} errors - Array of parsing errors for skipped placemarks
 */

export default KMLParser;
export { KMLParser };
