#!/usr/bin/env python3
"""
Direct Earth Engine test to verify authentication and data availability
"""

import ee

import os
import json

print("🔍 Testing Earth Engine directly...")
print("")

# Initialize
try:
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    sa_file = None
    for fname in os.listdir(backend_dir):
        if fname.endswith('.json') and not fname.startswith('package'):
            fpath = os.path.join(backend_dir, fname)
            try:
                with open(fpath, 'r') as f:
                    data = json.load(f)
                if data.get('type') == 'service_account' and 'client_email' in data:
                    sa_file = fpath
                    break
            except Exception:
                continue
    
    if sa_file:
        with open(sa_file, 'r') as f:
            sa_data = json.load(f)
        client_email = sa_data['client_email']
        project_id = sa_data.get('project_id', 'mining-detection')
        credentials = ee.ServiceAccountCredentials(client_email, sa_file)
        ee.Initialize(credentials=credentials, project=project_id)
        print(f"✅ Earth Engine initialized with Service Account: {client_email}")
    else:
        ee.Initialize(project='mining-detection')
        print("✅ Earth Engine initialized with project: mining-detection")
except Exception as e:
    print(f"❌ Failed to initialize: {e}")
    exit(1)

# Test location: Jharkhand, India
geometry = ee.Geometry.Polygon([[[85.0, 23.0], [85.0, 23.5], [85.5, 23.5], [85.5, 23.0], [85.0, 23.0]]])
start_date = '2023-05-31'
end_date = '2023-06-30'

print(f"\n📍 Test Location: Jharkhand, India")
print(f"📅 Date Range: {start_date} to {end_date}")
print("")

# Test Sentinel-1
print("🛰️  Testing SENTINEL-1...")
try:
    s1 = (ee.ImageCollection('COPERNICUS/S1_GRD')
          .filterBounds(geometry)
          .filterDate(start_date, end_date))
    
    s1_count = s1.size().getInfo()
    print(f"   Result: {s1_count} images found")
    
    if s1_count > 0:
        print("   ✅ SENTINEL-1 data is available")
    else:
        print("   ❌ No SENTINEL-1 data found")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("")

# Test Sentinel-2
print("🛰️  Testing SENTINEL-2...")
try:
    s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(geometry)
          .filterDate(start_date, end_date)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))
    
    s2_count = s2.size().getInfo()
    print(f"   Result: {s2_count} images found")
    
    if s2_count > 0:
        print("   ✅ SENTINEL-2 data is available")
    else:
        print("   ❌ No SENTINEL-2 data found (try without cloud filter)")
        
        # Try without cloud filter
        s2_no_cloud = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                       .filterBounds(geometry)
                       .filterDate(start_date, end_date))
        s2_no_cloud_count = s2_no_cloud.size().getInfo()
        print(f"   Without cloud filter: {s2_no_cloud_count} images")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

print("")
print("="*60)
print("Summary:")
print("If both show 0 images, there might be an Earth Engine issue.")
print("If both show >0 images, the backend code has a bug.")
print("="*60)
