# utils.py
import json
import os
import random
import string
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
    except:
        pass

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
        
    return {
        "dist": f"{dist:.2f} km", 
        "dur": str(duration),
        "max_s": f"{max_speed} km/h", 
        "avg_s": f"{avg_s:.1f} km/h"
    }

# --- File Loading ---
def load_trips_data():
    path = config.TRIPS_FILE_PRIMARY if os.path.exists(config.TRIPS_FILE_PRIMARY) else config.TRIPS_FILE_FALLBACK
    try:
        with open(path, 'r') as f: return [t for t in json.load(f) if t]
    except: return []

def load_devices_data():
    path = config.DEVICES_FILE_PRIMARY if os.path.exists(config.DEVICES_FILE_PRIMARY) else config.DEVICES_FILE_FALLBACK
    if os.path.exists(path):
        with open(path, 'r') as f: return [l.strip() for l in f if l.strip()]
    return ["Sim_Device_1", "Sim_Device_2"]

def save_device_to_file(imei):
    """Appends a new IMEI to the devices file."""
    path = config.DEVICES_FILE_PRIMARY if os.path.exists(config.DEVICES_FILE_PRIMARY) else config.DEVICES_FILE_FALLBACK
    try:
        with open(path, 'a') as f:
            f.write(f"\n{imei}")
    except Exception as e:
        print(f"Error saving device: {e}")

# --- Random Data Generators ---
COMPANIES = ["ElOmda", "LogiTrans", "FastTrack", "NileCargo", "CairoFleet", "DesertShip", "Alex Logistics", "Delta Movers", "RedSea Transport", "Giza Goods"]
BRANDS = ["Nissan-Sunny", "Toyota-Corolla", "Hyundai-Elantra", "Kia-Cerato", "Chevrolet-Optra"]
COLORS = ["Blue", "Red", "White", "Black", "Silver", "Grey"]
NAMES = ["Mahmoud's Car", "Ahmed's Truck", "Omar's Van", "Khaled's Fleet", "Youssef's Transport", "Mustafa's Unit", "Hassan's Lorry"]

def generate_vehicle_data():
    imei = str(random.randint(1000000000000000, 9999999999999999)) # 16 digits
    name = random.choice(NAMES)
    company = random.choice(COMPANIES)
    simcard = "+2010" + str(random.randint(10000000, 99999999))
    brand = random.choice(BRANDS)
    color = random.choice(COLORS)
    
    # License: 3 chars + 3 nums (e.g., ABC-123)
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    nums = str(random.randint(100, 999))
    license_plate = f"{letters}-{nums}"

    return {
        "imei": imei,
        "name": name,
        "company": company,
        "simcard": simcard,
        "type": "Simulation",
        "brand": brand,
        "color": color,
        "license": license_plate
    }