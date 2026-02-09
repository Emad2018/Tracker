import json
import time
import requests
import argparse
import os

# Configuration
API_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/trip"

def send_trips(imei):
    trips = load_trips()
    
    if not trips:
        print("No trips found or empty file.")
        return

    print(f"Processing {len(trips)} trips for IMEI: {imei}")

    for i, trip in enumerate(trips):
        print(f"\n--- Processing Trip Set {i+1} ---")
        
        # Extract timestamps
        try:
            startdate = trip[0]["timestamp"]
            enddate = trip[-1]["timestamp"]
        except (KeyError, IndexError) as e:
            print(f"Skipping malformed trip data: {e}")
            continue

        # 1. Send Start Trip
        start_payload = startTrip(imei, startdate)
        print(f"Sending Start Trip (Time: {startdate})...")
        if not send_post_request(start_payload):
            print("Failed to send start trip.stopping the processing.")
            break

        # 2. Wait 2 Seconds
        print("Waiting 2 seconds before ending trip...")
        time.sleep(2)

        # 3. Send End Trip
        end_payload = endTrip(imei, enddate)
        print(f"Sending End Trip (Time: {enddate})...")
        if not send_post_request(end_payload):
            print("Failed to send end trip.stopping the processing")
            break

def send_post_request(payload):
    """Helper function to send the POST request"""
    try:
        # json=payload automatically adds Content-Type: application/json header
        response = requests.post(API_URL, json=payload)
        
        if response.status_code == 200:
             print(f"Success! Response: {response.text}")
             return True
        else:
             print(f"Failed. Status Code: {response.status_code}, Response: {response.text}")
             return False
             
    except requests.exceptions.RequestException as e:
        print(f"Connection Error: {e}")
    

def startTrip(imei, startdate):
    return {
        "action": "start_trip",
        "body": {
            "imei": imei,
            "driver_id": "14d82438-30c1-708f-0dbc-ff357c6a2019",
            "client_id": "",
            "start_date": startdate
        }
    }

def endTrip(imei, enddate):
    return {
        "action": "end_trip",
        "body": {
            "imei": imei,
            "driver_id": "14d82438-30c1-708f-0dbc-ff357c6a2019",
            "end_date": enddate
        }
    }

def load_trips():
    try:
        path = 'trips.json' if os.path.exists('trips.json') else '../data/trips.json'
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: trips.json file not found.")
        return []
    except json.JSONDecodeError:
        print("Error: Failed to decode JSON from file.")
        return []

if __name__ == "__main__":
    # Use argparse to get IMEI from command line arguments
    parser = argparse.ArgumentParser(description="Send trip start and end events with delay.")
    parser.add_argument("imei", type=str, help="The IMEI of the device")
    
    args = parser.parse_args()
    
    send_trips(args.imei)