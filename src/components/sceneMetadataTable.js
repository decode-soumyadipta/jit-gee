/**
 * Scene Metadata Table Component
 * 
 * Displays available satellite scenes in a table format with:
 * - Date
 * - Cloud Coverage %
 * - Orbit #
 * - Scene ID
 * 
 * Includes export to CSV/Excel functionality
 */

class SceneMetadataTable {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    this.scenes = [];
    this.satellite = null;
    
    this.render();
  }
  
  /**
   * Set scenes data and render table
   */
  setScenes(scenes, satellite) {
    this.scenes = scenes;
    this.satellite = satellite;
    this.render();
  }
  
  /**
   * Clear the table
   */
  clear() {
    this.scenes = [];
    this.satellite = null;
    this.render();
  }
  
  /**
   * Render the table
   */
  render() {
    if (this.scenes.length === 0) {
      this.container.innerHTML = `
        <div class="metadata-header">
          <h3>📊 Scene Metadata</h3>
        </div>
        <div class="metadata-empty">
          <div class="empty-icon">📡</div>
          <p class="empty-title">No Scenes Available</p>
          <p class="metadata-hint">Upload a KML file and fetch imagery to see available satellite scenes</p>
        </div>
      `;
      return;
    }
    
    // Sort scenes by date (most recent first)
    const sortedScenes = [...this.scenes].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    const tableHTML = `
      <div class="metadata-header">
        <h3>${this.satellite || 'Satellite'} Scenes</h3>
        <button id="export-metadata-btn" class="export-btn">
          📊 Export to Excel
        </button>
      </div>
      <div class="metadata-table-wrapper">
        <table class="metadata-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Cloud %</th>
              <th>Orbit #</th>
              <th>Scene ID</th>
            </tr>
          </thead>
          <tbody>
            ${sortedScenes.map(scene => `
              <tr>
                <td>${scene.date}</td>
                <td>${scene.cloudCover}%</td>
                <td>${scene.orbit}</td>
                <td class="scene-id" title="${scene.sceneId}">${this.truncateSceneId(scene.sceneId)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="metadata-footer">
        <p>${sortedScenes.length} scene(s) available</p>
      </div>
    `;
    
    this.container.innerHTML = tableHTML;
    
    // Attach export button handler
    const exportBtn = document.getElementById('export-metadata-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToCSV());
    }
  }
  
  /**
   * Truncate long scene IDs for display
   */
  truncateSceneId(sceneId) {
    if (sceneId.length > 40) {
      return sceneId.substring(0, 37) + '...';
    }
    return sceneId;
  }
  
  /**
   * Export table data to CSV
   */
  exportToCSV() {
    if (this.scenes.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Sort scenes by date
    const sortedScenes = [...this.scenes].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    // Create CSV content
    const headers = ['Date', 'Cloud Coverage %', 'Orbit #', 'Scene ID'];
    const rows = sortedScenes.map(scene => [
      scene.date,
      scene.cloudCover,
      scene.orbit,
      scene.sceneId
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `${this.satellite || 'satellite'}_scenes_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Exported ${sortedScenes.length} scenes to ${filename}`);
  }
}

export default SceneMetadataTable;
