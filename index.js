const API_URL = "https://12byiwuq21.execute-api.us-east-1.amazonaws.com/API/live";

// --- Map Initialization ---
const map = L.map('map', { closePopupOnClick: true }).setView([30.08, 31.01], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

const createCenteredIcon = (colorClass, size) => L.divIcon({
    className: '',
    html: `<img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="${colorClass}" style="width:${size[0]}px; height:${size[1]}px;">`,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]]
});

const marker = L.marker([30.08, 31.01], {
    icon: createCenteredIcon('marker-blue', [25, 41])
}).addTo(map);

// --- State Management for Refresh & Timer ---
let refreshIntervalSeconds = parseInt(localStorage.getItem('refreshRate')) || 10;
let secondsRemaining = refreshIntervalSeconds;

const deviceInput = document.getElementById('device-id');
const refreshInput = document.getElementById('refresh-rate');
const timerDisplay = document.getElementById('timer-display');

deviceInput.value = localStorage.getItem('lastDeviceId') || "2147483647";
if (refreshInput) refreshInput.value = refreshIntervalSeconds;

// --- Functions ---

function saveDeviceId() {
    const id = deviceInput.value.trim();
    if (id) {
        localStorage.setItem('lastDeviceId', id);
        resetTimer();
    }
}

/**
 * Triggered by the APPLY button in the footer
 */
function applyRefreshRate() {
    let newVal = parseInt(refreshInput.value);
    if (isNaN(newVal) || newVal < 1) newVal = 1; // Minimum 5s floor

    refreshIntervalSeconds = newVal;
    localStorage.setItem('refreshRate', newVal);
    resetTimer();
}

/**
 * Resets the countdown and forces an immediate data fetch
 */
function resetTimer() {
    secondsRemaining = refreshIntervalSeconds;
    updateLive();
}

/**
 * Main Countdown Loop (Runs every 1 second)
 */
setInterval(() => {
    secondsRemaining--;

    if (secondsRemaining <= 0) {
        updateLive();
        secondsRemaining = refreshIntervalSeconds;
    }

    if (timerDisplay) {
        timerDisplay.innerText = secondsRemaining + "s";
    }
}, 1000);

async function updateLive() {
    const id = deviceInput.value.trim();
    if (!id) return;

    try {
        const res = await fetch(`${API_URL}?deviceId=${id}`);
        const data = await res.json();

        // 1. Update Map Position
        if (data.latitude && data.longitude) {
            const pos = [parseFloat(data.latitude), parseFloat(data.longitude)];
            if (pos[0] !== 0 && pos[1] !== 0) {
                marker.setLatLng(pos);
                // Set/Update the Popup
                marker.bindPopup(`<b>Device ID:</b> ${id}`);
                map.panTo(pos);
            }
        }

        // 2. Main Telemetry
        document.getElementById('speed').innerText = data.speed_gnss || 0;
        document.getElementById('odo').innerText = (data.total_odometer_m || 0).toLocaleString() + " m";
        document.getElementById('movement').innerText = data.movement === 1 ? "Moving" : "Stationary";

        // Update the small time text in the Telemetry card
        document.getElementById('time').innerText = "Last Update: " + (data.timestamp || new Date().toLocaleTimeString());

        // Update the footer status text
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.innerText = "Data Received at " + new Date().toLocaleTimeString();

        const ign = document.getElementById('ignition');
        ign.innerText = data.ignition === 1 ? "IGNITION ON" : "IGNITION OFF";
        ign.className = `px-3 py-1 rounded-full text-[10px] font-bold ${data.ignition === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;

        // 3. System Diagnostics
        document.getElementById('gsm').innerText = data.gsm_signal_strength || 0;
        document.getElementById('sats').innerText = data.satellites || 0;
        document.getElementById('alt').innerText = (data.altitude || 0) + " m";
        document.getElementById('operator').innerText = data.active_gsm_operator || "N/A";
        document.getElementById('gnss-status').innerText = data.gnss_status === 2 ? "Fix Found" : "Searching...";

        // 4. Battery Logic & Alerts
        const voltage = parseFloat(data.battery_voltage_v) || 0;
        const battEl = document.getElementById('battery');
        const battAlert = document.getElementById('battery-alert');

        battEl.innerText = voltage + " V";

        if (voltage >= 0 && voltage < 10) {
            battEl.className = "text-lg font-bold text-red-600";
            battAlert.classList.remove('hidden');
        } else {
            battEl.className = "text-lg font-bold text-slate-700";
            battAlert.classList.add('hidden');
        }

    } catch (e) {
        console.error("Live Fetch Error:", e);
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').innerText = "Connection Lost...";
        }
    }
}

// Initial Load
updateLive();
setTimeout(() => map.invalidateSize(), 500);