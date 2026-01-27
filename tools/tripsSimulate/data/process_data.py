import pandas as pd
import json
from datetime import timedelta

# Configuration
INPUT_FILE = 'Carloggs.csv'
OUTPUT_FILE = 'trips.json'

# Filter Thresholds
MIN_DURATION_SECONDS = 120  # 2 minutes
MIN_DISTANCE_METERS = 100   # 100 meters

def process_trips():
    print(f"Reading {INPUT_FILE}...")
    try:
        df = pd.read_csv(INPUT_FILE)
    except FileNotFoundError:
        print(f"Error: {INPUT_FILE} not found.")
        return

    # --- 1. CLEAN DATA ---
    # Skip any records where latitude or longitude is 0
    initial_count = len(df)
    df = df[(df['latitude'] != 0) & (df['longitude'] != 0)]
    removed_count = initial_count - len(df)
    if removed_count > 0:
        print(f"Filtered out {removed_count} records with invalid coordinates (0,0).")

    # Ensure timestamp is datetime and sort
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(by=['DeviceId', 'timestamp'])
    
    all_trips = {}

    for device_id, group in df.groupby('DeviceId'):
        group = group.sort_values('timestamp')
        
        # 2. Identify Active Records (Ignition or Movement)
        group['is_active'] = (group['ignition'] == 1) | (group['movement'] == 1)
        active_rows = group[group['is_active']].copy()
        
        if active_rows.empty:
            continue

        # 3. Identify Trip Gaps (> 10 mins)
        active_rows['prev_time'] = active_rows['timestamp'].shift(1)
        active_rows['time_diff'] = active_rows['timestamp'] - active_rows['prev_time']
        
        gap_threshold = timedelta(minutes=10)
        active_rows['new_trip'] = (active_rows['time_diff'] > gap_threshold) | (active_rows['time_diff'].isnull())
        active_rows['trip_id'] = active_rows['new_trip'].cumsum()
        
        device_valid_trips = []
        
        # 4. Filter by Duration and Distance
        for trip_id, trip_data in active_rows.groupby('trip_id'):
            # Duration
            start_time = trip_data['timestamp'].iloc[0]
            end_time = trip_data['timestamp'].iloc[-1]
            duration_seconds = (end_time - start_time).total_seconds()
            
            # Distance (Odometer-based)
            start_odo = trip_data['total_odometer_m'].iloc[0]
            end_odo = trip_data['total_odometer_m'].iloc[-1]
            distance_meters = end_odo - start_odo
            
            # Final Validation
            if duration_seconds < MIN_DURATION_SECONDS or distance_meters < MIN_DISTANCE_METERS:
                continue 
            
            # Prepare for JSON
            records = trip_data.drop(columns=['is_active', 'prev_time', 'time_diff', 'new_trip', 'trip_id']).to_dict(orient='records')
            for record in records:
                record['timestamp'] = record['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            
            device_valid_trips.append(records)
            
        all_trips[str(device_id)] = device_valid_trips
        print(f"Device {device_id}: Generated {len(device_valid_trips)} valid trips.")

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_trips, f, indent=4)
    
    print(f"Successfully updated {OUTPUT_FILE}")

if __name__ == "__main__":
    process_trips()