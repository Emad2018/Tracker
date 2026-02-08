# utils.py
import json
import os
import random
import string
import csv
from datetime import datetime
from math import radians, cos, sin, asin, sqrt
import config

# --- Math & Stats ---
def haversine(lon1, lat1, lon2, lat2):
    R = 6371000 
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * (2 * asin(sqrt(a)))

def calculate_trip_stats(trip):
    if not trip or len(trip) < 2:
        return {"dist": "0 km", "dur": "0s", "max_s": "0 km/h", "avg_s": "0 km/h"}
    
    total_dist = 0
    max_speed = 0
    speed_sum = 0
    duration = "N/A"

    try:
        start_time = datetime.strptime(trip[0]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        end_time = datetime.strptime(trip[-1]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        duration = end_time - start_time
    except: pass

    for i in range(len(trip)):
        p = trip[i]
        s = p.get('speed_gnss', 0)
        max_speed = max(max_speed, s)
        speed_sum += s
        if i > 0:
            total_dist += haversine(trip[i-1]['longitude'], trip[i-1]['latitude'], p['longitude'], p['latitude'])
    
    dist = total_dist / 1000
    avg_s = 0
    if isinstance(duration, (str, type(None))) == False and duration.total_seconds() > 0:
        avg_s = dist / (duration.total_seconds() / 3600)
        
    return {"dist": f"{dist:.2f} km", "dur": str(duration), "max_s": f"{max_speed} km/h", "avg_s": f"{avg_s:.1f} km/h"}

# --- File Loading ---
def load_trips_data():
    path = config.TRIPS_FILE_PRIMARY if os.path.exists(config.TRIPS_FILE_PRIMARY) else config.TRIPS_FILE_FALLBACK
    try:
        with open(path, 'r') as f: return [t for t in json.load(f) if t]
    except: return []

def load_devices_data():
    """Reads devices from CSV. Returns list of IMEIs."""
    path = config.DEVICES_FILE_PRIMARY if os.path.exists(config.DEVICES_FILE_PRIMARY) else config.DEVICES_FILE_FALLBACK
    devices = []
    if os.path.exists(path):
        try:
            with open(path, 'r', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if 'imei' in row and row['imei']:
                        devices.append(row['imei'])
        except Exception:
            # Fallback for old txt format if csv fails
            with open(path, 'r') as f: return [l.strip() for l in f if l.strip()]
    return devices if devices else ["Sim_Device_1", "Sim_Device_2"]

def load_devices_full():
    """Returns list of dicts {imei, type} for the UI."""
    path = config.DEVICES_FILE_PRIMARY if os.path.exists(config.DEVICES_FILE_PRIMARY) else config.DEVICES_FILE_FALLBACK
    data = []
    if os.path.exists(path):
        try:
            with open(path, 'r', newline='') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    data.append(row)
        except: pass
    return data

def save_devices_list(devices_list):
    """Overwrites the CSV with a full list of dicts."""
    path = config.DEVICES_FILE_PRIMARY
    # Ensure dir exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    with open(path, 'w', newline='') as f:
        fieldnames = ['imei', 'type']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for d in devices_list:
            # key handling for case sensitivity
            clean_d = {
                'imei': d.get('imei') or d.get('IMEI'),
                'type': d.get('type') or d.get('Type', 'Simulation')
            }
            writer.writerow(clean_d)

def append_device_to_file(imei, dev_type="Simulation"):
    """Appends a single device to the CSV."""
    path = config.DEVICES_FILE_PRIMARY
    exists = os.path.exists(path)
    
    with open(path, 'a', newline='') as f:
        fieldnames = ['imei', 'type']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not exists:
            writer.writeheader()
        writer.writerow({'imei': imei, 'type': dev_type})

def append_logs_to_file(new_records):
    """Appends new records to carlogges.json."""
    path = config.LOGS_FILE
    existing_data = []
    
    if os.path.exists(path):
        try:
            with open(path, 'r') as f:
                existing_data = json.load(f)
        except: existing_data = [] # Corrupt or empty
        
    # Append new data
    existing_data.extend(new_records)
    
    with open(path, 'w') as f:
        json.dump(existing_data, f, indent=4)

# --- Random Data Generators ---
COMPANIES = ["ElOmda", "LogiTrans", "FastTrack", "NileCargo"]
BRANDS = ["Nissan-Sunny", "Toyota-Corolla", "Hyundai-Elantra"]
COLORS = ["Blue", "Red", "White", "Black"]
NAMES = ["Mahmoud's Car", "Ahmed's Truck", "Omar's Van"]

def generate_vehicle_data():
    imei = str(random.randint(1000000000000000, 9999999999999999))
    return {
        "imei": imei,
        "name": random.choice(NAMES),
        "company": random.choice(COMPANIES),
        "simcard": "+2010" + str(random.randint(10000000, 99999999)),
        "type": "Simulation",
        "brand": random.choice(BRANDS),
        "color": random.choice(COLORS),
        "license": f"{''.join(random.choices(string.ascii_uppercase, k=3))}-{random.randint(100, 999)}"
    }