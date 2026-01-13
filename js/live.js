import { Amplify } from 'https://esm.sh/aws-amplify';
import { generateClient } from 'https://esm.sh/@aws-amplify/api';

// --- CONFIGURATION ---
Amplify.configure({
    API: {
        GraphQL: {
            endpoint: 'https://m677wqaywfat7ejuca7wmgwfeq.appsync-api.us-east-1.amazonaws.com/graphql',
            region: 'us-east-1',
            defaultAuthMode: 'apiKey',
            apiKey: 'da2-6o2v64fnsvgivacrzto5nl3ouq'
        }
    }
});

const client = generateClient();
const EGYPT_COORDS = [26.8206, 30.8025];
const OPERATOR_MAP = {
    "60201": "Orange EG", "60202": "Vodafone EG", "60203": "Etisalat EG", "60204": "WE EG"
};
const OFFLINE_THRESHOLD_MS = 10 * 60 * 1000; // 10 Minutes in milliseconds

// --- MAP SETUP ---
const map = L.map('map', { closePopupOnClick: true, zoomControl: false }).setView(EGYPT_COORDS, 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM', maxZoom: 19 }).addTo(map);
L.control.zoom({ position: 'bottomleft' }).addTo(map);

const createCenteredIcon = (colorClass, size) => L.divIcon({
    className: '',
    html: `<img src="https://res.cloudinary.com/dx20j6wpl/image/upload/a_90/v1768313910/car_lxaigz.png" class="${colorClass}" style="width:${size[0]}px; height:${size[1]}px;">`,
    iconSize: size, iconAnchor: [size[0] / 2, size[1]], popupAnchor: [0, -size[1]]
});

// --- STATE ---
let deviceMarker = null;
let subscription = null;
let isFirstLoad = true;

const deviceInput = document.getElementById('device-id');
const statusBadge = document.getElementById('status-badge');
const footerMsg = document.getElementById('footer-msg');

window.logout =function() {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = "../html/loginPage.html";
}

// --- INIT ---
const storedImei = localStorage.getItem('lastImei') || "";
if (storedImei) {
    deviceInput.value = storedImei;
    initConnection(storedImei);
}

document.getElementById('set-btn').addEventListener('click', () => {
    const id = deviceInput.value.trim();
    if (id) {
        localStorage.setItem('lastImei', id);
        initConnection(id);
    }
});

// --- CORE LOGIC ---

async function initConnection(imei) {
    // Reset UI for connection attempt
    isFirstLoad = true;
    updateStatusBadge('connecting');

    if (subscription) {
        subscription.unsubscribe();
        subscription = null;
    }

    // 1. Fetch Initial Data
    await fetchInitialData(imei);

    // 2. Start Subscription (Regardless of offline/online, we listen for new data)
    startSubscription(imei);
}

async function fetchInitialData(imei) {
    const getQuery = `
        query GetStatus($imei: String!) {
            getVehicleLastStatus(imei: $imei) {
                imei latitude longitude speed_gnss ignition 
                timestamp battery_voltage_v heading total_odometer_m
                gnss_status satellites altitude active_gsm_operator gsm_signal_strength
            }
        }`;

    try {
        const response = await client.graphql({
            query: getQuery,
            variables: { imei: imei }
        });

        const data = response.data.getVehicleLastStatus;

        if (data) {
            handleNewData(data);
        } else {
            // Case: Device ID Not Found
            clearAllData();
            updateStatusBadge('not_found');
            document.getElementById('panel-imei').innerText = imei;
        }
    } catch (err) {
        console.error("Init Error:", err);
        updateStatusBadge('offline', "Connection Error");
    }
}

function startSubscription(imei) {
    const subQuery = `
        subscription OnUpdate($imei: String!) {
            onVehicleUpdate(imei: $imei) {
                imei latitude longitude speed_gnss ignition 
                timestamp battery_voltage_v heading total_odometer_m
                gnss_status satellites altitude active_gsm_operator gsm_signal_strength
            }
        }`;

    subscription = client.graphql({
        query: subQuery,
        variables: { imei: imei }
    }).subscribe({
        next: ({ data }) => {
            const v = data.onVehicleUpdate;
            if (v) handleNewData(v);
        },
        error: (err) => {
            console.error("Sub Error:", err);
        }
    });
}

// --- LOGIC HANDLERS ---

function handleNewData(data) {
    const now = Date.now();
    const lastPing = parseInt(data.timestamp); // Assuming timestamp is epoch ms
    const diff = now - lastPing;

    // Determine Status based on Time
    if (diff > OFFLINE_THRESHOLD_MS) {
        updateStatusBadge('offline', "Device is offline");
    } else {
        updateStatusBadge('live');
    }

    updateDashboard(data);
}

// --- UI UPDATERS ---

function updateStatusBadge(status, msg = "") {
    // Reset classes
    statusBadge.className = "status-badge";

    if (status === 'live') {
        statusBadge.innerText = "ONLINE";
        statusBadge.classList.add('badge-live');
        footerMsg.innerText = "Socket Connected | Live Data";
        footerMsg.className = "text-[10px] uppercase tracking-widest text-green-600 font-bold";
    }
    else if (status === 'offline') {
        statusBadge.innerText = "OFFLINE";
        statusBadge.classList.add('badge-offline');
        footerMsg.innerText = msg || "Device Offline";
        footerMsg.className = "text-[10px] uppercase tracking-widest text-red-500 font-bold";
    }
    else if (status === 'not_found') {
        statusBadge.innerText = "NOT FOUND";
        statusBadge.classList.add('badge-notfound');
        footerMsg.innerText = "Device ID Not Registered";
        footerMsg.className = "text-[10px] uppercase tracking-widest text-slate-500 font-bold";
    }
    else if (status === 'connecting') {
        statusBadge.innerText = "CONNECTING";
        statusBadge.classList.add('badge-waiting');
        footerMsg.innerText = "Establishing Connection...";
        footerMsg.className = "text-[10px] uppercase tracking-widest text-blue-500 font-bold";
    }
}

function clearAllData() {
    if (deviceMarker) {
        map.removeLayer(deviceMarker);
        deviceMarker = null;
    }
    // Clear Panel Data
    document.getElementById('panel-ping').innerText = "--";
    document.getElementById('panel-imei').innerText = "--";

    // Clear Telemetry
    document.getElementById('speed').innerText = "0";
    document.getElementById('odo').innerText = "0.00 km";
    document.getElementById('movement').innerText = "--";
    document.getElementById('ignition').innerText = "N/A";
    document.getElementById('ignition').className = "inline-block px-3 py-1 rounded-full text-[9px] font-black bg-slate-100 text-slate-400 uppercase";

    // Clear Diagnostics
    document.getElementById('sats').innerText = "--";
    document.getElementById('battery').innerText = "--";
    document.getElementById('alt').innerText = "--";
    document.getElementById('gnss-status').innerText = "--";
    document.getElementById('operator').innerText = "--";

    // Reset Bars
    const bars = document.getElementById('signal-bars').querySelectorAll('.sig-bar');
    bars.forEach(bar => bar.classList.remove('active'));
}

function updateDashboard(data) {
    if (!data.latitude) return;

    const pos = [parseFloat(data.latitude), parseFloat(data.longitude)];

    // 1. Map Logic
    if (!deviceMarker) {
        deviceMarker = L.marker(pos, { icon: createCenteredIcon('marker-blue', [45, 45]) }).addTo(map);
        map.setView(pos, 15);
        isFirstLoad = false;
    } else {
        deviceMarker.setLatLng(pos);
        if (isFirstLoad) {
            map.setView(pos, 15);
            isFirstLoad = false;
        } else {
            map.panTo(pos);
        }
    }

    deviceMarker.bindPopup(`<b>IMEI:</b> ${data.imei}<br>Last seen: ${new Date(parseInt(data.timestamp)).toLocaleTimeString()}`);

    // 2. Status Panel Updates
    document.getElementById('panel-imei').innerText = data.imei;
    const timeStr = data.timestamp ? new Date(parseInt(data.timestamp)).toLocaleString() : "--";
    document.getElementById('panel-ping').innerText = timeStr;


    // Determine color class based on total strength
    // --- 3. GSM Signal Logic ---
    const gsmVal = parseInt(data.gsm_signal_strength) || 0;
    const bars = document.getElementById('signal-bars').querySelectorAll('.sig-bar');

    // Map the numeric value to a color name
    let colorClass = "very-poor";
    if (gsmVal >= 5) colorClass = "excellent";
    else if (gsmVal >= 4) colorClass = "good";
    else if (gsmVal >= 3) colorClass = "fair";
    else if (gsmVal >= 2) colorClass = "poor";

    bars.forEach((bar, i) => {
        // 1. Always keep the base 'sig-bar' class so it doesn't disappear
        // 2. Remove any previous color/active classes
        bar.classList.remove('active', 'excellent', 'good', 'fair', 'poor', 'very-poor');

        // 3. Add 'active' and the color class only if gsmVal is higher than this bar's index
        if (gsmVal > i) {
            bar.classList.add('active');
            bar.classList.add(colorClass);
        }
    });

    // 4. Telemetry Updates
    document.getElementById('speed').innerText = Math.round(data.speed_gnss || 0);
    const odoKm = (parseFloat(data.total_odometer_m) || 0) / 1000;
    document.getElementById('odo').innerText = odoKm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " km";

    const isMoving = data.speed_gnss > 2;
    document.getElementById('movement').innerText = isMoving ? "Moving" : "Stationary";
    document.getElementById('movement').className = `text-sm font-black uppercase ${isMoving ? 'text-blue-600' : 'text-slate-400'}`;

    const ign = document.getElementById('ignition');
    ign.innerText = data.ignition === 1 ? "IGNITION ON" : "IGNITION OFF";
    ign.className = `px-3 py-1 rounded-full text-[9px] font-black uppercase ${data.ignition === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;

    // 5. Diagnostics
    const gnssStatusMap = { 0: "GNSS OFF", 1: "GNSS ON (Fix)", 2: "GNSS ON (No Fix)", 3: "Sleep", 4: "Invalid" };
    document.getElementById('gnss-status').innerText = gnssStatusMap[data.gnss_status] || "Searching...";

    document.getElementById('sats').innerText = data.satellites || 0;
    document.getElementById('alt').innerText = (data.altitude || 0) + " m";
    document.getElementById('operator').innerText = OPERATOR_MAP[data.active_gsm_operator] || data.active_gsm_operator || "N/A";

    const v = parseFloat(data.battery_voltage_v) || 0;
    document.getElementById('battery').innerText = v.toFixed(2) / 1000 + " V";
    document.getElementById('battery-alert').classList.toggle('hidden', v >= 10);
}

// Fix map rendering on load
setTimeout(() => map.invalidateSize(), 500);