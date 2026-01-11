const API_URL = "https://yjzamkco75.execute-api.us-east-1.amazonaws.com/production/live";
const EGYPT_COORDS = [26.8206, 30.8025];
const OPERATOR_MAP = {
    "60201": "Orange EG", "60202": "Vodafone EG", "60203": "Etisalat EG", "60204": "WE EG"
};

const map = L.map('map', { closePopupOnClick: true }).setView(EGYPT_COORDS, 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map);

const createCenteredIcon = (colorClass, size) => L.divIcon({
    className: '',
    html: `<img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="${colorClass}" style="width:${size[0]}px; height:${size[1]}px;">`,
    iconSize: size, iconAnchor: [size[0] / 2, size[1]], popupAnchor: [0, -size[1]]
});

let deviceMarker = null;

let refreshIntervalSeconds = parseInt(localStorage.getItem('refreshRate')) || 10;
let secondsRemaining = refreshIntervalSeconds;
const deviceInput = document.getElementById('device-id'); // This is your IMEI input
const refreshInput = document.getElementById('refresh-rate');
const timerDisplay = document.getElementById('timer-display');

// 1. Updated LocalStorage Key to lastImei
deviceInput.value = localStorage.getItem('lastImei');
if (refreshInput) refreshInput.value = refreshIntervalSeconds;

function saveDeviceId() {
    const id = deviceInput.value.trim();
    if (id) {
        localStorage.setItem('lastImei', id);
        resetTimer();
    }
}

function applyRefreshRate() {
    let newVal = parseInt(refreshInput.value);
    if (isNaN(newVal) || newVal < 1) newVal = 1;
    refreshIntervalSeconds = newVal;
    localStorage.setItem('refreshRate', newVal);
    resetTimer();
}

function resetTimer() { secondsRemaining = refreshIntervalSeconds; updateLive(); }

function clearDashboard(statusMsg) {
    if (deviceMarker) {
        map.removeLayer(deviceMarker);
        deviceMarker = null;
    }
    map.setView(EGYPT_COORDS, 6);

    document.getElementById('speed').innerText = "0";
    document.getElementById('odo').innerText = "0.00 km";
    document.getElementById('movement').innerText = "--";

    const timeEl = document.getElementById('time');
    const statusEl = document.getElementById('status-text');

    timeEl.innerHTML = `<strong>${statusMsg}</strong>`;
    timeEl.className = "mt-6 pt-4 border-t border-slate-50 text-[9px] text-red-500 font-medium italic text-center";

    statusEl.innerHTML = `<strong>${statusMsg}</strong>`;
    statusEl.className = "text-[10px] uppercase tracking-widest hidden md:block text-red-500";

    const ign = document.getElementById('ignition');
    ign.innerText = "N/A";
    ign.className = "px-3 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-400";

    const bars = document.getElementById('signal-bars').querySelectorAll('.sig-bar');
    bars.forEach(bar => bar.classList.remove('active'));

    document.getElementById('sats').innerText = "--";
    document.getElementById('battery').innerText = "--";
    document.getElementById('battery-alert').classList.add('hidden');
    document.getElementById('alt').innerText = "--";
    document.getElementById('gnss-status').innerText = "--";
    document.getElementById('operator').innerText = "--";
}

setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) { updateLive(); secondsRemaining = refreshIntervalSeconds; }
    if (timerDisplay) {
        timerDisplay.innerText = secondsRemaining + "s";
        timerDisplay.style.color = (secondsRemaining <= 3) ? "#ef4444" : "#2563eb";
    }
}, 1000);

async function updateLive() {
    const imei = deviceInput.value.trim();
    if (!imei) {
        clearDashboard("Enter IMEI");
        return;
    }

    try {
        // 2. Updated API query parameter from deviceId to imei
        const res = await fetch(`${API_URL}?imei=${imei}`);
        if (!res.ok) throw new Error("Connection Failed");

        const data = await res.json();

        if (!data.latitude || parseFloat(data.latitude) === 0) {
            clearDashboard("No Signal Found");
            return;
        }

        const timeEl = document.getElementById('time');
        const statusEl = document.getElementById('status-text');
        timeEl.className = "mt-6 pt-4 border-t border-slate-50 text-[9px] text-slate-400 font-medium italic text-center";
        statusEl.className = "text-[10px] uppercase tracking-widest hidden md:block text-slate-400 font-bold";

        const pos = [parseFloat(data.latitude), parseFloat(data.longitude)];
        if (!deviceMarker) {
            deviceMarker = L.marker(pos, { icon: createCenteredIcon('marker-blue', [25, 41]) }).addTo(map);
        } else {
            deviceMarker.setLatLng(pos);
        }
        deviceMarker.bindPopup(`<b>IMEI:</b> ${imei}`);
        map.setView(pos, 15);

        document.getElementById('speed').innerText = data.speed_gnss || 0;
        const odoKm = (parseFloat(data.total_odometer_m) || 0) / 1000;
        document.getElementById('odo').innerText = odoKm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " km";
        document.getElementById('movement').innerText = data.movement === 1 ? "Moving" : "Stationary";

        // 3. Updated Timestamp Formatting (converts ms to readable string)
        if (data.timestamp) {
            const dateObj = new Date(parseInt(data.timestamp));
            document.getElementById('time').innerText = "Last Update: " + dateObj.toLocaleString();
        } else {
            document.getElementById('time').innerText = "Last Update: " + new Date().toLocaleTimeString();
        }

        const ign = document.getElementById('ignition');
        ign.innerText = data.ignition === 1 ? "IGNITION ON" : "IGNITION OFF";
        ign.className = `px-3 py-1 rounded-full text-[9px] font-black uppercase ${data.ignition === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;

        const gnssStatusMap = { 0: "GNSS OFF", 1: "GNSS ON with fix", 2: "GNSS ON without fix", 3: "GNSS sleep", 4: "GNSS ON with fix, invalid data" };
        const gnssEl = document.getElementById('gnss-status');
        const gCode = parseInt(data.gnss_status);
        gnssEl.innerText = gnssStatusMap[gCode] || "Searching...";
        gnssEl.className = gCode === 1 ? "text-green-600 font-bold" :
            (gCode === 2 || gCode === 4 ? "text-orange-500 font-bold" : "text-slate-400 font-bold");

        const gsmVal = parseInt(data.gsm_signal_strength) || 0;
        const bars = document.getElementById('signal-bars').querySelectorAll('.sig-bar');
        bars.forEach((bar, i) => bar.classList.toggle('active', gsmVal > i));

        document.getElementById('sats').innerText = data.satellites || 0;
        document.getElementById('alt').innerText = (data.altitude || 0) + " m";
        document.getElementById('operator').innerText = OPERATOR_MAP[data.active_gsm_operator] || data.active_gsm_operator || "N/A";

        const v = parseFloat(data.battery_voltage_v) || 0;
        document.getElementById('battery').innerText = v.toFixed(2) + " V";
        document.getElementById('battery-alert').classList.toggle('hidden', v >= 10);
        document.getElementById('status-text').innerText = "Signal Received: " + new Date().toLocaleTimeString();

    } catch (e) {
        clearDashboard("Connection Failed");
    }
}

clearDashboard("Ready");
updateLive();
setTimeout(() => map.invalidateSize(), 500);