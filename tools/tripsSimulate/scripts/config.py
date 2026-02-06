# config.py

# --- AWS MQTT Configuration ---
ENDPOINT = "a2ocgpntw8531n-ats.iot.us-east-1.amazonaws.com"
CERT_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-certificate.pem.crt"
KEY_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-private.pem.key"
ROOT_CA_PATH = "certificate/AmazonRootCA1.pem"
TOPIC_PREFIX = "SimulatorData"

# --- API Configuration ---
# NOTE: device_url was empty in your file. Please replace with the correct URL.
AUTH_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/auth"
DEVICE_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/device"  # e.g., "https://2njc6ynilf.execute-api.us-east-1.amazonaws.com/prod/device"

# Default Credentials
DEFAULT_EMAIL = "abdelrahman.ibrahim@techno-welle.com"
DEFAULT_PASS = "ResetPass1!"  # Replace with actual password

# --- Data Paths ---
TRIPS_FILE_PRIMARY = 'data/trips.json'
TRIPS_FILE_FALLBACK = 'trips.json'
DEVICES_FILE_PRIMARY = 'data/devices.txt'
DEVICES_FILE_FALLBACK = 'devices.txt'
ICON_PATH = "data/car.png"