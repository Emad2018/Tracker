# api_client.py
import requests
import json
import config

class APIClient:
    def __init__(self):
        self.access_token = None
        self.account_id = None

    def login(self, email, password):
        """Authenticates user and retrieves Access Token and Account ID."""
        url = config.AUTH_URL
        payload = {
            "action": "login",
            "email": email,
            "password": password
        }
        
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
        """Step 1: Register the device to get the activation token."""
        if not config.DEVICE_URL:
            return False, "Error: DEVICE_URL is missing in config.py"

        payload = {
            "creator_id": self.account_id,
            "action": "register",
            "body": {
                "imei": imei,
                "device_model": "Teltonika-FMC150"
            }
        }

        try:
            response = requests.post(config.DEVICE_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Assuming 201 Created or specific message
            token = data.get("token")
            if token:
                return True, token
            else:
                return False, f"No token returned. Response: {data}"
        except Exception as e:
            return False, f"Register Error: {str(e)}"

    def activate_device(self, imei, token, metadata):
        """Step 2: Activate the device with full metadata."""
        if not config.DEVICE_URL:
            return False, "Error: DEVICE_URL is missing in config.py"

        body_data = {
            "imei": imei,
            "token": token,
            "name": metadata['name'],
            "company": metadata['company'],
            "simcard": metadata['simcard'],
            "type": metadata['type'],
            "brand": metadata['brand'],
            "color": metadata['color'],
            "license": metadata['license']
        }

        payload = {
            "creator_id": self.account_id,
            "action": "activate",
            "body": body_data
        }

        try:
            response = requests.post(config.DEVICE_URL, json=payload)
            response.raise_for_status()
            # If status 200/201, assume success
            return True, "Activated Successfully"
        except Exception as e:
            return False, f"Activate Error: {str(e)}"