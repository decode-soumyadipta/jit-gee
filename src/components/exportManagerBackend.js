/**
 * Export Manager Component (Backend Version)
 * 
 * Manages GeoTIFF export operations using the Python backend
 */

import CONFIG from '../utils/config.js';
import { AppError, ErrorTypes } from '../utils/errors.js';

class ExportManagerBackend {
  constructor(geeClient) {
    this.geeClient = geeClient;
  }

  /**
   * Export all polygons with their imagery to Google Drive
   */
  async exportAll(polygons, imagery, metadata) {
    const results = {
      successful: [],
      failed: []
    };

    const { year } = metadata;

    for (const polygon of polygons) {
      try {
        // Check if imagery exists for this polygon
        if (!imagery.has(polygon.name)) {
          throw new AppError(
            ErrorTypes.EXPORT_ERROR,
            `No imagery found for polygon: ${polygon.name}`,
            { polygonName: polygon.name }
          );
        }

        const imageryData = imagery.get(polygon.name);
        
        console.log('🔍 Export Debug - Imagery data for', polygon.name, ':', imageryData);
        
        // New algorithm stores satellites array
        if (!imageryData.satellites || imageryData.satellites.length === 0) {
          throw new AppError(
            ErrorTypes.EXPORT_ERROR,
            `No satellite data found for polygon: ${polygon.name}`,
            { polygonName: polygon.name }
          );
        }

        // Export each satellite type found
        for (const satData of imageryData.satellites) {
          console.log('🔍 Export Debug - Satellite data:', satData);
          
          const satellite = satData.satellite;
          const dateRange = satData.dateRange;
          
          console.log('🔍 Export Debug - Date range:', dateRange);
          
          if (!dateRange || !dateRange.start || !dateRange.end) {
            throw new AppError(
              ErrorTypes.EXPORT_ERROR,
              `Invalid date range for ${satellite} in polygon: ${polygon.name}`,
              { polygonName: polygon.name, satellite, dateRange }
            );
          }
          
          // Use backend to export with raw coordinates from geometry
          const result = await this.geeClient.exportToGoogleDrive({
            polygon: polygon.geometry.coordinates,  // Pass raw coordinates from geometry
            polygonName: `${polygon.name}_${satellite}`,
            satellite: satellite,
            startDate: dateRange.start,
            endDate: dateRange.end,
            year: year
          });

          results.successful.push({
            polygonName: polygon.name,
            satellite: satellite,
            taskId: result.taskId,
            filename: result.filename
          });

          console.log(`✅ Export started for ${polygon.name} (${satellite}): ${result.filename}`);
        }

      } catch (error) {
        console.error(`Failed to export polygon ${polygon.name}:`, error);

        const failureInfo = {
          polygonName: polygon.name,
          error: error.message || 'Unknown error',
          errorType: error.type || 'UNKNOWN_ERROR'
        };

        results.failed.push(failureInfo);
      }
    }

    console.log(`Export batch completed: ${results.successful.length} successful, ${results.failed.length} failed`);

    return results;
  }
}

export default ExportManagerBackend;
