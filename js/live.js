import { Amplify } from "https://cdn.skypack.dev/aws-amplify";
import { generateClient } from "https://cdn.skypack.dev/aws-amplify/api";
import { CONFIG } from "./config.js";
import { AuthService } from "./auth-service.js";

// 1. Auth Guard
if (!AuthService.isAuthenticated()) {
    window.location.href = CONFIG.routes.login;
}
window.logout = () => {
    AuthService.logout();
};
Amplify.configure(CONFIG.amplifyConfig);
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
    const company_id = localStorage.getItem('company_id');

    try {
        const res = await fetch(CONFIG.api.deviceUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: accountId,
                operation: "list",
                body: { company_id: company_id }
            })
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
    const isonline = getDeviceStatus(data.timestamp); // Update internal status based on timestamp
    if (statusEl) {
        statusEl.innerText = isonline ? (data.speed_gnss > 0 ? "MOVING" : "IDLE") : "OFFLINE";
        statusEl.className = `text-[9px] font-bold uppercase ${isonline ? (data.speed_gnss > 0 ? 'text-green-600' : 'text-orange-500') : 'text-red-500'}`;
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
    document.getElementById('panel-time').innerText = new Date(data.timestamp).toISOString();

    // --- NEW: Setup Action Buttons ---
    setupActionButtons(imei);
}
const vehicleStates = {};

function setupActionButtons(imei) {
    // Initialize state if not present
    if (!vehicleStates[imei]) {
        vehicleStates[imei] = {
            tripActive: false, // Default assumption
            locked: false      // Default assumption
        };
    }

    const state = vehicleStates[imei];
    const messageEl = document.getElementById('action-message');
    const btnTrip = document.getElementById('btn-trip');
    const btnLock = document.getElementById('btn-lock');

    // Clear previous messages
    messageEl.innerText = "";
    messageEl.className = "text-[10px] text-center font-bold mb-2 min-h-[15px]";

    // 1. Configure Trip Button
    updateTripButtonUI(btnTrip, state.tripActive);

    // Remove old listeners (cloning replaces the node to strip listeners)
    const newBtnTrip = btnTrip.cloneNode(true);
    btnTrip.parentNode.replaceChild(newBtnTrip, btnTrip);

    newBtnTrip.onclick = () => handleTripAction(imei, newBtnTrip, messageEl);

    // 2. Configure Lock Button
    updateLockButtonUI(btnLock, state.locked);

    const newBtnLock = btnLock.cloneNode(true);
    btnLock.parentNode.replaceChild(newBtnLock, btnLock);

    newBtnLock.onclick = () => handleLockAction(imei, newBtnLock, messageEl);
}

function updateTripButtonUI(btn, isActive) {
    if (isActive) {
        btn.innerText = "END TRIP";
        btn.className = "py-2 px-3 rounded-lg text-xs font-bold text-white transition shadow-md bg-red-600 hover:bg-red-700 w-full";
    } else {
        btn.innerText = "START TRIP";
        btn.className = "py-2 px-3 rounded-lg text-xs font-bold text-white transition shadow-md bg-emerald-500 hover:bg-emerald-600 w-full";
    }
}

function updateLockButtonUI(btn, isLocked) {
    if (isLocked) {
        btn.innerText = "UNLOCK";
        btn.className = "py-2 px-3 rounded-lg text-xs font-bold text-white transition shadow-md bg-emerald-500 hover:bg-emerald-600 w-full";
    } else {
        btn.innerText = "LOCK";
        btn.className = "py-2 px-3 rounded-lg text-xs font-bold text-white transition shadow-md bg-red-600 hover:bg-red-700 w-full";
    }
}

async function handleTripAction(imei, btn, msgEl) {
    const timestamp = deviceDataStore[imei].timestamp;
    if (!activeSubscriptions[imei] || !getDeviceStatus(timestamp)) {
        msgEl.innerText = "Device must be active to start trip";
        msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
        return;
    }
    const currentState = vehicleStates[imei].tripActive;
    const accountId = localStorage.getItem('accountId');
    const companyId = localStorage.getItem('company_id');

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    msgEl.innerText = "Processing...";
    msgEl.className = "text-[10px] text-center font-bold mb-2 text-slate-500";

    const payload = {
        creator_id: accountId, // Used for start_trip
        operation: currentState ? "end_trip" : "start_trip",
        body: {
            imei: imei,
            company_id: companyId
        }
    };

    // Add specific fields for start_trip
    if (!currentState) {
        payload.body.driver_id = accountId;
        payload.body.client_id = "";
    }

    try {
        const res = await fetch(CONFIG.api.tripUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        let success = false;

        // Check for specific "Already active" error to auto-switch state
        // Note: Adjust the check based on exact API error structure
        const responseString = JSON.stringify(data);

        if (responseString.includes("already has an active trip")) {
            // Logic requirement: Show message and switch button to Red (Active)
            msgEl.innerText = `Vehicle ${imei} already has an active trip.`;
            msgEl.className = "text-[10px] text-center font-bold mb-2 text-orange-500";

            vehicleStates[imei].tripActive = true; // Force state to active
            updateTripButtonUI(btn, true);
        }
        else if (res.ok || (data.statusCode >= 200 && data.statusCode < 300)) {
            success = true;
            vehicleStates[imei].tripActive = !currentState;
            updateTripButtonUI(btn, vehicleStates[imei].tripActive);
            msgEl.innerText = currentState ? "Trip Ended" : "Trip Started";
            msgEl.className = "text-[10px] text-center font-bold mb-2 text-green-600";
        } else {
            msgEl.innerText = "Request Failed";
            msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
        }

    } catch (e) {
        console.error(e);
        msgEl.innerText = "Network Error";
        msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

async function handleLockAction(imei, btn, msgEl) {

    const timestamp = deviceDataStore[imei].timestamp;
    if (!activeSubscriptions[imei] || !getDeviceStatus(timestamp)) {
        msgEl.innerText = "Device must be active to lock/unlock";
        msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
        return;
    }
    const isLocked = vehicleStates[imei].locked; // Currently locked?
    const accountId = localStorage.getItem('accountId');
    const companyId = localStorage.getItem('company_id');

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    msgEl.innerText = "Processing...";

    // If currently locked, we want to UNLOCK. If unlocked, we want to LOCK.
    const operation = isLocked ? "unlock" : "lock";

    const payload = {
        id: accountId,
        operation: operation,
        body: {
            imei: imei,
            company_id: companyId
        }
    };

    try {
        const res = await fetch(CONFIG.api.lockUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.status == 200) {
            // Toggle state
            vehicleStates[imei].locked = !isLocked;
            updateLockButtonUI(btn, vehicleStates[imei].locked);

            msgEl.innerText = data || (isLocked ? "Vehicle Unlocked" : "Vehicle Locked");
            msgEl.className = "text-[10px] text-center font-bold mb-2 text-green-600";
        } else {
            msgEl.innerText = "Lock Action Failed";
            msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
        }

    } catch (e) {
        console.error(e);
        msgEl.innerText = "Network Error";
        msgEl.className = "text-[10px] text-center font-bold mb-2 text-red-500";
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
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

// Helper to determine if a device is Online or Offline (5 min threshold)
function getDeviceStatus(timestamp) {
    if (!timestamp) return false;

    const lastSeen = new Date(timestamp).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastSeen) / 1000 / 60;

    // 5-minute threshold check
    if (diffMinutes > 5) {
        return false;
    }

    // If online, differentiate between Moving and Idle
    return true;
}