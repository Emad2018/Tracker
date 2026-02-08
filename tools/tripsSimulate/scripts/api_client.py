# api_client.py
import requests
import json
import config

class APIClient:
    def __init__(self):
        self.access_token = None
        self.account_id = None

    def login(self, email, password):
        url = config.AUTH_URL
        payload = {"action": "login", "email": email, "password": password}
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            if data.get("status") == "SUCCESS":
                self.access_token = data.get("tokens", {}).get("access_token")
                self.account_id = data.get("user_profile", {}).get("id")
                return True, "Login Successful"
            else:
                return False, f"Login Failed: {data.get('message', 'Unknown error')}"
        except Exception as e:
            return False, f"Connection Error: {str(e)}"

    def register_device(self, imei):
        if not config.DEVICE_URL: return False, "Config Error"
        payload = {
            "creator_id": self.account_id,
            "action": "register",
            "body": {"imei": imei, "device_model": "Teltonika-FMC150"}
        }
        try:
            response = requests.post(config.DEVICE_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            token = data.get("token")
            return (True, token) if token else (False, f"No token: {data}")
        except Exception as e: return False, str(e)

    def activate_device(self, imei, token, metadata):
        payload = {
            "creator_id": self.account_id,
            "action": "activate",
            "body": {
                "imei": imei, "token": token,
                "name": metadata['name'], "company": metadata['company'],
                "simcard": metadata['simcard'], "type": metadata['type'],
                "brand": metadata['brand'], "color": metadata['color'],
                "license": metadata['license']
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
            "action": "list_all",
            "body": {}
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

    def fetch_device_logs(self, imei, limit=None):
        """
        Fetches historical logs for a device. 
        If limit is None, it fetches all available records.
        """
        body_payload = {"imei": imei}
        
        # Only add limit to the body if it is explicitly provided
        if limit is not None:
            body_payload["limit"] = int(limit)

        payload = {
            "user_id": self.account_id,
            "action": "read_imei",
            "body": body_payload
        }
        
        try:
            # Using SIM_URL as defined in your previous logic for logs
            response = requests.post(config.SIM_URL, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            # Handle the stringified body parsing
            if "body" in data and isinstance(data["body"], str):
                inner_body = json.loads(data["body"])
                records = inner_body.get("records", [])
                return True, records
            
            # Fallback for direct dict response
            return True, data.get("records", [])
            
        except Exception as e:
            return False, f"Log Error: {str(e)}"