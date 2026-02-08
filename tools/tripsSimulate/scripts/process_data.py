# process_data.py
import pandas as pd
import json
import os
from datetime import timedelta, datetime

# Configuration
INPUT_FILE_JSON = 'data/carlogges.json'
INPUT_FILE_CSV = 'data/Carloggs.csv' # Fallback
OUTPUT_FILE = 'data/trips.json'

# Filter Thresholds
MIN_DURATION_SECONDS = 120 
MIN_DISTANCE_METERS = 100

def process_trips():
    print(f"Starting Data Processing...")
    
    df = pd.DataFrame()

    # Try loading JSON first (Preferred new method)
    if os.path.exists(INPUT_FILE_JSON):
        print(f"Reading {INPUT_FILE_JSON}...")
        try:
            with open(INPUT_FILE_JSON, 'r') as f:
                data = json.load(f)
            if data:
                df = pd.DataFrame(data)
                # Ensure column names match logic (lowercase)
                df.columns = [c.lower() for c in df.columns]
        except Exception as e:
            print(f"Error reading JSON: {e}")

    # Fallback/Combine with CSV if needed (or if JSON failed/empty)
    if df.empty and os.path.exists(INPUT_FILE_CSV):
        print(f"Reading {INPUT_FILE_CSV}...")
        df = pd.read_csv(INPUT_FILE_CSV)

    if df.empty:
        print("No data found in JSON or CSV.")
        return

    # --- Standardize Columns ---
    # API uses 'speed_gnss', 'total_odometer_m'
    # Ensure critical columns exist
    required_cols = ['imei', 'latitude', 'longitude', 'timestamp']
    if not all(col in df.columns for col in required_cols):
        print(f"Missing columns. Available: {df.columns}")
        return

    # 1. CLEAN DATA
    df = df[(df['latitude'] != 0) & (df['longitude'] != 0)]
    
    # Handle Timestamp (API gives ms integer, CSV might be string)
    if pd.api.types.is_numeric_dtype(df['timestamp']):
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    else:
        df['timestamp'] = pd.to_datetime(df['timestamp'])

    df = df.sort_values(by=['imei', 'timestamp'])
    
    all_trips = []

    for device_id, group in df.groupby('imei'):
        group = group.sort_values('timestamp')
        
        # 2. Identify Active Records
        # API might not have 'ignition' or 'movement' perfectly, assume active if speed > 0 or ignition=1
        if 'ignition' in group.columns:
            group['is_active'] = (group['ignition'] == 1)
        elif 'speed_gnss' in group.columns:
            group['is_active'] = (group['speed_gnss'] > 0)
        else:
            group['is_active'] = True # Default to all points if no status indicators

        active_rows = group[group['is_active']].copy()
        if active_rows.empty: continue

        # 3. Identify Trip Gaps (> 10 mins)
        active_rows['prev_time'] = active_rows['timestamp'].shift(1)
        active_rows['time_diff'] = active_rows['timestamp'] - active_rows['prev_time']
        
        gap_threshold = timedelta(minutes=10)
        active_rows['new_trip'] = (active_rows['time_diff'] > gap_threshold) | (active_rows['time_diff'].isnull())
        active_rows['trip_id'] = active_rows['new_trip'].cumsum()
        
        # 4. Filter
        for trip_id, trip_data in active_rows.groupby('trip_id'):
            start_time = trip_data['timestamp'].iloc[0]
            end_time = trip_data['timestamp'].iloc[-1]
            duration = (end_time - start_time).total_seconds()
            
            # Distance approximation if odometer missing
            dist = 0
            if 'total_odometer_m' in trip_data:
                dist = trip_data['total_odometer_m'].iloc[-1] - trip_data['total_odometer_m'].iloc[0]
            
            # Relaxed filter for simulation testing
            if duration < 30: continue 
            
            records = trip_data.drop(columns=['is_active', 'prev_time', 'time_diff', 'new_trip', 'trip_id'], errors='ignore').to_dict(orient='records')
            
            # Format timestamp for simulator
            for record in records:
                record['timestamp'] = record['timestamp'].strftime('%Y-%m-%dT%H:%M:%SZ')
            
            all_trips.append(records)
            
        print(f"Device {device_id}: Generated valid trips.")

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_trips, f, indent=4)
    
    print(f"Successfully updated {OUTPUT_FILE} with {len(all_trips)} trips.")

if __name__ == "__main__":
    process_trips()