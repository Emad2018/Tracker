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
MIN_DURATION_SECONDS = 30  # Minimum trip duration to consider
MIN_DISTANCE_METERS = 100 # Skip trips shorter than this

def process_trips():
    print(f"Starting Data Processing...")
    
    df = pd.DataFrame()

    # 1. Load Data: Try JSON first (Preferred new method)
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

    # Fallback/Combine with CSV if needed
    if df.empty and os.path.exists(INPUT_FILE_CSV):
        print(f"Reading {INPUT_FILE_CSV}...")
        df = pd.read_csv(INPUT_FILE_CSV)

    if df.empty:
        print("No data found in JSON or CSV.")
        return

    # 2. Clean and Standardize
    required_cols = ['imei', 'latitude', 'longitude', 'timestamp']
    if not all(col in df.columns for col in required_cols):
        print(f"Missing columns. Available: {df.columns}")
        return

    # Filter out invalid coordinates
    df = df[(df['latitude'] != 0) & (df['longitude'] != 0)]
    
    # Handle Timestamps
    if pd.api.types.is_numeric_dtype(df['timestamp']):
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
    else:
        df['timestamp'] = pd.to_datetime(df['timestamp'])

    df = df.sort_values(by=['imei', 'timestamp'])
    
    all_trips = []

    # 3. Group by Device and Segment into Trips
    for device_id, group in df.groupby('imei'):
        group = group.sort_values('timestamp')
        
        # Identify Active Records
        if 'ignition' in group.columns:
            group['is_active'] = (group['ignition'] == 1)
        elif 'speed_gnss' in group.columns:
            group['is_active'] = (group['speed_gnss'] > 0)
        else:
            group['is_active'] = True 

        active_rows = group[group['is_active']].copy()
        if active_rows.empty: 
            continue

        # Identify Gaps (> 10 mins) to define separate trips
        active_rows['prev_time'] = active_rows['timestamp'].shift(1)
        active_rows['time_diff'] = active_rows['timestamp'] - active_rows['prev_time']
        
        gap_threshold = timedelta(minutes=10)
        active_rows['new_trip'] = (active_rows['time_diff'] > gap_threshold) | (active_rows['time_diff'].isnull())
        active_rows['trip_id'] = active_rows['new_trip'].cumsum()
        
        # 4. Filter and Validate Trips
        for trip_id, trip_data in active_rows.groupby('trip_id'):
            start_time = trip_data['timestamp'].iloc[0]
            end_time = trip_data['timestamp'].iloc[-1]
            duration = (end_time - start_time).total_seconds()
            
            # Distance calculation using odometer
            dist = 0
            if 'total_odometer_m' in trip_data.columns:
                # Calculate the difference between the last and first odometer reading of the trip
                dist = trip_data['total_odometer_m'].iloc[-1] - trip_data['total_odometer_m'].iloc[0]
            
            # --- SKIP LOGIC ---
            # Skip if duration is too short
            if duration < MIN_DURATION_SECONDS: 
                continue 
            
            # Skip the trip if the distance is less than 100 meters
            if dist < MIN_DISTANCE_METERS:
                print(f"Skipping short trip for IMEI {device_id}: {dist:.1f}m (Threshold: {MIN_DISTANCE_METERS}m)")
                continue
            # ------------------
            
            # Cleanup metadata columns before saving
            records = trip_data.drop(columns=['is_active', 'prev_time', 'time_diff', 'new_trip', 'trip_id'], errors='ignore').to_dict(orient='records')
            
            # Format timestamp back to string for the Simulator/UI
            for record in records:
                if isinstance(record['timestamp'], pd.Timestamp):
                    record['timestamp'] = record['timestamp'].strftime('%Y-%m-%dT%H:%M:%SZ')
            
            all_trips.append(records)
            
        print(f"Device {device_id}: Processing complete.")

    # 5. Save Output
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_trips, f, indent=4)
    
    print(f"Successfully updated {OUTPUT_FILE} with {len(all_trips)} valid trips.")

if __name__ == "__main__":
    process_trips()