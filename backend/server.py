#!/usr/bin/env python3
"""
Flask backend for Google Earth Engine authentication and data processing.
Uses the same authentication approach as Data_acquisition.ipynb
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import ee
import json
import urllib.request
import math
import os
from datetime import datetime, timedelta, timezone
import zipfile

app = Flask(__name__, static_folder='..', static_url_path='')
CORS(app)  # Enable CORS for frontend requests


@app.before_request
def log_api_request():
    """Log API requests to the terminal so fetch/export calls are visible."""
    if request.path.startswith('/api/'):
        payload = request.get_json(silent=True)
        if payload:
            print(f"\n📡 {request.method} {request.path} -> {payload}", flush=True)
        else:
            print(f"\n📡 {request.method} {request.path}", flush=True)


def build_ee_geometry(cleaned_coords):
    """Create an EE geometry from Polygon or MultiPolygon coordinates."""
    if not cleaned_coords:
        raise ValueError('Empty coordinates for geometry')

    # MultiPolygon shape: [ [ [ [lon, lat], ... ] ], ... ]
    if (
        isinstance(cleaned_coords, (list, tuple))
        and len(cleaned_coords) > 0
        and isinstance(cleaned_coords[0], (list, tuple))
        and len(cleaned_coords[0]) > 0
        and isinstance(cleaned_coords[0][0], (list, tuple))
        and len(cleaned_coords[0][0]) > 0
        and isinstance(cleaned_coords[0][0][0], (list, tuple))
    ):
        return ee.Geometry.MultiPolygon(cleaned_coords)

    return ee.Geometry.Polygon(cleaned_coords)


def close_linear_rings(coords):
    """Ensure polygon rings are closed (first point == last point)."""
    if not coords:
        return coords

    def close_ring(ring):
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])

    # MultiPolygon: [[[[]]]]
    if (
        isinstance(coords, (list, tuple))
        and len(coords) > 0
        and isinstance(coords[0], (list, tuple))
        and len(coords[0]) > 0
        and isinstance(coords[0][0], (list, tuple))
        and len(coords[0][0]) > 0
        and isinstance(coords[0][0][0], (list, tuple))
    ):
        for polygon in coords:
            for ring in polygon:
                close_ring(ring)
        return coords

    # Polygon: [[[]]]
    for ring in coords:
        close_ring(ring)
    return coords

# Hardcoded Access Passcode and Session Token
HARDCODED_PASSCODE = "soumyadipta@1234"
AUTH_TOKEN = "soumyadipta_gee_authorized_session_token_2026"

# Initialize Earth Engine with Service Account or Fallback
EE_PROJECT = 'mining-detection'
AUTH_TYPE = 'user'

def init_earth_engine():
    """Look for service account JSON file in backend or environment."""
    global EE_PROJECT, AUTH_TYPE
    
    # 1. Check raw JSON string in environment variable (Render / Cloud deployment)
    raw_env_json = os.environ.get('GEE_SERVICE_ACCOUNT_JSON') or os.environ.get('GOOGLE_CREDENTIALS_JSON')
    if raw_env_json:
        try:
            sa_data = json.loads(raw_env_json)
            client_email = sa_data['client_email']
            EE_PROJECT = sa_data.get('project_id', 'mining-detection')
            credentials = ee.ServiceAccountCredentials(client_email, key_data=raw_env_json)
            ee.Initialize(credentials=credentials, project=EE_PROJECT)
            AUTH_TYPE = f"service_account ({client_email})"
            print(f"✅ Earth Engine initialized from ENV VAR with Service Account: {client_email}")
            return
        except Exception as e:
            print(f"⚠️ Failed to initialize GEE from environment variable: {e}")

    # 2. Check filepath in environment
    if os.environ.get('GOOGLE_APPLICATION_CREDENTIALS') and os.path.exists(os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')):
        sa_file = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        with open(sa_file, 'r') as f:
            sa_data = json.load(f)
        client_email = sa_data['client_email']
        EE_PROJECT = sa_data.get('project_id', 'mining-detection')
        credentials = ee.ServiceAccountCredentials(client_email, sa_file)
        ee.Initialize(credentials=credentials, project=EE_PROJECT)
        AUTH_TYPE = f"service_account ({client_email})"
        print(f"✅ Earth Engine initialized with Service Account from GOOGLE_APPLICATION_CREDENTIALS: {client_email}")
        return

    # 3. Check local JSON files in workspace
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    for root_path in [backend_dir, os.path.abspath(os.path.join(backend_dir, '..'))]:
        if not os.path.exists(root_path):
            continue
        for fname in os.listdir(root_path):
            if fname.endswith('.json') and not fname.startswith('package'):
                fpath = os.path.join(root_path, fname)
                try:
                    with open(fpath, 'r') as f:
                        data = json.load(f)
                    if data.get('type') == 'service_account' and 'client_email' in data:
                        client_email = data['client_email']
                        EE_PROJECT = data.get('project_id', 'mining-detection')
                        credentials = ee.ServiceAccountCredentials(client_email, fpath)
                        ee.Initialize(credentials=credentials, project=EE_PROJECT)
                        AUTH_TYPE = f"service_account ({client_email})"
                        print(f"✅ Earth Engine initialized successfully with Service Account: {client_email}")
                        print(f"✅ Earth Engine project: {EE_PROJECT}")
                        return
                except Exception:
                    continue

    # Fallback to default credentials / user oauth
    ee.Initialize(project=EE_PROJECT)
    AUTH_TYPE = "user_oauth"
    print(f"✅ Earth Engine initialized with project: {EE_PROJECT}")

try:
    init_earth_engine()
except Exception as e:
    print(f"⚠️ Earth Engine initialization failed: {e}")
    try:
        ee.Authenticate()
        ee.Initialize(project=EE_PROJECT)
        AUTH_TYPE = "user_oauth"
    except Exception as inner_e:
        print(f"❌ Authentication failed: {inner_e}")


def check_auth(req):
    """Verify authorization token or header."""
    auth_header = req.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip() if auth_header.startswith('Bearer ') else req.headers.get('X-Auth-Token')
    if token == AUTH_TOKEN or req.args.get('token') == AUTH_TOKEN:
        return True
    return False


@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('..', 'index.html')


@app.route('/robots.txt')
def robots():
    """Serve robots.txt for Google Search crawlers"""
    return send_from_directory('..', 'robots.txt')


@app.route('/sitemap.xml')
def sitemap():
    """Serve sitemap.xml for SEO indexing"""
    return send_from_directory('..', 'sitemap.xml')


@app.before_request
def enforce_security_auth():
    """Strictly protect all /api/ endpoints to prevent unauthenticated access."""
    # Allow public access only to web interface, static assets, verification, and health status
    public_endpoints = ['/api/auth/verify', '/api/health']
    if request.path.startswith('/api/') and request.path not in public_endpoints:
        if not check_auth(request):
            return jsonify({
                'error': 'Unauthorized: Valid security access key required.',
                'authenticated': False
            }), 401


@app.route('/api/download-file/<path:file_path>')
def download_file(file_path):
    """Serve a single GeoTIFF file directly for browser download."""
    try:
        downloads_base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'downloads'))
        target_file = os.path.abspath(os.path.join(downloads_base, file_path))
        
        # Path traversal security check
        if not target_file.startswith(downloads_base):
            return jsonify({'error': 'Unauthorized path access'}), 403
            
        if not os.path.exists(target_file) or not os.path.isfile(target_file):
            return jsonify({'error': 'Requested file not found'}), 404
            
        filename = os.path.basename(target_file)
        return send_from_directory(os.path.dirname(target_file), filename, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download-zip/<path:folder_name>')
def download_zip(folder_name):
    """Serve the zipped AOI export archive for direct browser download."""
    try:
        downloads_base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'downloads'))
        zip_filename = f"{folder_name}.zip" if not folder_name.endswith('.zip') else folder_name
        clean_folder = folder_name[:-4] if folder_name.endswith('.zip') else folder_name
        zip_filepath = os.path.join(downloads_base, zip_filename)
        
        if not os.path.exists(zip_filepath):
            target_dir = os.path.join(downloads_base, clean_folder)
            if os.path.exists(target_dir):
                with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    for root, dirs, files in os.walk(target_dir):
                        for f in files:
                            fpath = os.path.join(root, f)
                            arcname = os.path.relpath(fpath, target_dir)
                            zipf.write(fpath, arcname)
            else:
                return jsonify({'error': 'Archive not found'}), 404
        
        return send_from_directory(downloads_base, zip_filename, as_attachment=True, download_name=zip_filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('..', path)


@app.route('/api/auth/verify', methods=['POST'])
def verify_passcode():
    """Verify access passcode."""
    data = request.json or {}
    passcode = data.get('passcode', '').strip()
    if passcode == HARDCODED_PASSCODE:
        return jsonify({
            'success': True,
            'token': AUTH_TOKEN,
            'message': 'Passcode verified successfully. Welcome to the portal.'
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Incorrect passcode. Please enter the valid access code.'
        }), 401


@app.route('/api/health', methods=['GET'])
def health_check():
    """Check if Earth Engine is initialized"""
    try:
        ee.Number(1).getInfo()
        return jsonify({
            'status': 'ok',
            'authenticated': True,
            'project': EE_PROJECT,
            'auth_type': AUTH_TYPE
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'authenticated': False,
            'error': str(e)
        }), 500


@app.route('/api/debug-geometry', methods=['POST'])
def debug_geometry():
    """Debug geometry parsing and raw collection counts for S1/S2."""
    try:
        data = request.json
        polygon_coords = data.get('polygon')
        target_date_str = data.get('targetDate')

        if not polygon_coords or not target_date_str:
            return jsonify({'error': 'Missing required parameters'}), 400

        from datetime import datetime, timedelta
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d')
        start_date = (target_date - timedelta(days=15)).strftime('%Y-%m-%d')
        end_date = (target_date + timedelta(days=15)).strftime('%Y-%m-%d')

        # Clean coordinates - remove altitude (Z) values
        def clean_coords(coords):
            if not coords:
                return coords
            if isinstance(coords[0], (list, tuple)):
                if len(coords[0]) > 0 and isinstance(coords[0][0], (list, tuple)):
                    return [[[x, y] for x, y, *_ in ring] for ring in coords]
                else:
                    return [[x, y] for x, y, *_ in coords]
            return coords

        cleaned_coords = clean_coords(polygon_coords)
        cleaned_coords = close_linear_rings(cleaned_coords)
        ee_polygon = build_ee_geometry(cleaned_coords)

        response = {
            'geometryType': ee_polygon.type().getInfo(),
            'dateRange': {'start': start_date, 'end': end_date},
            's1RawCount': ee.ImageCollection('COPERNICUS/S1_GRD')
                .filterBounds(ee_polygon)
                .filterDate(start_date, end_date)
                .size()
                .getInfo(),
            's2RawCount': ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                .filterBounds(ee_polygon)
                .filterDate(start_date, end_date)
                .size()
                .getInfo()
        }

        return jsonify(response)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500


@app.route('/api/routes', methods=['GET'])
def list_routes():
    """List registered routes for debugging."""
    routes = []
    for rule in app.url_map.iter_rules():
        methods = sorted([m for m in rule.methods if m not in {'HEAD', 'OPTIONS'}])
        routes.append({'rule': str(rule), 'methods': methods})
    return jsonify({'routes': routes})

@app.route('/api/fetch-imagery', methods=['POST'])
def fetch_imagery():
    """
    Fetch satellite imagery for a polygon with user-specified buffer (1-500 days)
    and automatic cloud filtering.
    """
    try:
        data = request.json or {}
        print(f"📥 Received fetch request: {data}", flush=True)
        
        # Extract parameters
        polygon_coords = data.get('polygon')
        target_date_str = data.get('targetDate')
        cloud_cover_max = float(data.get('cloudCoverMax', 20.0))
        buffer_days = int(data.get('bufferDays', 30))
        buffer_days = max(1, min(500, buffer_days)) # Clamp between 1 and 500 days
        
        # Validate inputs
        if not polygon_coords or not target_date_str:
            return jsonify({'error': 'Missing required parameters (polygon or targetDate)'}), 400
        
        target_date = datetime.strptime(target_date_str, '%Y-%m-%d')
        
        # Clean coordinates
        def clean_coords(coords):
            if not coords:
                return coords
            if isinstance(coords[0], (list, tuple)):
                if len(coords[0]) > 0 and isinstance(coords[0][0], (list, tuple)):
                    return [[[x, y] for x, y, *_ in ring] for ring in coords]
                else:
                    return [[x, y] for x, y, *_ in coords]
            return coords
        
        cleaned_coords = clean_coords(polygon_coords)
        cleaned_coords = close_linear_rings(cleaned_coords)
        ee_polygon = build_ee_geometry(cleaned_coords)
        
        # Calculate date window based on user buffer
        start_date = (target_date - timedelta(days=buffer_days)).strftime('%Y-%m-%d')
        end_date = (target_date + timedelta(days=buffer_days)).strftime('%Y-%m-%d')
        
        results = {
            'success': True,
            'targetDate': target_date_str,
            'cloudCoverMax': cloud_cover_max,
            'dateBuffer': {
                'start': start_date,
                'end': end_date,
                'bufferDays': buffer_days
            },
            'satellites': []
        }
        
        # 1. Search Sentinel-2 (Optical) with user buffer or auto-expansion
        print(f"\n🛰️ [1/2] Searching for SENTINEL-2 (±{buffer_days} days, Max Cloud: {cloud_cover_max}%)...", flush=True)
        s2_result = search_satellite_imagery(
            ee_polygon, 
            'SENTINEL-2', 
            start_date, 
            end_date, 
            target_date_str,
            cloud_cover_max,
            buffer_days
        )
        effective_buffer = s2_result.get('bufferDaysUsed', buffer_days) if s2_result.get('found') else buffer_days
        
        # 2. Search Sentinel-1 (SAR) with matching consistent buffer
        s1_start = (target_date - timedelta(days=effective_buffer)).strftime('%Y-%m-%d')
        s1_end = (target_date + timedelta(days=effective_buffer)).strftime('%Y-%m-%d')
        print(f"\n🛰️ [2/2] Searching for SENTINEL-1 (±{effective_buffer} days - consistent with S2)...", flush=True)
        s1_result = search_satellite_imagery(
            ee_polygon, 
            'SENTINEL-1', 
            s1_start, 
            s1_end, 
            target_date_str,
            cloud_cover_max,
            effective_buffer
        )
        
        if s1_result.get('found'):
            print(f"✅ SENTINEL-1 found: {s1_result['imageCount']} images (Buffer: ±{effective_buffer} days)", flush=True)
            results['satellites'].append(s1_result)
        
        if s2_result.get('found'):
            print(f"✅ SENTINEL-2 found: {s2_result['imageCount']} images (Buffer: ±{effective_buffer} days)", flush=True)
            results['satellites'].append(s2_result)
        
        if len(results['satellites']) == 0:
            return jsonify({
                'error': f'No satellite imagery found within ±{effective_buffer} days for the given area.',
                'targetDate': target_date_str,
                'cloudCoverMax': cloud_cover_max,
                'bufferDays': effective_buffer,
                'suggestion': 'Try increasing the Search Buffer (e.g. ±60 or ±180 days) or increasing Max Cloud Cover.'
            }), 404
        
        print(f"\n✅ Finished search: found {len(results['satellites'])} satellite type(s) spanning ±{effective_buffer} days", flush=True)
        return jsonify(results)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500


@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return e
    import traceback
    traceback.print_exc()
    return jsonify({
        "error": str(e),
        "type": type(e).__name__,
        "message": "Internal Server Error"
    }), 500


def search_satellite_imagery(ee_polygon, satellite, start_date, end_date, target_date_str, cloud_cover_max, buffer_days=30):
    """
    Search satellite imagery with configurable buffer (1-500 days) and cloud filtering.
    """
    try:
        from datetime import datetime, timezone, timedelta
        target_dt = datetime.strptime(target_date_str, '%Y-%m-%d')
        
        if satellite == 'SENTINEL-2':
            collection_id = 'COPERNICUS/S2_SR_HARMONIZED'
            bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
            rgb_bands = ['B4', 'B3', 'B2']
            vis_params = {'min': 0, 'max': 3000}
            
            # Query base collection in user-specified buffer
            base_col = (ee.ImageCollection(collection_id)
                        .filterBounds(ee_polygon)
                        .filterDate(start_date, end_date))
            
            raw_cnt = base_col.size().getInfo()
            print(f"   📊 S2 total available scenes in ±{buffer_days} days: {raw_cnt}", flush=True)
            
            buffer_used = buffer_days
            
            # Apply cloud filter
            cloud_filtered = base_col.filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloud_cover_max))
            cnt = cloud_filtered.size().getInfo()
            print(f"   ☁️ S2 scenes with cloud <= {cloud_cover_max}%: {cnt}", flush=True)
            
            if cnt > 0:
                collection = cloud_filtered
            else:
                # If user buffer is small (< 180 days), try progressive expansion up to 500 days
                matched_col = None
                if buffer_days < 180:
                    for b_days in [60, 120, 180, 300, 500]:
                        if b_days <= buffer_days:
                            continue
                        w_start = (target_dt - timedelta(days=b_days)).strftime('%Y-%m-%d')
                        w_end = (target_dt + timedelta(days=b_days)).strftime('%Y-%m-%d')
                        query = (ee.ImageCollection(collection_id)
                                 .filterBounds(ee_polygon)
                                 .filterDate(w_start, w_end)
                                 .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloud_cover_max)))
                        exp_cnt = query.size().getInfo()
                        if exp_cnt > 0:
                            matched_col = query
                            buffer_used = b_days
                            start_date = w_start
                            end_date = w_end
                            print(f"   🔍 Expanded buffer to ±{b_days} days to find {exp_cnt} clear scenes", flush=True)
                            break
                
                if matched_col is not None:
                    collection = matched_col
                else:
                    # Fallback to clearest available scenes in user window
                    print(f"   ⚠️ No scenes with <= {cloud_cover_max}% cloud. Returning clearest available scenes in ±{buffer_days} days...", flush=True)
                    collection = base_col.sort('CLOUDY_PIXEL_PERCENTAGE')
            
            image_count = collection.size().getInfo()
            if image_count == 0:
                return {'found': False, 'satellite': satellite, 'imageCount': 0}
            
        elif satellite == 'SENTINEL-1':
            collection_id = 'COPERNICUS/S1_GRD'
            bands = ['VV']
            rgb_bands = None
            vis_params = {'min': -25, 'max': 0}
            buffer_used = buffer_days
            
            collection = (ee.ImageCollection(collection_id)
                          .filterDate(start_date, end_date)
                          .filterBounds(ee_polygon)
                          .filter(ee.Filter.eq('instrumentMode', 'IW')))
            
            image_count = collection.size().getInfo()
            if image_count == 0:
                # Expand S1 window up to 180 days
                for b_days in [60, 120, 180, 365]:
                    if b_days <= buffer_days:
                        continue
                    w_start = (target_dt - timedelta(days=b_days)).strftime('%Y-%m-%d')
                    w_end = (target_dt + timedelta(days=b_days)).strftime('%Y-%m-%d')
                    exp_col = (ee.ImageCollection(collection_id)
                               .filterDate(w_start, w_end)
                               .filterBounds(ee_polygon)
                               .filter(ee.Filter.eq('instrumentMode', 'IW')))
                    if exp_col.size().getInfo() > 0:
                        collection = exp_col
                        buffer_used = b_days
                        start_date = w_start
                        end_date = w_end
                        break
                image_count = collection.size().getInfo()
            
            if image_count == 0:
                return {'found': False, 'satellite': satellite, 'imageCount': 0}
        else:
            return {'found': False, 'satellite': satellite, 'error': 'Unsupported satellite'}

        # Attach footprint geometry and AOI coverage calculation
        try:
            aoi_area = ee_polygon.area(maxError=20)
            def attach_footprint_meta(img):
                fp = img.geometry()
                inter = fp.intersection(ee_polygon, maxError=20)
                cov = inter.area(maxError=20).divide(aoi_area).multiply(100)
                simp_fp = fp.simplify(maxError=100)
                return img.set({
                    'footprint_coords': simp_fp.coordinates(),
                    'footprint_type': simp_fp.type(),
                    'aoi_coverage_pct': cov
                })
            collection_mapped = collection.map(attach_footprint_meta)
        except Exception:
            collection_mapped = collection

        # Fetch scene metadata
        scenes = []
        image_list = collection_mapped.limit(50).toList(50).getInfo()
        
        for img_info in image_list:
            properties = img_info.get('properties', {})
            scene_id = img_info.get('id', 'Unknown')
            
            if 'system:time_start' in properties:
                timestamp_ms = properties['system:time_start']
                # Use UTC timezone to match Earth Engine date boundaries
                scene_dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
                date_str = scene_dt.strftime('%Y-%m-%d')
                days_diff = (scene_dt.replace(tzinfo=None) - target_dt).days
            else:
                date_str = 'Unknown'
                days_diff = 0
            
            if satellite == 'SENTINEL-2':
                cloud_cover = round(float(properties.get('CLOUDY_PIXEL_PERCENTAGE', 0)), 2)
                tile_id = properties.get('MGRS_TILE') or (scene_id.split('_')[-1] if '_' in scene_id else 'Tile')
            else:
                cloud_cover = 0.0
                tile_id = f"Orbit {properties.get('relativeOrbitNumber_start', 'IW')}"
            
            orbit = properties.get('SENSING_ORBIT_NUMBER', properties.get('relativeOrbitNumber_start', 'Unknown'))
            
            # AOI coverage percentage
            raw_coverage = properties.get('aoi_coverage_pct', 100.0)
            try:
                cov_val = round(float(raw_coverage), 1) if raw_coverage is not None else 100.0
                coverage_pct = min(100.0, max(0.0, cov_val))
            except Exception:
                coverage_pct = 100.0
            
            # Footprint GeoJSON
            footprint_coords = properties.get('footprint_coords')
            footprint_type = properties.get('footprint_type', 'Polygon')
            footprint_geojson = None
            if footprint_coords:
                footprint_geojson = {
                    'type': footprint_type,
                    'coordinates': footprint_coords
                }

            scenes.append({
                'date': date_str,
                'cloudCover': cloud_cover,
                'orbit': orbit,
                'tileId': tile_id,
                'sceneId': scene_id,
                'collection': collection_id,
                'daysFromTarget': days_diff,
                'aoiCoveragePct': coverage_pct,
                'footprint': footprint_geojson,
                'isUnderThreshold': bool(cloud_cover <= cloud_cover_max) if satellite == 'SENTINEL-2' else True
            })
        
        # Sort scenes: closest to target date first, then by lowest cloud cover
        scenes.sort(key=lambda s: (abs(s['daysFromTarget']), s['cloudCover']))
        
        # Pre and Post breakdown
        pre_scenes = [s for s in scenes if s['daysFromTarget'] <= 0]
        post_scenes = [s for s in scenes if s['daysFromTarget'] > 0]
        
        return {
            'found': True,
            'satellite': satellite,
            'imageCount': len(scenes),
            'bands': bands,
            'cloudCoverMax': cloud_cover_max,
            'bufferDaysUsed': buffer_used,
            'dateRange': {
                'start': start_date,
                'end': end_date
            },
            'scenes': scenes,
            'preCount': len(pre_scenes),
            'postCount': len(post_scenes)
        }
        
    except Exception as e:
        print(f"   ❌ Error searching {satellite}: {e}", flush=True)
        import traceback
        traceback.print_exc()
        return {'found': False, 'satellite': satellite, 'error': str(e)}


@app.route('/api/export-geotiff', methods=['POST'])
def export_geotiff():
    """
    Export imagery and/or SRTM 30m DEM as GeoTIFF into an organized folder:
    downloads/lat_{lat}_lon_{lon}_date_{date}_{satellite}/
    """
    try:
        data = request.json or {}
        
        # Extract parameters
        polygon_coords = data.get('polygon')
        scene_id = data.get('sceneId')
        polygon_name = data.get('polygonName', 'polygon')
        satellite = data.get('satellite', 'SENTINEL-2')
        start_date = data.get('startDate')
        end_date = data.get('endDate') or start_date
        cloud_cover_max = float(data.get('cloudCoverMax', 100))
        requested_bands = data.get('bands')
        include_dem = bool(data.get('includeDem', False))
        dem_only = bool(data.get('demOnly', False))
        download_to_server = bool(data.get('downloadToServer', True))
        
        if not polygon_coords:
            return jsonify({'error': 'Missing polygon coordinates'}), 400
        
        # Clean coordinates
        def clean_coords(coords):
            if not coords:
                return coords
            if isinstance(coords[0], (list, tuple)):
                if len(coords[0]) > 0 and isinstance(coords[0][0], (list, tuple)):
                    return [[[x, y] for x, y, *_ in ring] for ring in coords]
                else:
                    return [[x, y] for x, y, *_ in coords]
            return coords
        
        cleaned_coords = clean_coords(polygon_coords)
        cleaned_coords = close_linear_rings(cleaned_coords)
        ee_polygon = build_ee_geometry(cleaned_coords)
        bounds = ee_polygon.bounds().getInfo()['coordinates']
        
        # Calculate AOI Centroid (Lat, Lon up to 5 decimals)
        centroid_coords = ee_polygon.centroid().coordinates().getInfo()
        center_lon = round(float(centroid_coords[0]), 5)
        center_lat = round(float(centroid_coords[1]), 5)
        
        scene_date_str = start_date or datetime.now().strftime('%Y-%m-%d')
        safe_sat = satellite.replace(' ', '_')
        
        # Dedicated Folder Naming: lat_{lat}_lon_{lon}_date_{date}_{satellite}
        folder_name = f"lat_{center_lat:.5f}_lon_{center_lon:.5f}_date_{scene_date_str}_{safe_sat}"
        downloads_base = os.path.join(os.path.dirname(__file__), '..', 'downloads')
        target_dir = os.path.join(downloads_base, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        print(f"\n📥 Export Request -> Folder: {folder_name}", flush=True)
        print(f"   📍 Centroid: Lat {center_lat}, Lon {center_lon}", flush=True)
        print(f"   🛰️ Satellite: {satellite} (DEM Requested: {include_dem or dem_only})", flush=True)
        
        max_pixels = 5e7
        base_scale = 10
        try:
            bounds_area_m2 = ee_polygon.bounds().area(maxError=1).getInfo()
            auto_scale = math.sqrt(bounds_area_m2 / max_pixels)
            scale = max(base_scale, math.ceil(auto_scale))
        except Exception:
            scale = base_scale
        
        image_download_url = None
        saved_image_filename = None
        
        # 1. Satellite Imagery Export (unless DEM Only)
        if not dem_only:
            # Direct scene load if sceneId provided
            if scene_id and (scene_id.startswith('COPERNICUS/') or '/' in scene_id):
                print(f"   🎯 Loading direct Earth Engine Image: {scene_id}", flush=True)
                image = ee.Image(scene_id)
            elif polygon_name and (polygon_name.startswith('COPERNICUS/') or 'T' in polygon_name):
                # Try loading by ID if polygonName is scene ID
                full_id = polygon_name if polygon_name.startswith('COPERNICUS/') else f"{('COPERNICUS/S2_SR_HARMONIZED' if satellite == 'SENTINEL-2' else 'COPERNICUS/S1_GRD')}/{polygon_name}"
                try:
                    image = ee.Image(full_id)
                    print(f"   🎯 Loaded via composed ID: {full_id}", flush=True)
                except Exception:
                    image = None
            else:
                image = None
            
            if image is None:
                # Query collection with safety buffer
                col_id = 'COPERNICUS/S2_SR_HARMONIZED' if satellite == 'SENTINEL-2' else 'COPERNICUS/S1_GRD'
                dt_start = datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=1)
                dt_end = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                col = (ee.ImageCollection(col_id)
                       .filterBounds(ee_polygon)
                       .filterDate(dt_start.strftime('%Y-%m-%d'), dt_end.strftime('%Y-%m-%d')))
                if col.size().getInfo() == 0:
                    return jsonify({'error': f'No {satellite} imagery found for {start_date}'}), 404
                image = col.median()
            
            # Select bands
            avail_bands = image.bandNames().getInfo()
            if satellite == 'SENTINEL-2':
                target_bands = requested_bands if requested_bands else ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
            else:
                target_bands = requested_bands if requested_bands else ['VV']
            valid_bands = [b for b in target_bands if b in avail_bands] or avail_bands[:6]
            
            clipped_image = image.select(valid_bands).clip(ee_polygon)
            
            # Generate GeoTIFF download URL
            current_scale = scale
            for attempt in range(5):
                try:
                    image_download_url = clipped_image.getDownloadURL({
                        'region': bounds,
                        'scale': current_scale,
                        'crs': 'EPSG:4326',
                        'format': 'GEO_TIFF',
                        'maxPixels': max_pixels
                    })
                    break
                except Exception as err:
                    if 'Total request size' in str(err) or 'must be less than or equal to' in str(err):
                        current_scale *= 2
                        continue
                    raise
            
            # Save Satellite Imagery GeoTIFF
            saved_image_filename = f"{safe_sat}_{scene_date_str}_lat_{center_lat:.5f}_lon_{center_lon:.5f}.tif"
            img_save_path = os.path.join(target_dir, saved_image_filename)
            if download_to_server:
                print(f"📥 Saving satellite GeoTIFF to: {img_save_path}", flush=True)
                urllib.request.urlretrieve(image_download_url, img_save_path)
                print(f"✅ Saved satellite GeoTIFF: {saved_image_filename}", flush=True)
        
        # 2. High Resolution 30m DEM Export (if requested)
        dem_download_url = None
        saved_dem_filename = None
        dem_dataset_name = "USGS/SRTMGL1_003 (NASA SRTM 30m Global Elevation)"
        if include_dem or dem_only:
            print(f"🏔️ Querying and mosaicking highest-resolution 30m DEM for AOI...", flush=True)
            try:
                dem_col = ee.ImageCollection('COPERNICUS/DEM/GLO30').select('DEM').filterBounds(ee_polygon)
                if dem_col.size().getInfo() > 0:
                    dem_image = dem_col.mosaic().clip(ee_polygon)
                    dem_dataset_name = "COPERNICUS/DEM/GLO30 (Copernicus 30m Global Elevation - Highest Precision)"
                    print("   ✅ Loaded Copernicus DEM GLO-30", flush=True)
                else:
                    dem_image = ee.Image('USGS/SRTMGL1_003').select('elevation').clip(ee_polygon)
                    print("   ✅ Loaded NASA SRTM 30m DEM", flush=True)
            except Exception:
                dem_image = ee.Image('USGS/SRTMGL1_003').select('elevation').clip(ee_polygon)
            
            dem_scale = 30
            dem_download_url = dem_image.getDownloadURL({
                'region': bounds,
                'scale': dem_scale,
                'crs': 'EPSG:4326',
                'format': 'GEO_TIFF',
                'maxPixels': max_pixels
            })
            
            saved_dem_filename = f"DEM_30m_lat_{center_lat:.5f}_lon_{center_lon:.5f}.tif"
            dem_save_path = os.path.join(target_dir, saved_dem_filename)
            if download_to_server:
                print(f"📥 Saving 30m DEM GeoTIFF to: {dem_save_path}", flush=True)
                urllib.request.urlretrieve(dem_download_url, dem_save_path)
                print(f"✅ Saved DEM GeoTIFF: {saved_dem_filename}", flush=True)
        
        # 3. Save Metadata JSON file in the folder
        metadata_dict = {
            'aoi': {
                'centroid': {'latitude': center_lat, 'longitude': center_lon},
                'bounds': bounds
            },
            'acquisitionDate': scene_date_str,
            'satellite': satellite,
            'sceneId': scene_id or polygon_name,
            'cloudCoverMax': cloud_cover_max,
            'resolutions': {
                'imagery_pixel_size': f"{scale}m (Native Best)",
                'dem_pixel_size': "30m (Native Global Highest)"
            },
            'demIncluded': bool(include_dem or dem_only),
            'demDataset': dem_dataset_name,
            'files': {
                'imagery': saved_image_filename,
                'dem': saved_dem_filename
            },
            'exportedAt': datetime.now(timezone.utc).isoformat()
        }
        meta_file_path = os.path.join(target_dir, 'metadata.json')
        with open(meta_file_path, 'w') as mf:
            json.dump(metadata_dict, mf, indent=2)
        
        # 4. Create Downloadable ZIP Archive for direct browser saving
        zip_filename = f"{folder_name}.zip"
        zip_filepath = os.path.join(downloads_base, zip_filename)
        try:
            with zipfile.ZipFile(zip_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(target_dir):
                    for f in files:
                        fpath = os.path.join(root, f)
                        arcname = os.path.relpath(fpath, target_dir)
                        zipf.write(fpath, arcname)
            print(f"📦 Created ZIP Archive: {zip_filename}", flush=True)
        except Exception as ze:
            print(f"⚠️ Error creating zip archive: {ze}", flush=True)
        
        # Determine smart download type: single .tif vs complete .zip
        download_type = "zip"
        direct_file_url = None
        direct_file_name = None
        
        if dem_only and saved_dem_filename:
            download_type = "file"
            direct_file_url = f"/api/download-file/{folder_name}/{saved_dem_filename}?token={AUTH_TOKEN}"
            direct_file_name = saved_dem_filename
        elif not include_dem and saved_image_filename:
            download_type = "file"
            direct_file_url = f"/api/download-file/{folder_name}/{saved_image_filename}?token={AUTH_TOKEN}"
            direct_file_name = saved_image_filename
        
        return jsonify({
            'success': True,
            'folderName': folder_name,
            'folderPath': target_dir,
            'savedImageFile': saved_image_filename,
            'savedDemFile': saved_dem_filename,
            'imageDownloadUrl': image_download_url,
            'demDownloadUrl': dem_download_url,
            'downloadType': download_type,
            'directFileDownloadUrl': direct_file_url,
            'directFileName': direct_file_name,
            'zipDownloadUrl': f"/api/download-zip/{folder_name}?token={AUTH_TOKEN}",
            'zipFileName': zip_filename,
            'savedFiles': [f for f in [saved_image_filename, saved_dem_filename, 'metadata.json'] if f],
            'scale': scale,
            'message': f'Saved files into {folder_name}'
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500

@app.route('/api/batch-export', methods=['POST'])
def batch_export():
    """
    Export multiple polygons in batch
    
    Request body:
    {
        "polygons": [
            {
                "name": "Area 1",
                "coordinates": [[lon, lat], ...]
            },
            ...
        ],
        "satellite": "SENTINEL-2",
        "startDate": "2023-01-01",
        "endDate": "2023-12-31",
        "year": 2023
    }
    """
    try:
        data = request.json
        polygons = data.get('polygons', [])
        satellite = data.get('satellite', 'SENTINEL-2')
        start_date = data.get('startDate')
        end_date = data.get('endDate')
        year = data.get('year', datetime.now().year)
        
        results = {
            'successful': [],
            'failed': []
        }
        
        for poly_data in polygons:
            try:
                # Export each polygon
                export_data = {
                    'polygon': poly_data['coordinates'],
                    'polygonName': poly_data['name'],
                    'satellite': satellite,
                    'startDate': start_date,
                    'endDate': end_date,
                    'year': year
                }
                
                # Call export function
                result = export_geotiff_internal(export_data)
                results['successful'].append({
                    'name': poly_data['name'],
                    'taskId': result['taskId']
                })
                
            except Exception as e:
                results['failed'].append({
                    'name': poly_data['name'],
                    'error': str(e)
                })
        
        return jsonify(results)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'type': type(e).__name__
        }), 500

def export_geotiff_internal(data):
    """Internal function for exporting GeoTIFF"""
    polygon_coords = data['polygon']
    polygon_name = data['polygonName']
    satellite = data['satellite']
    start_date = data['startDate']
    end_date = data['endDate']
    year = data['year']
    requested_bands = data.get('bands')
    
    # Clean coordinates - remove altitude (Z) values
    def clean_coords(coords):
        """Remove Z values (altitude) from coordinate tuples"""
        if not coords:
            return coords
        if isinstance(coords[0], (list, tuple)):
            if len(coords[0]) > 0 and isinstance(coords[0][0], (list, tuple)):
                # It's a polygon with rings: [[[lon, lat, alt], ...]]
                return [[[x, y] for x, y, *_ in ring] for ring in coords]
            else:
                # It's a simple ring: [[lon, lat, alt], ...]
                return [[x, y] for x, y, *_ in coords]
        return coords
    
    cleaned_coords = clean_coords(polygon_coords)
    cleaned_coords = close_linear_rings(cleaned_coords)
    ee_polygon = build_ee_geometry(cleaned_coords)
    
    if satellite == 'SENTINEL-2':
        collection_id = 'COPERNICUS/S2_SR_HARMONIZED'
        bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']
    else:
        collection_id = 'COPERNICUS/S1_GRD'
        bands = requested_bands if isinstance(requested_bands, list) and requested_bands else ['VV']
    
    if start_date == end_date:
        from datetime import datetime, timedelta
        dt = datetime.strptime(end_date, '%Y-%m-%d')
        end_date = (dt + timedelta(days=1)).strftime('%Y-%m-%d')

    collection = (ee.ImageCollection(collection_id)
                 .filterBounds(ee_polygon)
                 .filterDate(start_date, end_date))
    
    if satellite == 'SENTINEL-2':
        collection = collection.filter(
            ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)
        )
    
    image = collection.select(bands).median().clip(ee_polygon)
    
    safe_name = polygon_name.replace(' ', '_').replace('/', '_')
    filename = f"{safe_name}_{satellite}_{year}"
    
    task = ee.batch.Export.image.toDrive(
        image=image.toFloat(),
        description=filename,
        folder='MINE_SIH2025_GEE_Data',
        fileNamePrefix=filename,
        region=ee_polygon.bounds().getInfo()['coordinates'],
        scale=10,
        crs='EPSG:4326',
        maxPixels=1e13,
        fileFormat='GeoTIFF'
    )
    
    task.start()
    
    return {
        'taskId': task.id,
        'filename': filename
    }

if __name__ == '__main__':
    port = int(os.environ.get('PORT', os.environ.get('GEE_BACKEND_PORT', '5002')))
    print("\n" + "="*60)
    print("🛰️  Satellite Data Acquisition Backend")
    print("="*60)
    print(f"\n✅ Server starting on http://0.0.0.0:{port}")
    print(f"✅ Earth Engine project: {EE_PROJECT}")
    print("\n📝 API Endpoints:")
    print("   POST /api/auth/verify     - Verify access passcode")
    print("   GET  /api/health          - Check authentication status")
    print("   POST /api/debug-geometry  - Debug geometry and raw counts")
    print("   POST /api/fetch-imagery   - Fetch satellite imagery")
    print("   POST /api/export-geotiff  - Export single polygon")
    print("   POST /api/batch-export    - Export multiple polygons")
    print("\n" + "="*60 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
