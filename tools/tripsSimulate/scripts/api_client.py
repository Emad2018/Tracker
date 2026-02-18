# api_client.py
import requests
import json
import config
from datetime import datetime, timezone

class APIClient:
    def __init__(self):
        self.access_token = None
        self.account_id = None

    def login(self, email, password):
        url = config.AUTH_URL
        payload = {"operation": "login","body": {"email": email,"password": password}}

        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            if data.get("status") == "SUCCESS":
                self.access_token = data.get("tokens", {}).get("access_token")
                self.account_id = data.get("user_profile", {}).get("user_id")
                self.company_id = data.get("user_profile", {}).get("company_id")
                return True, "Login Successful"
            else:
                return False, f"Login Failed: {data.get('message', 'Unknown error')}"
        except Exception as e:
            return False, f"Connection Error: {str(e)}"

    def register_device(self, imei):
        if not config.DEVICE_URL: return False, "Config Error"
        
        payload = {"id": self.account_id,"operation": "register","body": {"imei": imei, "model": "Teltonika-FMC150"}}
        
        try:
            response = requests.post(config.DEVICE_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            token = data.get("token")
            return (True, token) if token else (False, f"No token: {data}")
        except Exception as e: return False, str(e)

    def activate_device(self, imei, token, metadata):
        payload = {

            "id": self.account_id,
            "operation": "create",
            "body": {
                "imei": imei, "token": token,
                "name": metadata['name'], "company_id": self.company_id,
                "simcard": metadata['simcard'], "type": metadata['type'],
                "brand": metadata['brand'], "color": metadata['color'],
                "Plate_Number": metadata['license'],"model" :"Teltonika-FMC150"
            }
        }
        try:
            requests.post(config.DEVICE_URL, json=payload).raise_for_status()
            return True, "Activated"
        except Exception as e: return False, str(e)

    # --- New Methods ---
    def fetch_all_devices(self):
        """Fetches the list of all devices from the cloud."""
        payload = {
            "creator_id": self.account_id,
            "operation": "list",
            "body": {
                "company_id": self.company_id
            }
        }
        try:
            response = requests.post(config.DEVICE_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            # The API returns a nested JSON string in "body", we need to parse it
            if isinstance(data.get("devices"), list):
                return True, data.get("devices", [])
        except Exception as e:
            return False, f"Fetch Error: {str(e)}"

    def fetch_device_logs(self, imei, limit=None, start_time=None):
        """
        Fetches logs. handles pagination and incremental updates automatically.
        """
        all_records = []
        last_evaluated_key = None
        keep_fetching = True
        
        # Prepare the Base Payload
        body_payload = {"imei": imei}
        if limit is not None:
            body_payload["limit"] = int(limit)
        if start_time is not None:
            body_payload["start_time"] = start_time

        while keep_fetching:
            # If we have a key from the previous page, add it to the request
            if last_evaluated_key:
                body_payload["exclusive_start_key"] = last_evaluated_key

            payload = {
                "user_id": self.account_id,
                "action": "read_imei",
                "body": body_payload
            }

            try:
                # Use the SIM_URL (make sure this is correct in your config)
                response = requests.post(config.SIM_URL, json=payload)
                response.raise_for_status()
                data = response.json()

                # Handle response body parsing
                if "body" in data and isinstance(data["body"], str):
                    inner_body = json.loads(data["body"])
                else:
                    inner_body = data

                # Append records found in this page
                new_records = inner_body.get("records", [])
                all_records.extend(new_records)
                
                # Check if there is more data
                last_evaluated_key = inner_body.get("last_evaluated_key")
                
                # Stop if no key returned OR if we hit the user's limit (optional logic)
                if not last_evaluated_key:
                    keep_fetching = False
                
                # Safety break: If user set a limit and we reached it, stop fetching
                if limit and len(all_records) >= int(limit):
                    all_records = all_records[:int(limit)]
                    keep_fetching = False

            except Exception as e:
                return False, f"Log Error: {str(e)}"

        return True, all_records

    def send_trip_event(self, operation, imei):
        """
        Sends start_trip or end_trip event.
        operation: 'start_trip' or 'end_trip'
        """
        if not config.TRIP_URL: return
        
        # Get current time in format: 2025-12-18T12:58:25Z
        current_time = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        body_data = {
            "imei": imei,
            "driver_id": config.DEFAULT_DRIVER_ID,
            "company_id":self.company_id
        }

        if operation == "start_trip":
            body_data["client_id"] = ""
            body_data["start_date"] = current_time
        elif operation == "end_trip":
            body_data["end_date"] = current_time

        payload = {
            "id":self.account_id,
            "operation": operation,
            "body": body_data
        }

        try:
            # print(f"Sending {action} for {imei}...") # Debug
            print(f"Payload for {operation}: {json.dumps(payload)}") # Debug
            response = requests.post(config.TRIP_URL, json=payload)
            if response.status_code != 200:
                print(f"Failed to send trip event ({operation}): {response.text}")
            print(f"{operation} response: {response.status_code} - {response.text}") # Debug
        except Exception as e:
            print(f"Failed to send trip event ({operation}): {e}")