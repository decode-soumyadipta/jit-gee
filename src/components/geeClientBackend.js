/**
 * Google Earth Engine Client Component (Backend Version)
 * 
 * Uses Python Flask backend for Earth Engine operations.
 * This approach uses the same authentication as Data_acquisition.ipynb
 */

import CONFIG from '../utils/config.js';
import { AppError, ErrorTypes } from '../utils/errors.js';

class GEEClientBackend {
  constructor() {
    this.initialized = false;
    this.authenticated = false;
    // Dynamically use current host origin (works both locally and on Render/Cloud)
    this.backendUrl = (typeof window !== 'undefined' && window.location.origin) ? window.location.origin : '';
  }

  /**
   * Initialize by checking backend health
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/health`);
      const data = await response.json();
      
      if (data.authenticated) {
        this.initialized = true;
        this.authenticated = true;
        console.log('✅ Backend connected successfully');
        console.log(`✅ Earth Engine authenticated with project: ${data.project}`);
      } else {
        throw new Error('Backend is not authenticated with Earth Engine');
      }
    } catch (error) {
      throw new AppError(
        ErrorTypes.AUTH_ERROR,
        'Failed to connect to backend server. Make sure the Python backend is running on port 5001.',
        { 
          originalError: error.message,
          solution: 'Run: cd backend && source venv/bin/activate && python3 server.py'
        }
      );
    }
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Fetch satellite imagery for a given polygon
   * New algorithm: searches both Sentinel-1 and Sentinel-2 with ±15 day buffer
   */
  async fetchImagery(params) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const {
        polygon,
        targetDate,
        cloudCoverMax = CONFIG.cloudCoverMax,
        bufferDays = 30
      } = params;

      // Convert polygon to coordinates array
      let coordinates;
      
      if (Array.isArray(polygon)) {
        coordinates = polygon;
      } else if (polygon && polygon.coordinates && Array.isArray(polygon.coordinates)) {
        coordinates = polygon.coordinates;
      } else {
        throw new Error('Invalid polygon format. Expected coordinates array.');
      }

      // Make request to backend with auth token
      const authToken = sessionStorage.getItem('jit_gee_auth') || '';
      const response = await fetch(`${this.backendUrl}/api/fetch-imagery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          polygon: coordinates,
          targetDate,
          cloudCoverMax,
          bufferDays
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'No imagery available') {
          throw new AppError(
            ErrorTypes.FETCH_ERROR,
            'No imagery available for the selected parameters',
            {
              targetDate,
              cloudCoverMax,
              suggestion: data.suggestion || 'Try a different date or location'
            }
          );
        }
        throw new Error(data.error || 'Fetch failed');
      }

      console.log('Imagery fetched successfully:', data);

      return data; // Return the full response with satellites array

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        ErrorTypes.FETCH_ERROR,
        'Failed to fetch satellite imagery from backend',
        { originalError: error.message, params }
      );
    }
  }

  /**
   * Export imagery and download locally
   */
  async exportToGoogleDrive(params) {
    try {
      const {
        polygon,
        polygonName,
        satellite,
        startDate,
        endDate,
        year
      } = params;

      // polygon should already be raw coordinates array
      let coordinates;
      if (Array.isArray(polygon)) {
        coordinates = polygon;
      } else if (polygon && polygon.coordinates && Array.isArray(polygon.coordinates)) {
        coordinates = polygon.coordinates;
      } else {
        throw new Error('Invalid polygon format for export');
      }

      const response = await fetch(`${this.backendUrl}/api/export-geotiff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          polygon: coordinates,
          polygonName,
          satellite,
          startDate,
          endDate,
          year
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Export failed');
      }

      // Download the file using the URL from Earth Engine
      if (data.downloadUrl) {
        console.log(`📥 Downloading ${data.filename}...`);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`✅ Download started: ${data.filename}`);
      }

      return {
        taskId: data.downloadUrl,
        filename: data.filename
      };

    } catch (error) {
      throw new AppError(
        ErrorTypes.EXPORT_ERROR,
        'Failed to export imagery',
        { originalError: error.message }
      );
    }
  }

  /**
   * Batch export multiple polygons
   */
  async batchExport(polygons, satellite, startDate, endDate, year) {
    try {
      const polygonData = polygons.map(poly => ({
        name: poly.name,
        coordinates: poly.coordinates
      }));

      const response = await fetch(`${this.backendUrl}/api/batch-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          polygons: polygonData,
          satellite,
          startDate,
          endDate,
          year
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Batch export failed');
      }

      return data; // { successful: [...], failed: [...] }

    } catch (error) {
      throw new AppError(
        ErrorTypes.EXPORT_ERROR,
        'Failed to batch export imagery',
        { originalError: error.message }
      );
    }
  }

  /**
   * Reset authentication state
   */
  resetAuth() {
    this.authenticated = false;
    this.initialized = false;
  }
}

export default GEEClientBackend;
