/**
 * Export Manager Component
 * 
 * Manages GeoTIFF export operations to Google Drive, including:
 * - Single polygon export
 * - Batch export for multiple polygons
 * - Filename generation with sanitization
 * - Export progress tracking
 * 
 * Requirements:
 * - 8.2: Validate that imagery has been fetched before export
 * - 8.3: Export Sentinel_Image to Google Drive as GeoTIFF
 * - 8.4: Use scale of 10 meters per pixel
 * - 8.5: Use EPSG:4326 coordinate reference system
 * - 8.6: Generate unique filenames including polygon name and date
 * - 8.7: Display export progress and completion status
 * - 9.3: Process each polygon independently
 * - 9.4: Track progress for each export task
 * - 9.5: Handle partial failures gracefully
 * - 9.6: Display progress for each polygon being processed
 * - 14.1: Set spatial resolution to 10 meters per pixel
 * - 14.2: Set maxPixels parameter to 1e13
 * - 14.3: Export images as Float data type
 * - 14.4: Include all selected spectral bands
 * - 14.5: Clip exported imagery to bounding box
 * - 14.6: Organize files in designated Google Drive folder
 * - 15.1: Generate filenames including polygon name
 * - 15.2: Generate filenames including year
 * - 15.3: Generate filenames including unique identifier
 * - 15.4: Use underscores to separate filename components
 * - 15.5: Sanitize polygon names to remove invalid characters
 * - 15.6: Ensure filename uniqueness to prevent overwrites
 */

import CONFIG from '../utils/config.js';
import { AppError, ErrorTypes } from '../utils/errors.js';

class ExportManager {
  /**
   * Create an ExportManager instance
   * @param {GEEClient} geeClient - Initialized GEE client instance
   */
  constructor(geeClient) {
    if (!geeClient) {
      throw new Error('GEEClient instance is required');
    }
    
    this.geeClient = geeClient;
    this.exportTasks = [];
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      tasks: []
    };
  }

  /**
   * Export satellite imagery for a single polygon to Google Drive
   * 
   * @param {Object} polygon - Polygon object with name and geometry
   * @param {ee.Image} image - Earth Engine image to export
   * @param {Object} metadata - Export metadata (satellite, year, etc.)
   * @param {boolean} [skipProgressUpdate=false] - Skip updating total progress (used by exportAll)
   * @returns {Promise<Object>} Export task object
   * @throws {AppError} If export fails
   */
  async exportPolygon(polygon, image, metadata, skipProgressUpdate = false) {
    try {
      // Validate inputs
      if (!polygon || !polygon.name) {
        throw new AppError(
          ErrorTypes.EXPORT_ERROR,
          'Polygon with name is required for export',
          { field: 'polygon' }
        );
      }

      if (!image) {
        throw new AppError(
          ErrorTypes.EXPORT_ERROR,
          'Image is required for export',
          { field: 'image' }
        );
      }

      if (!metadata || !metadata.year) {
        throw new AppError(
          ErrorTypes.EXPORT_ERROR,
          'Metadata with year is required for export',
          { field: 'metadata' }
        );
      }

      // Generate unique filename (Req 15.1, 15.2, 15.3, 15.4, 15.5, 15.6)
      const filename = this.generateFilename(
        polygon.name,
        metadata.year,
        Date.now() // Use timestamp as unique identifier
      );

      // Get polygon geometry for export
      const geometry = polygon.toEEGeometry ? polygon.toEEGeometry() : polygon.geometry;

      // Create export task using ee.batch.Export.image.toDrive()
      const exportTask = ee.batch.Export.image.toDrive({
        image: image,
        description: filename,
        folder: CONFIG.export.folder,           // Req 14.6
        fileNamePrefix: filename,
        scale: CONFIG.export.scale || 10,       // Req 8.4, 14.1
        crs: CONFIG.export.crs,                 // Req 8.5
        maxPixels: CONFIG.export.maxPixels,     // Req 14.2
        region: geometry,                       // Req 14.5
        fileFormat: 'GeoTIFF',
        formatOptions: {
          cloudOptimized: true
        }
      });

      // Start the export task
      exportTask.start();

      // Create task tracking object
      const taskInfo = {
        id: exportTask.id,
        polygonName: polygon.name,
        filename: filename,
        status: 'READY',
        startTime: new Date(),
        updateTime: new Date(),
        metadata: metadata
      };

      // Add to task list
      this.exportTasks.push(taskInfo);
      this.progress.tasks.push(taskInfo);
      
      // Only update total and running counters if not called from exportAll
      if (!skipProgressUpdate) {
        this.progress.total++;
        this.progress.running++;
      } else {
        this.progress.running++;
      }

      console.log(`Export started for polygon: ${polygon.name}, filename: ${filename}`);

      return taskInfo;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorTypes.EXPORT_ERROR,
        'Failed to export polygon',
        { 
          polygonName: polygon?.name,
          originalError: error.message 
        }
      );
    }
  }

  /**
   * Export satellite imagery for all polygons to Google Drive
   * Processes each polygon independently and handles partial failures
   * 
   * @param {Array<Object>} polygons - Array of polygon objects
   * @param {Map<string, ee.Image>} imagery - Map of polygon names to images
   * @param {Object} metadata - Export metadata (satellite, year, etc.)
   * @returns {Promise<Object>} Export results with success and failure counts
   */
  async exportAll(polygons, imagery, metadata) {
    // Reset progress tracking and export tasks
    this.exportTasks = [];
    this.progress = {
      total: polygons.length,
      completed: 0,
      failed: 0,
      running: 0,
      tasks: []
    };

    const results = {
      successful: [],
      failed: []
    };

    // Process each polygon independently (Req 9.3)
    for (const polygon of polygons) {
      try {
        // Get image for this polygon
        const image = imagery.get ? imagery.get(polygon.name) : imagery[polygon.name];
        
        if (!image) {
          throw new AppError(
            ErrorTypes.EXPORT_ERROR,
            `No imagery found for polygon: ${polygon.name}`,
            { polygonName: polygon.name }
          );
        }

        // Export the polygon (Req 9.4)
        const taskInfo = await this.exportPolygon(polygon, image, metadata, true);
        results.successful.push(taskInfo);

        console.log(`Export queued for polygon ${polygon.name} (${results.successful.length}/${polygons.length})`);
      } catch (error) {
        // Handle partial failures gracefully (Req 9.5)
        console.error(`Failed to export polygon ${polygon.name}:`, error);
        
        const failureInfo = {
          polygonName: polygon.name,
          error: error.message,
          timestamp: new Date()
        };
        
        results.failed.push(failureInfo);
        this.progress.failed++;
        
        // Continue processing remaining polygons
        continue;
      }
    }

    // Update final progress
    this.progress.completed = results.successful.length;
    this.progress.running = results.successful.length; // Tasks are running in GEE

    console.log(`Export batch completed: ${results.successful.length} successful, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Generate unique filename with polygon name, year, and identifier
   * 
   * @param {string} polygonName - Name of the polygon
   * @param {number|string} year - Year for the imagery
   * @param {number|string} identifier - Unique identifier (timestamp or index)
   * @returns {string} Sanitized filename
   */
  generateFilename(polygonName, year, identifier) {
    // Sanitize polygon name (Req 15.5)
    const sanitizedName = this.sanitizeFilename(polygonName);
    
    // Sanitize identifier to ensure no invalid characters
    const sanitizedIdentifier = String(identifier).replace(/[/\\:*?"<>|]/g, '_');
    
    // Construct filename with underscores (Req 15.1, 15.2, 15.3, 15.4)
    const filename = `${sanitizedName}_${year}_${sanitizedIdentifier}`;
    
    return filename;
  }

  /**
   * Sanitize filename by removing invalid characters
   * Removes: / \ : * ? " < > |
   * 
   * @param {string} name - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFilename(name) {
    if (!name || typeof name !== 'string') {
      return 'unnamed';
    }

    // Remove invalid filename characters (Req 15.5)
    // Invalid characters: / \ : * ? " < > |
    const sanitized = name
      .replace(/[/\\:*?"<>|]/g, '_')  // Replace invalid chars with underscore
      .replace(/\s+/g, '_')            // Replace whitespace with underscore
      .replace(/_+/g, '_')             // Collapse multiple underscores
      .replace(/^_|_$/g, '');          // Remove leading/trailing underscores

    // Ensure filename is not empty after sanitization
    return sanitized || 'unnamed';
  }

  /**
   * Get current export progress
   * 
   * @returns {Object} Progress information
   */
  getProgress() {
    return {
      total: this.progress.total,
      completed: this.progress.completed,
      failed: this.progress.failed,
      running: this.progress.running,
      tasks: this.progress.tasks.map(task => ({
        id: task.id,
        polygonName: task.polygonName,
        filename: task.filename,
        status: task.status,
        startTime: task.startTime,
        updateTime: task.updateTime
      }))
    };
  }

  /**
   * Update status of a specific export task
   * 
   * @param {string} taskId - Task ID to update
   * @param {string} status - New status ('READY' | 'RUNNING' | 'COMPLETED' | 'FAILED')
   */
  updateTaskStatus(taskId, status) {
    const task = this.progress.tasks.find(t => t.id === taskId);
    
    if (task) {
      const oldStatus = task.status;
      task.status = status;
      task.updateTime = new Date();

      // Update progress counters
      if (oldStatus === 'RUNNING' && status === 'COMPLETED') {
        this.progress.running--;
        this.progress.completed++;
      } else if (oldStatus === 'RUNNING' && status === 'FAILED') {
        this.progress.running--;
        this.progress.failed++;
      } else if (oldStatus === 'READY' && status === 'RUNNING') {
        // Task started running (no counter change needed)
      }

      console.log(`Task ${taskId} status updated: ${oldStatus} -> ${status}`);
    }
  }

  /**
   * Get all export tasks
   * 
   * @returns {Array<Object>} Array of export task information
   */
  getTasks() {
    return this.exportTasks.map(task => ({
      id: task.id,
      polygonName: task.polygonName,
      filename: task.filename,
      status: task.status,
      startTime: task.startTime,
      updateTime: task.updateTime,
      metadata: task.metadata
    }));
  }

  /**
   * Clear all export tasks and reset progress
   */
  reset() {
    this.exportTasks = [];
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      tasks: []
    };
  }
}

export default ExportManager;
