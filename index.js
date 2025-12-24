const API_URL = "https://12byiwuq21.execute-api.us-east-1.amazonaws.com/API/live";

// Initialize Map
const map = L.map('map').setView([30.08, 31.01], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

const marker = L.marker([30.08, 31.01]).addTo(map);

const deviceInput = document.getElementById('device-id');
deviceInput.value = localStorage.getItem('lastDeviceId') || "2147483647";

function saveDeviceId() {
    const id = deviceInput.value.trim();
    if (id) {
        localStorage.setItem('lastDeviceId', id);
        updateLive();
    }
}

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
                map.panTo(pos);
            }
        }

        // 2. Main Telemetry
        document.getElementById('speed').innerText = data.speed_gnss || 0;
        document.getElementById('odo').innerText = (data.total_odometer_m || 0).toLocaleString() + " m";
        document.getElementById('movement').innerText = data.movement === 1 ? "Moving" : "Stationary";
        document.getElementById('time').innerText = "Last Update: " + data.timestamp;

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
    }
}

// Start polling
setInterval(updateLive, 10000);
updateLive();
// Ensure map renders correctly on initial load
setTimeout(() => map.invalidateSize(), 500);