/**
 * SatelliteImage Model
 * 
 * Represents fetched satellite imagery from Google Earth Engine, storing metadata
 * about the image collection and the resulting composite image.
 * 
 * Requirements:
 * - 7.3: Query Google Earth Engine for Sentinel imagery matching selected parameters
 * - 7.4: Filter images by selected date range
 * - 7.5: Filter images by cloud cover percentage less than 20%
 * - 7.6: Select appropriate bands for Sentinel-2 data (B2, B3, B4, B8, B11, B12)
 * - 7.7: Create median composite from filtered image collection
 * - 7.8: Clip composite image to AOI polygon boundaries
 */

class SatelliteImage {
  /**
   * Create a SatelliteImage instance
   * 
   * @param {Object} data - Satellite image data
   * @param {string} data.polygonName - Name of the polygon this image is associated with
   * @param {string} data.satellite - Satellite type ('SENTINEL-1' or 'SENTINEL-2')
   * @param {Object} data.dateRange - Date range for the imagery
   * @param {Date} data.dateRange.start - Start date of the date range
   * @param {Date} data.dateRange.end - End date of the date range
   * @param {ee.Image} data.eeImage - Earth Engine Image object (median composite)
   * @param {Array<string>} data.bands - Array of band names included in the image
   * @param {number} data.cloudCover - Average cloud cover percentage
   * @param {number} data.imageCount - Number of images used in the composite
   * 
   * @example
   * const satImage = new SatelliteImage({
   *   polygonName: 'Mining Area 1',
   *   satellite: 'SENTINEL-2',
   *   dateRange: {
   *     start: new Date('2024-01-01'),
   *     end: new Date('2024-06-01')
   *   },
   *   eeImage: ee.Image(...),
   *   bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
   *   cloudCover: 15.3,
   *   imageCount: 42
   * });
   */
  constructor(data) {
    // Validate required fields
    if (!data || typeof data !== 'object') {
      throw new TypeError('SatelliteImage data must be an object');
    }
    
    if (!data.polygonName || typeof data.polygonName !== 'string') {
      throw new TypeError('SatelliteImage polygonName must be a non-empty string');
    }
    
    if (!data.satellite || typeof data.satellite !== 'string') {
      throw new TypeError('SatelliteImage satellite must be a non-empty string');
    }
    
    if (!['SENTINEL-1', 'SENTINEL-2'].includes(data.satellite)) {
      throw new TypeError('SatelliteImage satellite must be "SENTINEL-1" or "SENTINEL-2"');
    }
    
    if (!data.dateRange || typeof data.dateRange !== 'object') {
      throw new TypeError('SatelliteImage dateRange must be an object');
    }
    
    if (!(data.dateRange.start instanceof Date) || isNaN(data.dateRange.start.getTime())) {
      throw new TypeError('SatelliteImage dateRange.start must be a valid Date object');
    }
    
    if (!(data.dateRange.end instanceof Date) || isNaN(data.dateRange.end.getTime())) {
      throw new TypeError('SatelliteImage dateRange.end must be a valid Date object');
    }
    
    if (data.dateRange.start >= data.dateRange.end) {
      throw new RangeError('SatelliteImage dateRange.start must be before dateRange.end');
    }
    
    // eeImage can be null when using backend mode
    // if (!data.eeImage) {
    //   throw new TypeError('SatelliteImage eeImage must be provided');
    // }
    
    if (!data.bands || !Array.isArray(data.bands) || data.bands.length === 0) {
      throw new TypeError('SatelliteImage bands must be a non-empty array');
    }
    
    if (typeof data.cloudCover !== 'number' || data.cloudCover < 0 || data.cloudCover > 100) {
      throw new TypeError('SatelliteImage cloudCover must be a number between 0 and 100');
    }
    
    if (typeof data.imageCount !== 'number' || data.imageCount < 0 || !Number.isInteger(data.imageCount)) {
      throw new TypeError('SatelliteImage imageCount must be a non-negative integer');
    }
    
    // Store properties
    this.polygonName = data.polygonName;
    this.satellite = data.satellite;
    this.dateRange = {
      start: data.dateRange.start,
      end: data.dateRange.end
    };
    this.eeImage = data.eeImage;
    this.bands = [...data.bands]; // Create a copy to prevent external modification
    this.cloudCover = data.cloudCover;
    this.imageCount = data.imageCount;
  }
  
  /**
   * Get image metadata
   * 
   * Returns a plain object containing all metadata about the satellite image,
   * excluding the Earth Engine Image object itself.
   * 
   * @returns {Object} Metadata object
   * @returns {string} return.polygonName - Name of the associated polygon
   * @returns {string} return.satellite - Satellite type
   * @returns {Object} return.dateRange - Date range object
   * @returns {Date} return.dateRange.start - Start date
   * @returns {Date} return.dateRange.end - End date
   * @returns {Array<string>} return.bands - Array of band names
   * @returns {number} return.cloudCover - Average cloud cover percentage
   * @returns {number} return.imageCount - Number of images in composite
   * 
   * @example
   * const metadata = satImage.getMetadata();
   * // Returns: {
   * //   polygonName: 'Mining Area 1',
   * //   satellite: 'SENTINEL-2',
   * //   dateRange: { start: Date(...), end: Date(...) },
   * //   bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
   * //   cloudCover: 15.3,
   * //   imageCount: 42
   * // }
   */
  getMetadata() {
    return {
      polygonName: this.polygonName,
      satellite: this.satellite,
      dateRange: {
        start: this.dateRange.start,
        end: this.dateRange.end
      },
      bands: [...this.bands], // Return a copy to prevent external modification
      cloudCover: this.cloudCover,
      imageCount: this.imageCount
    };
  }
  
  /**
   * Get a JSON representation of the satellite image
   * 
   * Returns a plain object with all properties (excluding eeImage).
   * Useful for serialization and debugging.
   * 
   * @returns {Object} Plain object representation
   * 
   * @example
   * const json = satImage.toJSON();
   * // Returns: { polygonName: 'Mining Area 1', satellite: 'SENTINEL-2', ... }
   */
  toJSON() {
    return {
      polygonName: this.polygonName,
      satellite: this.satellite,
      dateRange: {
        start: this.dateRange.start.toISOString(),
        end: this.dateRange.end.toISOString()
      },
      bands: this.bands,
      cloudCover: this.cloudCover,
      imageCount: this.imageCount
    };
  }
  
  /**
   * Get a string representation of the satellite image
   * 
   * @returns {string} String representation
   * 
   * @example
   * satImage.toString();
   * // Returns: "SatelliteImage: Mining Area 1 (SENTINEL-2, 42 images)"
   */
  toString() {
    return `SatelliteImage: ${this.polygonName} (${this.satellite}, ${this.imageCount} images)`;
  }
}

export default SatelliteImage;
export { SatelliteImage };
