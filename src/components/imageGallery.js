/**
 * Image Gallery Component
 * 
 * Displays fetched satellite imagery as RGB thumbnails in a gallery view
 */

class ImageGallery {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Gallery container with id "${containerId}" not found`);
    }
    
    this.images = new Map(); // Map of polygon name -> image data
  }
  
  /**
   * Add an image to the gallery
   * 
   * @param {string} polygonName - Name of the polygon
   * @param {Object} imageData - Image data
   * @param {string} imageData.thumbnailUrl - URL of the thumbnail image
   * @param {string} imageData.satellite - Satellite type
   * @param {number} imageData.imageCount - Number of images in composite
   * @param {Object} imageData.dateRange - Date range
   */
  addImage(polygonName, imageData) {
    this.images.set(polygonName, imageData);
    this.render();
  }
  
  /**
   * Clear all images from the gallery
   */
  clear() {
    this.images.clear();
    this.render();
  }
  
  /**
   * Show the gallery
   */
  show() {
    this.container.style.display = 'block';
  }
  
  /**
   * Hide the gallery
   */
  hide() {
    this.container.style.display = 'none';
  }
  
  /**
   * Render the gallery
   */
  render() {
    // Clear existing content
    this.container.innerHTML = '';
    
    if (this.images.size === 0) {
      this.hide();
      return;
    }
    
    this.show();
    
    // Create gallery header
    const header = document.createElement('div');
    header.className = 'gallery-header';
    header.innerHTML = `
      <h2>Fetched Imagery (${this.images.size} polygon${this.images.size > 1 ? 's' : ''})</h2>
    `;
    this.container.appendChild(header);
    
    // Create gallery grid
    const grid = document.createElement('div');
    grid.className = 'gallery-grid';
    
    // Add each image
    for (const [polygonName, imageData] of this.images) {
      const card = this.createImageCard(polygonName, imageData);
      grid.appendChild(card);
    }
    
    this.container.appendChild(grid);
  }
  
  /**
   * Create an image card
   */
  createImageCard(polygonName, imageData) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    
    // Create image element
    const img = document.createElement('img');
    img.src = imageData.thumbnailUrl;
    img.alt = `${polygonName} - ${imageData.satellite}`;
    img.className = 'gallery-image';
    img.loading = 'lazy';
    
    // Add loading state
    img.addEventListener('load', () => {
      card.classList.add('loaded');
    });
    
    img.addEventListener('error', () => {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="512" height="512"%3E%3Crect fill="%23ddd" width="512" height="512"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif" font-size="24"%3EImage unavailable%3C/text%3E%3C/svg%3E';
      card.classList.add('error');
    });
    
    // Create info overlay
    const info = document.createElement('div');
    info.className = 'gallery-info';
    
    const startDate = new Date(imageData.dateRange.start).toLocaleDateString();
    const endDate = new Date(imageData.dateRange.end).toLocaleDateString();
    
    info.innerHTML = `
      <h3>${polygonName}</h3>
      <p class="gallery-meta">
        <span class="satellite-badge">${imageData.satellite}</span>
        ${imageData.type ? `<span class="type-badge type-${imageData.type.toLowerCase()}">${imageData.type}</span>` : ''}
        <span>${imageData.imageCount} images</span>
      </p>
      <p class="gallery-dates">${startDate} - ${endDate}</p>
    `;
    
    card.appendChild(img);
    card.appendChild(info);
    
    return card;
  }
}

export default ImageGallery;
