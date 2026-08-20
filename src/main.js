/**
 * Main Application Controller - Professional Geospatial Portal
 * Handles AOI Definition, Coordinate Search, Expanding Cloud Filtering,
 * Leaflet Resizing, Footprint Extent Polygons (Dotted Line),
 * Multi-tile AOI Coverage Grouping, and SRTM 30m DEM Mosaicking Exports.
 */

import KMLParser from './components/kmlParser.js';
import GEEClientBackend from './components/geeClientBackend.js';

class SatelliteDataApp {
  constructor() {
    this.state = {
      map: null,
      drawControl: null,
      drawnItems: null,
      footprintLayers: null,
      currentPolygon: null,
      targetDate: null,
      bufferDays: 30,
      cloudCoverMax: 20,
      scenes: [],
      selectedScenes: new Set(),
      hitMarker: null,
      activeFootprintSceneId: null
    };

    this.kmlParser = new KMLParser();
    this.geeClient = new GEEClientBackend();
    
    // UI Elements Cache
    this.elements = {
        authGateOverlay: document.getElementById('auth-gate-overlay'),
        authGateCard: document.querySelector('.auth-gate-card'),
        gateForm: document.getElementById('auth-gate-form'),
        gateInput: document.getElementById('gate-passcode-input'),
        gateErrorMsg: document.getElementById('gate-error-msg'),
        gateTogglePwd: document.getElementById('gate-toggle-pwd'),
        headerLockBtn: document.getElementById('header-lock-btn'),
        aoiBtn: document.getElementById('aoi-btn'),
        searchLat: document.getElementById('search-lat'),
        searchLon: document.getElementById('search-lon'),
        searchCoordBtn: document.getElementById('search-coord-btn'),
        targetDateInput: document.getElementById('target-date-input'),
        bufferDaysInput: document.getElementById('buffer-days-input'),
        bufferValueDisplay: document.getElementById('buffer-value-display'),
        cloudCoverInput: document.getElementById('cloud-cover-input'),
        cloudValueDisplay: document.getElementById('cloud-value-display'),
        fetchBtn: document.getElementById('fetch-btn'),
        downloadBestBtn: document.getElementById('download-best-btn'),
        downloadBtn: document.getElementById('download-btn'),
        includeDemCheckbox: document.getElementById('include-dem-checkbox'),
        statusMsg: document.getElementById('status-message'),
        statusDot: document.getElementById('status-indicator-dot'),
        tableBody: document.getElementById('metadata-table-body'),
        areaDisplay: document.getElementById('area-display'),
        areaValue: document.getElementById('polygon-area-value'),
        centroidValue: document.getElementById('aoi-centroid-value'),
        selectAll: document.getElementById('select-all-scenes'),
        resultsCountBadge: document.getElementById('results-count-badge'),
        mapSection: document.getElementById('map-section'),
        resultsSection: document.getElementById('results-section'),
        panelResizer: document.getElementById('panel-resizer'),
        mapCoordHover: document.getElementById('map-coord-hover'),
        progressOverlay: document.getElementById('progress-indicator'),
        progressBar: document.getElementById('progress-bar-fill'),
        progressTitle: document.getElementById('progress-title'),
        progressMessage: document.getElementById('progress-message'),
        progressStepList: document.getElementById('progress-step-list')
    };
  }

  async initialize() {
    console.log('Initializing Satellite Data Acquisition Portal...');
    this.checkAuthStatus();
    this.initMap();
    this.setupEventListeners();
    this.setupAuthGateListeners();
    this.setupDraggableResizer();
    this.setDefaultDate();

    // Check backend health
    try {
        await this.geeClient.initialize();
        this.updateStatus('✅ Earth Engine Connected (Service Account Active)');
        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot online';
        }
    } catch (e) {
        this.updateStatus('⚠️ Backend connection issue. Check server.');
        if (this.elements.statusDot) {
            this.elements.statusDot.className = 'status-dot';
            this.elements.statusDot.style.backgroundColor = '#DC2626';
        }
        console.error(e);
    }
  }

  checkAuthStatus() {
    const token = sessionStorage.getItem('jit_gee_auth');
    if (token) {
        if (this.elements.authGateOverlay) {
            this.elements.authGateOverlay.classList.add('hidden');
        }
    } else {
        if (this.elements.authGateOverlay) {
            this.elements.authGateOverlay.classList.remove('hidden');
            setTimeout(() => {
                if (this.elements.gateInput) this.elements.gateInput.focus();
            }, 200);
        }
    }
  }

  setupAuthGateListeners() {
    if (this.elements.gateForm) {
        this.elements.gateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasscodeVerify();
        });
    }

    if (this.elements.gateTogglePwd && this.elements.gateInput) {
        this.elements.gateTogglePwd.addEventListener('click', () => {
            const isPwd = this.elements.gateInput.type === 'password';
            this.elements.gateInput.type = isPwd ? 'text' : 'password';
            this.elements.gateTogglePwd.textContent = isPwd ? '🔒' : '👁️';
        });
    }

    if (this.elements.headerLockBtn) {
        this.elements.headerLockBtn.addEventListener('click', () => {
            sessionStorage.removeItem('jit_gee_auth');
            if (this.elements.gateInput) this.elements.gateInput.value = '';
            if (this.elements.gateErrorMsg) this.elements.gateErrorMsg.textContent = '';
            if (this.elements.authGateOverlay) {
                this.elements.authGateOverlay.classList.remove('hidden');
                setTimeout(() => {
                    if (this.elements.gateInput) this.elements.gateInput.focus();
                }, 200);
            }
        });
    }
  }

  async handlePasscodeVerify() {
    const passcode = (this.elements.gateInput ? this.elements.gateInput.value : '').trim();
    if (!passcode) {
        this.showGateError('Please enter the access code.');
        return;
    }

    try {
        const response = await fetch(`${this.geeClient.backendUrl}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            sessionStorage.setItem('jit_gee_auth', data.token);
            if (this.elements.gateErrorMsg) this.elements.gateErrorMsg.textContent = '';
            if (this.elements.authGateOverlay) {
                this.elements.authGateOverlay.classList.add('hidden');
            }
            if (this.state.map) {
                setTimeout(() => this.state.map.invalidateSize(), 300);
            }
            this.updateStatus('✅ Access Granted. Welcome to the Satellite Acquisition Portal.');
        } else {
            this.showGateError(data.error || 'Incorrect passcode. Access denied.');
        }
    } catch (err) {
        this.showGateError('Network connection error. Ensure server is active.');
    }
  }

  showGateError(msg) {
    if (this.elements.gateErrorMsg) {
        this.elements.gateErrorMsg.textContent = `❌ ${msg}`;
    }
    if (this.elements.authGateCard) {
        this.elements.authGateCard.classList.remove('shake-card');
        void this.elements.authGateCard.offsetWidth; // Trigger reflow
        this.elements.authGateCard.classList.add('shake-card');
    }
    if (this.elements.gateInput) {
        this.elements.gateInput.select();
    }
  }

  setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    if (this.elements.targetDateInput) {
        this.elements.targetDateInput.value = today;
        this.state.targetDate = today;
    }
  }

  initMap() {
    this.state.map = L.map('map', {
        zoomControl: true,
        attributionControl: true
    }).setView([23.2599, 77.4126], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors | GEE & SRTM NASA'
    }).addTo(this.state.map);

    this.state.drawnItems = new L.FeatureGroup();
    this.state.map.addLayer(this.state.drawnItems);

    this.state.footprintLayers = new L.FeatureGroup();
    this.state.map.addLayer(this.state.footprintLayers);

    // Ensure Leaflet Draw real-time area tooltip strictly displays in km²
    if (typeof L !== 'undefined' && L.GeometryUtil) {
        L.GeometryUtil.readableArea = function (area) {
            return (area / 1000000).toFixed(2) + ' km²';
        };
    }

    this.state.drawControl = new L.Control.Draw({
        edit: { featureGroup: this.state.drawnItems },
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: { color: '#e1e100', message: '<strong>Polygon shape cannot cross itself!</strong>' },
                shapeOptions: { color: '#2563EB', fillOpacity: 0.2 },
                showArea: true,
                metric: true
            },
            rectangle: {
                shapeOptions: { color: '#2563EB', fillOpacity: 0.2 },
                metric: true
            },
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    this.state.map.addControl(this.state.drawControl);

    // Drawing event listeners
    this.state.map.on(L.Draw.Event.CREATED, (e) => {
        this.clearHitMarker();
        this.clearFootprints();
        this.state.drawnItems.clearLayers();
        const layer = e.layer;
        this.state.drawnItems.addLayer(layer);
        this.updateCurrentPolygon(layer.toGeoJSON());
    });

    this.state.map.on(L.Draw.Event.EDITED, (e) => {
        const layers = e.layers;
        layers.eachLayer((layer) => {
            this.updateCurrentPolygon(layer.toGeoJSON());
        });
    });

    // Map mouse hover for coordinates display
    this.state.map.on('mousemove', (e) => {
        if (this.elements.mapCoordHover) {
            this.elements.mapCoordHover.textContent = `Lat: ${e.latlng.lat.toFixed(5)} | Lon: ${e.latlng.lng.toFixed(5)}`;
        }
    });
  }

  setupDraggableResizer() {
    const resizer = this.elements.panelResizer;
    const mapSection = this.elements.mapSection;
    const contentArea = document.getElementById('content-area');
    if (!resizer || !mapSection || !contentArea) return;

    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e) => {
        isDragging = true;
        startY = e.clientY;
        startHeight = mapSection.offsetHeight;
        resizer.classList.add('active');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const deltaY = e.clientY - startY;
        const totalHeight = contentArea.offsetHeight;
        const newHeight = Math.max(160, Math.min(totalHeight - 160, startHeight + deltaY));
        
        mapSection.style.height = `${newHeight}px`;
        if (this.state.map) {
            this.state.map.invalidateSize();
        }
    };

    const onMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            resizer.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            if (this.state.map) {
                this.state.map.invalidateSize();
            }
        }
    };

    resizer.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch support for tablets / touch screens
    resizer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startY = e.touches[0].clientY;
            startHeight = mapSection.offsetHeight;
            resizer.classList.add('active');
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const deltaY = e.touches[0].clientY - startY;
        const totalHeight = contentArea.offsetHeight;
        const newHeight = Math.max(160, Math.min(totalHeight - 160, startHeight + deltaY));
        mapSection.style.height = `${newHeight}px`;
        if (this.state.map) {
            this.state.map.invalidateSize();
        }
    });

    window.addEventListener('touchend', onMouseUp);
  }

  updateCurrentPolygon(geoJson) {
    this.state.currentPolygon = geoJson;
    const area = turf.area(geoJson); // m²
    const areaKm = (area / 1000000).toFixed(2);
    
    // Centroid calculation
    const centroid = turf.centroid(geoJson);
    const centerLon = centroid.geometry.coordinates[0].toFixed(5);
    const centerLat = centroid.geometry.coordinates[1].toFixed(5);

    if (this.elements.searchLat && !this.elements.searchLat.value) {
        this.elements.searchLat.value = centerLat;
    }
    if (this.elements.searchLon && !this.elements.searchLon.value) {
        this.elements.searchLon.value = centerLon;
    }

    this.elements.areaDisplay.style.display = 'block';
    this.elements.areaValue.textContent = areaKm;
    if (this.elements.centroidValue) {
        this.elements.centroidValue.textContent = `Centroid: Lat ${centerLat}, Lon ${centerLon}`;
    }

    this.elements.fetchBtn.disabled = !this.state.targetDate;
    this.updateStatus(`AOI Defined: ${areaKm} km² (Lat: ${centerLat}, Lon: ${centerLon})`);
  }

  setupEventListeners() {
    // 1. KML Import
    this.elements.aoiBtn.addEventListener('click', () => {
        let input = document.getElementById('kml-file-input');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'kml-file-input';
            input.accept = '.kml';
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', (e) => this.handleKmlUpload(e.target.files[0]));
        }
        input.click();
    });

    // 2. Coordinate Search (Top-Right)
    this.elements.searchCoordBtn.addEventListener('click', () => this.handleCoordinateSearch());
    [this.elements.searchLat, this.elements.searchLon].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleCoordinateSearch();
        });
    });

    // 3. Target Date Input
    this.elements.targetDateInput.addEventListener('change', (e) => {
        this.state.targetDate = e.target.value;
        this.elements.fetchBtn.disabled = !this.state.currentPolygon;
    });

    // 4. Search Buffer (± Days) Input
    if (this.elements.bufferDaysInput) {
        this.elements.bufferDaysInput.addEventListener('input', (e) => {
            const val = Math.max(1, Math.min(500, parseInt(e.target.value) || 30));
            this.state.bufferDays = val;
            if (this.elements.bufferValueDisplay) {
                this.elements.bufferValueDisplay.textContent = `±${val} days`;
            }
        });
    }

    // 5. Cloud Cover Input
    this.elements.cloudCoverInput.addEventListener('input', (e) => {
        const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
        this.state.cloudCoverMax = val;
        if (this.elements.cloudValueDisplay) {
            this.elements.cloudValueDisplay.textContent = `${val}%`;
        }
    });

    // 5. Action Buttons
    this.elements.fetchBtn.addEventListener('click', () => this.handleFetch());
    this.elements.downloadBestBtn.addEventListener('click', () => this.handleDownloadBest());
    this.elements.downloadBtn.addEventListener('click', () => this.handleDownloadSelected());

    // 6. Select All Checkbox
    this.elements.selectAll.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const checkboxes = this.elements.tableBody.querySelectorAll('.scene-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            const sceneId = cb.dataset.id;
            if (checked) this.state.selectedScenes.add(sceneId);
            else this.state.selectedScenes.delete(sceneId);
        });
        this.updateDownloadBtnState();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });
  }

  handleCoordinateSearch() {
    const latStr = this.elements.searchLat.value.trim();
    const lonStr = this.elements.searchLon.value.trim();

    if (!latStr || !lonStr) {
        alert('Please enter both Latitude and Longitude.');
        return;
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || lat < -90 || lat > 90) {
        alert('Please enter a valid Latitude between -90 and 90.');
        return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
        alert('Please enter a valid Longitude between -180 and 180.');
        return;
    }

    const cleanLat = Number(lat.toFixed(5));
    const cleanLon = Number(lon.toFixed(5));
    this.elements.searchLat.value = cleanLat;
    this.elements.searchLon.value = cleanLon;

    // Fly to point and place target pin without auto-drawing bounding box
    this.state.map.flyTo([cleanLat, cleanLon], 14, { duration: 1.2 });
    this.placeHitMarker(cleanLat, cleanLon);

    this.updateStatus(`📍 Navigated to Lat ${cleanLat}, Lon ${cleanLon}. Draw your custom AOI polygon using map tools on the left.`);
  }

  placeHitMarker(lat, lon) {
    this.clearHitMarker();

    const hitIcon = L.divIcon({
        className: 'custom-hit-marker',
        html: `<div class="pulse-pin"><div class="pulse-ring"></div></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    this.state.hitMarker = L.marker([lat, lon], { icon: hitIcon }).addTo(this.state.map);
    this.state.hitMarker.bindPopup(`<strong>Target Location</strong><br>Lat: ${lat}<br>Lon: ${lon}`).openPopup();
  }

  clearHitMarker() {
    if (this.state.hitMarker) {
        this.state.map.removeLayer(this.state.hitMarker);
        this.state.hitMarker = null;
    }
  }

  clearFootprints() {
    if (this.state.footprintLayers) {
        this.state.footprintLayers.clearLayers();
    }
    this.state.activeFootprintSceneId = null;
    document.querySelectorAll('.btn-footprint-toggle.active').forEach(b => b.classList.remove('active'));
  }

  toggleFootprint(sceneId) {
    if (this.state.activeFootprintSceneId === sceneId) {
        this.clearFootprints();
        return;
    }

    const scene = this.state.scenes.find(s => s.sceneId === sceneId);
    if (!scene || !scene.footprint) {
        console.warn('No footprint geometry available for scene:', sceneId);
        return;
    }

    this.clearFootprints();
    this.state.activeFootprintSceneId = sceneId;

    const isS1 = scene.satellite === 'SENTINEL-1';
    const color = isS1 ? '#E11D48' : '#0284C7';
    const fillColor = isS1 ? '#FFE4E6' : '#E0F2FE';

    // Dotted / Dashed Line Footprint on Map
    const layer = L.geoJSON(scene.footprint, {
        style: {
            color: color,
            weight: 2.5,
            dashArray: '6, 6', // DOTTED OUTLINE
            fillColor: fillColor,
            fillOpacity: 0.18
        }
    }).addTo(this.state.footprintLayers);

    // Rich popup on footprint
    const popupContent = `
        <div class="footprint-popup-card">
            <div class="footprint-header">🛰️ ${scene.satellite} Swath / Footprint</div>
            <div><strong>Scene:</strong> ${scene.sceneId.split('/').pop()}</div>
            <div><strong>Acquisition Date:</strong> ${scene.date}</div>
            <div><strong>AOI Coverage:</strong> <span class="coverage-highlight">${scene.aoiCoveragePct || 100}%</span></div>
            <div><strong>Cloud Cover:</strong> ${isS1 ? 'N/A' : scene.cloudCover + '%'}</div>
            <div><strong>Orbit:</strong> ${scene.orbit || 'N/A'}</div>
        </div>
    `;
    layer.bindPopup(popupContent).openPopup();

    // Mark button active
    const btn = document.querySelector(`.btn-footprint-toggle[data-id="${sceneId}"]`);
    if (btn) btn.classList.add('active');

    this.updateStatus(`👁️ Displaying footprint outline for ${scene.satellite} (${scene.date}) - ${scene.aoiCoveragePct}% AOI Coverage.`);
  }

  showBundleFootprints(groupScenes) {
    this.clearFootprints();
    const layers = [];

    groupScenes.forEach(scene => {
        if (!scene.footprint) return;
        const isS1 = scene.satellite === 'SENTINEL-1';
        const color = isS1 ? '#E11D48' : '#0284C7';
        const fillColor = isS1 ? '#FFE4E6' : '#E0F2FE';

        const layer = L.geoJSON(scene.footprint, {
            style: {
                color: color,
                weight: 2,
                dashArray: '6, 6',
                fillColor: fillColor,
                fillOpacity: 0.15
            }
        }).addTo(this.state.footprintLayers);
        layers.push(layer);
    });

    if (layers.length > 0) {
        this.state.map.fitBounds(this.state.footprintLayers.getBounds().pad(0.1));
        this.updateStatus(`👁️ Displaying footprints for all ${groupScenes.length} tiles in acquisition bundle.`);
    }
  }

  async handleKmlUpload(file) {
    if (!file) return;
    this.updateStatus(`Processing ${file.name}...`);
    try {
        const result = await this.kmlParser.parseFile(file);
        if (result.polygons.length > 0) {
            const poly = result.polygons[0];
            this.clearHitMarker();
            this.clearFootprints();
            this.state.drawnItems.clearLayers();
            const layer = L.geoJSON(poly.geometry, {
                style: { color: '#2563EB', weight: 2, fillOpacity: 0.2 }
            }).addTo(this.state.drawnItems);
            
            this.state.map.fitBounds(layer.getBounds());
            this.updateCurrentPolygon(poly.geometry);
        }
    } catch (e) {
        this.updateStatus(`❌ KML Error: ${e.message}`);
    }
  }

  async handleFetch() {
    const cloudMax = parseFloat(this.elements.cloudCoverInput.value) || 20;
    const bufferDays = parseInt(this.elements.bufferDaysInput ? this.elements.bufferDaysInput.value : 30) || 30;
    
    this.showProgress(`Querying Earth Engine Archives (±${bufferDays} days)...`, 15, [
        '🛰️ Connecting to Earth Engine via Service Account...',
        `🔍 Searching Sentinel-1 SAR within ±${bufferDays} days...`,
        `☁️ Searching Sentinel-2 Optical (cloud ≤ ${cloudMax}%) in ±${bufferDays} days...`,
        '📐 Computing exact tile footprints and AOI coverage percentages...'
    ]);

    this.state.scenes = [];
    this.state.selectedScenes.clear();
    this.clearFootprints();
    this.renderTable();

    try {
        const coords = this.state.currentPolygon.geometry 
            ? this.state.currentPolygon.geometry.coordinates 
            : this.state.currentPolygon.coordinates;

        const params = {
            polygon: coords,
            targetDate: this.state.targetDate,
            cloudCoverMax: cloudMax,
            bufferDays: bufferDays
        };

        this.updateProgress(45);
        this.updateStatus(`Searching archives in ±${bufferDays} days for clear scenes (≤${cloudMax}% cloud)...`);
        
        const result = await this.geeClient.fetchImagery(params);
        this.updateProgress(85);

        let bufferUsed = 15;
        if (result && result.satellites) {
            result.satellites.forEach(sat => {
                if (sat.bufferDaysUsed) {
                    bufferUsed = Math.max(bufferUsed, sat.bufferDaysUsed);
                }
                if (sat.scenes) {
                    sat.scenes.forEach(scene => {
                        this.state.scenes.push({
                            ...scene,
                            satellite: sat.satellite,
                            bands: sat.bands
                        });
                    });
                }
            });
        }

        this.updateProgress(100);
        setTimeout(() => this.hideProgress(), 400);

        if (this.state.scenes.length === 0) {
            this.updateStatus('⚠️ No satellite imagery found within ±300 days for this AOI.');
        } else {
            this.updateStatus(`✅ Found ${this.state.scenes.length} satellite scenes (Search buffer: ±${bufferUsed} days, Cloud: ≤${cloudMax}%).`);
        }
        
        this.renderTable();
        this.updateDownloadBtnState();

    } catch (e) {
        this.hideProgress();
        this.updateStatus(`❌ Fetch Failed: ${e.message}`);
        console.error(e);
    }
  }

  renderTable() {
    const tbody = this.elements.tableBody;
    const badge = this.elements.resultsCountBadge;
    
    if (this.state.scenes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div class="empty-state-content">
                        <span class="empty-icon">🛰️</span>
                        <p>No data fetched yet. Define an area and target date to begin.</p>
                    </div>
                </td>
            </tr>
        `;
        if (badge) badge.textContent = '0 Assets';
        return;
    }

    if (badge) badge.textContent = `${this.state.scenes.length} Assets`;

    // Group scenes by `${date}_${satellite}` for multi-tile detection
    const groups = new Map();
    this.state.scenes.forEach(scene => {
        const key = `${scene.date}_${scene.satellite}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(scene);
    });

    let html = '';
    let globalIndex = 0;

    groups.forEach((groupScenes, groupKey) => {
        const [date, satellite] = groupKey.split('_');
        const isS1 = satellite === 'SENTINEL-1';
        const isMultiTile = groupScenes.length > 1;

        if (isMultiTile) {
            // Calculate combined coverage %
            const sumCov = groupScenes.reduce((acc, s) => acc + (s.aoiCoveragePct || 0), 0);
            const combinedCov = Math.min(100.0, Number(sumCov.toFixed(1)));
            const groupScenesJson = JSON.stringify(groupScenes.map(s => s.sceneId)).replace(/"/g, '&quot;');

            // Multi-tile Group Header Card Row
            html += `
                <tr class="multi-tile-group-header-row">
                    <td colspan="9">
                        <div class="bundle-header-card">
                            <div class="bundle-title-col">
                                <span class="badge ${isS1 ? 'badge-s1' : 'badge-s2'}">${satellite}</span>
                                <strong>📅 ${date}</strong>
                                <span class="bundle-tag">📦 Multi-Tile Bundle (${groupScenes.length} Granules)</span>
                                <span class="bundle-coverage-tag">Total AOI Coverage: ${combinedCov}% (Mosaic)</span>
                            </div>
                            <div class="bundle-actions-col">
                                <button class="btn-footprint-toggle btn-bundle-footprints" data-scenes="${groupScenesJson}">
                                    👁️ Show Bundle Footprints
                                </button>
                                <button class="btn-bundle-mosaic" data-date="${date}" data-satellite="${satellite}">
                                    ⚡ Download Date Mosaic (.tif)
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            // Child tile rows
            groupScenes.forEach(scene => {
                html += this.renderSceneRow(scene, globalIndex++, true);
            });

        } else {
            // Single tile row
            html += this.renderSceneRow(groupScenes[0], globalIndex++, false);
        }
    });

    tbody.innerHTML = html;

    // Attach checkbox listeners
    tbody.querySelectorAll('.scene-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) this.state.selectedScenes.add(id);
            else this.state.selectedScenes.delete(id);
            this.updateDownloadBtnState();
        });
    });

    // Attach footprint toggle button listeners
    tbody.querySelectorAll('.btn-footprint-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('btn-bundle-footprints')) {
                const sceneIds = JSON.parse(btn.dataset.scenes.replace(/&quot;/g, '"'));
                const scenes = this.state.scenes.filter(s => sceneIds.includes(s.sceneId));
                this.showBundleFootprints(scenes);
            } else {
                const sceneId = btn.dataset.id;
                this.toggleFootprint(sceneId);
            }
        });
    });

    // Attach bundle mosaic download listeners
    tbody.querySelectorAll('.btn-bundle-mosaic').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const date = btn.dataset.date;
            const satellite = btn.dataset.satellite;
            const includeDem = this.elements.includeDemCheckbox.checked;
            this.downloadMosaicBundle(date, satellite, { includeDem });
        });
    });

    // Attach action dropdown triggers
    tbody.querySelectorAll('.action-btn-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parent = btn.closest('.action-dropdown');
            const menu = parent.querySelector('.dropdown-menu');
            const isShown = menu.classList.contains('show');
            document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
            if (!isShown) menu.classList.add('show');
        });
    });

    // Attach dropdown action item clicks
    tbody.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            const sceneId = item.dataset.id;
            item.closest('.dropdown-menu').classList.remove('show');
            
            const includeDem = action === 'imagery-dem' || action === 'dem-only';
            const demOnly = action === 'dem-only';
            this.downloadSingleScene(sceneId, { includeDem, demOnly });
        });
    });
  }

  renderSceneRow(scene, index, isChildOfBundle = false) {
    const isS1 = scene.satellite === 'SENTINEL-1';
    const collection = scene.collection || (isS1 ? 'COPERNICUS/S1_GRD' : 'COPERNICUS/S2_SR_HARMONIZED');
    
    // Cloud badge styling
    let cloudBadgeClass = 'cloud-clear';
    if (scene.cloudCover > 50) cloudBadgeClass = 'cloud-heavy';
    else if (scene.cloudCover > 20) cloudBadgeClass = 'cloud-moderate';

    // AOI Coverage Badge & Progress Fill
    const cov = scene.aoiCoveragePct !== undefined ? scene.aoiCoveragePct : 100.0;
    let covClass = 'cov-100';
    let covFillClass = 'cov-fill-100';
    if (cov < 50) {
        covClass = 'cov-partial';
        covFillClass = 'cov-fill-partial';
    } else if (cov < 100) {
        covClass = 'cov-high';
        covFillClass = 'cov-fill-high';
    }

    // Proximity text
    const days = scene.daysFromTarget || 0;
    let proximityText = 'Target Date';
    let proxClass = 'proximity-post';
    if (days < 0) {
        proximityText = `Pre (${days}d)`;
        proxClass = 'proximity-pre';
    } else if (days > 0) {
        proximityText = `Post (+${days}d)`;
        proxClass = 'proximity-post';
    }

    const isChecked = this.state.selectedScenes.has(scene.sceneId);
    const tileLabel = scene.tileId ? `Tile ${scene.tileId}` : (isS1 ? 'IW Swath' : 'Granule');
    const isFootprintActive = this.state.activeFootprintSceneId === scene.sceneId;

    return `
        <tr class="${isS1 ? 'row-s1' : 'row-s2'} ${isChildOfBundle ? 'row-bundle-child' : ''}">
            <td><input type="checkbox" class="scene-checkbox" data-id="${scene.sceneId}" ${isChecked ? 'checked' : ''}></td>
            <td><span class="badge ${isS1 ? 'badge-s1' : 'badge-s2'}">${scene.satellite}</span></td>
            <td>
                <div style="font-weight: 600; font-size: 0.78rem;">${tileLabel}</div>
                <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted);">${collection.split('/').pop()}</div>
            </td>
            <td style="font-weight: 600;">${scene.date}</td>
            <td>
                <div class="coverage-cell" title="Tile covers ${cov}% of your defined AOI">
                    <div class="coverage-badge-row">
                        <span class="coverage-badge ${covClass}">${cov}% AOI</span>
                    </div>
                    <div class="coverage-mini-bar">
                        <div class="coverage-mini-fill ${covFillClass}" style="width: ${cov}%;"></div>
                    </div>
                </div>
            </td>
            <td>${isS1 ? '<span style="color:#94A3B8;">N/A (SAR)</span>' : `<span class="cloud-badge ${cloudBadgeClass}">☁️ ${scene.cloudCover}%</span>`}</td>
            <td style="font-family: var(--font-mono); font-size: 0.75rem;">${scene.orbit || 'N/A'}</td>
            <td><span class="proximity-badge ${proxClass}">${proximityText}</span></td>
            <td style="text-align: right;">
                <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    <button class="btn-footprint-toggle ${isFootprintActive ? 'active' : ''}" data-id="${scene.sceneId}" title="Toggle Swath Footprint Boundary on Map">
                        <span>👁️ Footprint</span>
                    </button>
                    
                    <div class="action-dropdown" data-index="${index}">
                        <button class="action-btn-trigger" data-id="${scene.sceneId}" title="Download Options">
                            <span>↓ Download</span>
                            <span style="font-size: 0.65rem;">▾</span>
                        </button>
                        <div class="dropdown-menu" id="dropdown-${index}">
                            <button class="dropdown-item" data-action="imagery" data-id="${scene.sceneId}">
                                🛰️ Download Imagery (.tif)
                            </button>
                            <button class="dropdown-item dem-item" data-action="imagery-dem" data-id="${scene.sceneId}">
                                🏔️ Download with SRTM 30m DEM
                            </button>
                            <button class="dropdown-item dem-item" data-action="dem-only" data-id="${scene.sceneId}">
                                📐 Download SRTM 30m DEM Only
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
  }

  updateDownloadBtnState() {
    this.elements.downloadBestBtn.disabled = this.state.scenes.length === 0;
    this.elements.downloadBtn.disabled = this.state.selectedScenes.size === 0;
  }

  async downloadSingleScene(sceneId, options = {}) {
    const scene = this.state.scenes.find(s => s.sceneId === sceneId);
    if (!scene) return;

    const includeDem = options.includeDem ?? this.elements.includeDemCheckbox.checked;
    const demOnly = options.demOnly ?? false;

    const actionText = demOnly ? 'SRTM 30m DEM' : (includeDem ? 'Satellite Imagery + SRTM 30m DEM' : 'Satellite Imagery');
    
    this.showProgress(`Exporting ${actionText}...`, 20, [
        `📍 AOI: Lat ${this.elements.searchLat.value || ''}, Lon ${this.elements.searchLon.value || ''}`,
        `🛰️ Requesting GeoTIFF for ${this.truncate(sceneId.split('/').pop(), 20)}...`,
        includeDem ? '🏔️ Querying and mosaicking NASA SRTM 30m DEM...' : '⏩ Skipping DEM (not requested)',
        '💾 Saving GeoTIFF files into organized folder...'
    ]);

    try {
        const coords = this.state.currentPolygon.geometry 
            ? this.state.currentPolygon.geometry.coordinates 
            : this.state.currentPolygon.coordinates;

        const payload = {
            polygon: coords,
            sceneId: sceneId,
            polygonName: sceneId.split('/').pop(),
            satellite: scene.satellite,
            bands: scene.bands,
            startDate: scene.date,
            endDate: scene.date,
            cloudCoverMax: this.state.cloudCoverMax,
            includeDem: includeDem,
            demOnly: demOnly,
            downloadToServer: true
        };

        this.updateProgress(50);
        this.updateStatus(`Exporting ${actionText}...`);

        const authToken = sessionStorage.getItem('jit_gee_auth') || '';
        const response = await fetch(`${this.geeClient.backendUrl}/api/export-geotiff`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        this.updateProgress(100);
        setTimeout(() => this.hideProgress(), 500);

        if (result.success) {
            const folder = result.folderName || 'downloads';
            const files = result.savedFiles ? result.savedFiles.join(', ') : 'files';
            
            // Trigger automatic browser file download (Chrome download style)
            if (result.zipDownloadUrl) {
                this.triggerDirectZipDownload(result.zipDownloadUrl, result.zipFileName);
                this.updateStatus(`✅ Download started: ${result.zipFileName} [${files}]`);
            } else {
                this.updateStatus(`✅ Saved to folder "${folder}": [${files}]`);
            }
            console.log('✅ Export Details:', result);
        } else {
            throw new Error(result.error || 'Export failed on server');
        }
    } catch (e) {
        this.hideProgress();
        this.updateStatus(`❌ Export Error: ${e.message}`);
        console.error(e);
    }
  }

  triggerDirectZipDownload(zipDownloadUrl, zipFileName) {
    if (!zipDownloadUrl) return;
    const fullUrl = zipDownloadUrl.startsWith('http') ? zipDownloadUrl : `${this.geeClient.backendUrl}${zipDownloadUrl}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = zipFileName || 'satellite_aoi_bundle.zip';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async downloadMosaicBundle(date, satellite, options = {}) {
    const includeDem = options.includeDem ?? this.elements.includeDemCheckbox.checked;
    this.showProgress(`Exporting ${satellite} Complete Date Mosaic for ${date}...`, 20, [
        `📍 AOI: Lat ${this.elements.searchLat.value || ''}, Lon ${this.elements.searchLon.value || ''}`,
        `🛰️ Mosaicking all ${satellite} tiles acquired on ${date}...`,
        includeDem ? '🏔️ Querying and mosaicking NASA SRTM 30m DEM...' : '⏩ Skipping DEM',
        '💾 Saving single output composite GeoTIFF...'
    ]);

    try {
        const coords = this.state.currentPolygon.geometry 
            ? this.state.currentPolygon.geometry.coordinates 
            : this.state.currentPolygon.coordinates;

        const payload = {
            polygon: coords,
            satellite: satellite,
            startDate: date,
            endDate: date,
            cloudCoverMax: this.state.cloudCoverMax,
            includeDem: includeDem,
            downloadToServer: true
        };

        this.updateProgress(50);
        const authToken = sessionStorage.getItem('jit_gee_auth') || '';
        const response = await fetch(`${this.geeClient.backendUrl}/api/export-geotiff`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        this.updateProgress(100);
        setTimeout(() => this.hideProgress(), 500);

        if (result.success) {
            if (result.zipDownloadUrl) {
                this.triggerDirectZipDownload(result.zipDownloadUrl, result.zipFileName);
                this.updateStatus(`✅ Mosaic download started: ${result.zipFileName} [${result.savedFiles.join(', ')}]`);
            } else {
                this.updateStatus(`✅ Saved date mosaic to "${result.folderName}": [${result.savedFiles.join(', ')}]`);
            }
        } else {
            throw new Error(result.error || 'Mosaic export failed');
        }
    } catch (e) {
        this.hideProgress();
        this.updateStatus(`❌ Mosaic Export Error: ${e.message}`);
        console.error(e);
    }
  }

  async handleDownloadBest() {
    if (!this.state.targetDate || this.state.scenes.length === 0) return;

    const target = new Date(this.state.targetDate);
    const bySatellite = {
        'SENTINEL-1': this.state.scenes.filter(s => s.satellite === 'SENTINEL-1'),
        'SENTINEL-2': this.state.scenes.filter(s => s.satellite === 'SENTINEL-2')
    };

    const pickBest = (scenes, preferLowCloud) => {
        const pre = scenes.filter(s => new Date(s.date) <= target);
        const post = scenes.filter(s => new Date(s.date) > target);

        const rank = (s) => ({
            diff: Math.abs(new Date(s.date) - target),
            cloud: preferLowCloud ? s.cloudCover : 0
        });

        const pickOne = (list) => {
            if (!list.length) return null;
            return list
                .map(s => ({ s, ...rank(s) }))
                .sort((a, b) => (a.cloud - b.cloud) || (a.diff - b.diff))[0].s;
        };

        return [pickOne(pre), pickOne(post)].filter(Boolean);
    };

    const bestS1 = pickBest(bySatellite['SENTINEL-1'], false);
    const bestS2 = pickBest(bySatellite['SENTINEL-2'], true);
    const bestScenes = [...bestS1, ...bestS2];

    if (bestScenes.length === 0) {
        this.updateStatus('⚠️ No scenes available for best download.');
        return;
    }

    const includeDem = this.elements.includeDemCheckbox.checked;
    this.updateStatus(`Starting batch download for ${bestScenes.length} best scenes...`);
    
    for (let i = 0; i < bestScenes.length; i++) {
        const scene = bestScenes[i];
        this.updateStatus(`[${i+1}/${bestScenes.length}] Downloading ${scene.satellite} (${scene.date})...`);
        await this.downloadSingleScene(scene.sceneId, { includeDem });
    }
    this.updateStatus(`✅ Completed batch export of ${bestScenes.length} scenes.`);
  }

  async handleDownloadSelected() {
    const ids = Array.from(this.state.selectedScenes);
    if (ids.length === 0) return;

    const includeDem = this.elements.includeDemCheckbox.checked;
    this.updateStatus(`Starting download for ${ids.length} selected scenes...`);

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        this.updateStatus(`[${i+1}/${ids.length}] Downloading ${id.split('/').pop()}...`);
        await this.downloadSingleScene(id, { includeDem });
    }
    this.updateStatus(`✅ Completed export of ${ids.length} scenes.`);
  }

  // Utilities
  updateStatus(msg) {
    if (this.elements.statusMsg) {
        this.elements.statusMsg.textContent = msg;
    }
  }

  truncate(str, n) {
    return (str && str.length > n) ? str.substring(0, n - 1) + '...' : (str || '');
  }

  showProgress(title, percent, steps = []) {
    if (this.elements.progressOverlay) {
        this.elements.progressOverlay.style.display = 'flex';
    }
    if (this.elements.progressTitle) {
        this.elements.progressTitle.textContent = title;
    }
    if (this.elements.progressStepList) {
        this.elements.progressStepList.innerHTML = steps.map(s => `<div>${s}</div>`).join('');
    }
    this.updateProgress(percent);
  }

  updateProgress(percent) {
    if (this.elements.progressBar) {
        this.elements.progressBar.style.width = `${percent}%`;
    }
  }

  hideProgress() {
    if (this.elements.progressOverlay) {
        this.elements.progressOverlay.style.display = 'none';
    }
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const app = new SatelliteDataApp();
    app.initialize();
});
