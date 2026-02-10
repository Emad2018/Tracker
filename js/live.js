import { generateClient } from "https://esm.sh/aws-amplify@6/api";
import { Amplifyconfig, CONFIG } from "./config.js";
import { AuthService } from "./auth-service.js";

// 1. Auth Guard
if (!AuthService.isAuthenticated()) {
    window.location.href = CONFIG.routes.login;
}

const client = generateClient();
const map = L.map('map', { zoomControl: false }).setView([26.8206, 30.8025], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const createCenteredIcon = (size) => {
    // 1. Generate a random hue (0 to 360)
    const randomHue = Math.floor(Math.random() * 360);

    return L.divIcon({
        className: 'custom-car-icon-container',
        html: `
            <div style="
                width: 40px; 
                height: 40px; 
                border-radius: 50%; 
                overflow: hidden; 
                background: white; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            ">
                <img src="https://www.citypng.com/public/uploads/preview/car-vehicle-black-icon-png-7017516950346509uykpzmm9g.png" 
                     style="
                        width: 100%; 
                        height: 100%; 
                        object-fit: cover;
                        /* sepia(1) turns black into a brownish color so hue-rotate can work */
                        filter: sepia(1) saturate(10) hue-rotate(${randomHue}deg) brightness(0.7);
                     ">
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20], // Changed to 20,20 to keep it perfectly centered
        popupAnchor: [0, -20]
    });
};
// State
let allDevices = [];
let activeSubscriptions = {}; // Map: imei -> subscription object
let deviceMarkers = {};       // Map: imei -> Leaflet Marker
let deviceDataStore = {};     // Map: imei -> Last Data Object
let currentlyFocusedImei = null;

// Initialize
(async () => {
    await fetchFleet();

    // Check if URL has IMEI to auto-select
    const urlParams = new URLSearchParams(window.location.search);
    const preSelectImei = urlParams.get('imei');
    if (preSelectImei) {
        const checkbox = document.querySelector(`input[value="${preSelectImei}"]`);
        if (checkbox) {
            checkbox.checked = true;
            toggleDevice(preSelectImei, true);
        }
    }
})();

// --- 1. FETCH & RENDER FLEET ---
async function fetchFleet() {
    const listContainer = document.getElementById('fleet-list');
    const accountId = localStorage.getItem('accountId');

    try {
        const res = await fetch(CONFIG.api.deviceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creator_id: accountId, action: "list_all", body: {} })
        });
        const data = await res.json();

        if (data.devices) {
            allDevices = data.devices || [];
        }

        renderFleetList(listContainer);
    } catch (e) {
        console.error("Fleet load error", e);
        listContainer.innerHTML = `<div class="p-4 text-red-500 text-xs">Failed to load fleet</div>`;
    }
}

function renderFleetList(container) {
    container.innerHTML = "";
    if (allDevices.length === 0) {
        container.innerHTML = `<div class="p-4 text-slate-400 text-xs text-center">No devices found</div>`;
        return;
    }

    allDevices.forEach(d => {
        const item = document.createElement('div');
        item.className = "flex items-center p-3 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition cursor-pointer group";
        item.innerHTML = `
            <input type="checkbox" value="${d.imei}" class="device-check w-4 h-4 text-blue-600 rounded mr-3 cursor-pointer">
            <div class="flex-1" onclick="focusDevice('${d.imei}')">
                <div class="flex justify-between">
                    <span class="font-bold text-sm text-slate-800">${d.brand} <span class="font-normal text-slate-500 text-xs">(${d.color})</span></span>
                    <span id="status-${d.imei}" class="text-[9px] font-bold uppercase text-slate-400">OFFLINE</span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono">${d.imei}</div>
            </div>
        `;

        // Handle Checkbox (Subscribe/Unsubscribe)
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', (e) => toggleDevice(d.imei, e.target.checked));

        container.appendChild(item);
    });
}

// --- 2. SUBSCRIPTION MANAGEMENT ---
function toggleDevice(imei, isChecked) {
    if (isChecked) {
        if (!activeSubscriptions[imei]) {
            // 1. Get last known data immediately
            fetchInitialData(imei);
            // 2. Start live subscription
            subscribeToDevice(imei);
        }
    } else {
        if (activeSubscriptions[imei]) {
            activeSubscriptions[imei].unsubscribe();
            delete activeSubscriptions[imei];
        }
        if (deviceMarkers[imei]) {
            map.removeLayer(deviceMarkers[imei]);
            delete deviceMarkers[imei];
        }
    }
    updateMapBounds();
    updateActiveCount();
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
            // Update UI with historical/last data immediately
            updateDeviceData(imei, data);
        }
    } catch (err) {
        console.error("Initial Fetch Error:", err);
    }
}
function subscribeToDevice(imei) {
    const subQuery = `
        subscription OnUpdate($imei: String!) {
            onVehicleUpdate(imei: $imei) {
                imei latitude longitude speed_gnss ignition 
                timestamp battery_voltage_v heading total_odometer_m
                gnss_status satellites altitude active_gsm_operator gsm_signal_strength
            }
        }`;

    try {
        const sub = client.graphql({
            query: subQuery,
            variables: { imei: imei },

        }).subscribe({
            next: ({ data }) => {
                const tripData = data.onVehicleUpdate;
                updateDeviceData(imei, tripData);
            },
            error: (err) => console.error(`Sub error [${imei}]:`, err)
        });

        activeSubscriptions[imei] = sub;
    } catch (e) {
        console.error("Sub setup error", e);
    }
}

// --- 3. MAP & DATA UPDATE ---
function updateDeviceData(imei, data) {
    deviceDataStore[imei] = data;

    // 1. Update List Status
    const statusEl = document.getElementById(`status-${imei}`);
    if (statusEl) {
        statusEl.innerText = data.speed_gnss > 0 ? "MOVING" : "IDLE";
        statusEl.className = `text-[9px] font-bold uppercase ${data.speed_gnss > 0 ? 'text-green-600' : 'text-orange-500'}`;
    }

    // 2. Update/Create Marker
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    if (!lat || !lng) return;

    if (deviceMarkers[imei]) {
        // Move existing
        const marker = deviceMarkers[imei];
        marker.setLatLng([lat, lng]);
    } else {
        // Create New

        const marker = L.marker([lat, lng], { icon: createCenteredIcon(40) }).addTo(map);
        marker.on('click', () => focusDevice(imei));
        deviceMarkers[imei] = marker;
        updateMapBounds();
    }

    // 3. Update Panel if focused
    if (currentlyFocusedImei === imei) {
        renderPanel(imei);
    }
}

// Global scope for onclick
window.focusDevice = function (imei) {
    currentlyFocusedImei = imei;
    const checkbox = document.querySelector(`input[value="${imei}"]`);
    if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        toggleDevice(imei, true);
    }
    if (deviceMarkers[imei]) {
        map.setView(deviceMarkers[imei].getLatLng(), 15);
    }
    renderPanel(imei);
};
function renderPanel(imei) {
    const data = deviceDataStore[imei];
    const device = allDevices.find(d => d.imei === imei);
    if (!data || !device) return;

    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');

    document.getElementById('panel-name').innerText = device.brand;
    document.getElementById('panel-imei').innerText = imei;
    document.getElementById('panel-speed').innerHTML = `${Math.round(data.speed_gnss || 0)} <span class="text-[10px]">km/h</span>`;

    const ignEl = document.getElementById('panel-ign');
    ignEl.innerText = data.ignition ? "ON" : "OFF";
    ignEl.className = `text-xs font-bold mt-1 ${data.ignition ? 'text-green-600' : 'text-slate-400'}`;

    document.getElementById('panel-odo').innerText = (data.total_odometer_m || 0).toFixed(1) + " km";
    const gnssStatusMap = { 0: "GNSS OFF", 1: "GNSS ON (Fix)", 2: "GNSS ON (No Fix)", 3: "Sleep", 4: "Invalid" };
    document.getElementById('panel-gnss').innerText = gnssStatusMap[data.gnss_status] || "Unknown";
    document.getElementById('panel-batt').innerText = (data.battery_voltage_v / 1000).toFixed(1) + " V";
    document.getElementById('panel-sats').innerText = data.satellites;
    document.getElementById('panel-time').innerText = new Date(data.timestamp).toLocaleTimeString();
}

function updateMapBounds() {
    const markers = Object.values(deviceMarkers);
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function updateActiveCount() {
    document.getElementById('active-count').innerText = Object.keys(activeSubscriptions).length;
}