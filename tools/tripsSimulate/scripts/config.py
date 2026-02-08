# config.py

# --- AWS MQTT Configuration ---
ENDPOINT = "a2ocgpntw8531n-ats.iot.us-east-1.amazonaws.com"
CERT_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-certificate.pem.crt"
KEY_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-private.pem.key"
ROOT_CA_PATH = "certificate/AmazonRootCA1.pem"
TOPIC_PREFIX = "SimulatorData"

# --- API Configuration ---
AUTH_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/auth"
DEVICE_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/device"
SIM_URL = "https://moj6el904i.execute-api.us-east-1.amazonaws.com/prod/sim" # New URL for reading logs

# Default Credentials
DEFAULT_EMAIL = "abdelrahman.ibrahim@techno-welle.com"
DEFAULT_PASS = "ResetPass1!"

# --- Data Paths ---
TRIPS_FILE_PRIMARY = 'data/trips.json'
TRIPS_FILE_FALLBACK = 'trips.json'

# Changed from txt to csv as requested
DEVICES_FILE_PRIMARY = 'data/devices.csv'
DEVICES_FILE_FALLBACK = 'devices.csv'

# New Logs file
LOGS_FILE = 'data/carlogges.json'

ICON_PATH = "data/car.png"