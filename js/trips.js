import { CONFIG } from "./config.js";

// 1. Initialize Map & Layers
const tripMap = L.map('trip-map').setView([30.0444, 31.2357], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
}).addTo(tripMap);

let pathLayer = L.layerGroup().addTo(tripMap);

// 2. Auth Guard & Logout
if (!localStorage.getItem("authToken")) {
    window.location.href = CONFIG.routes.login;
}

window.logout = function () {
    localStorage.clear();
    window.location.href = CONFIG.routes.login;
};

// --- NEW FUNCTION: Populate Dropdown ---
// In trips.js, replace the populateDeviceDropdown function:

async function populateDeviceDropdown() {
    const select = document.getElementById('device-id');
    const accountId = localStorage.getItem('accountId');
    const company_id = localStorage.getItem('company_id');
    const params = new URLSearchParams(window.location.search);
    const preSelectedImei = params.get('imei');

    try {
        const res = await fetch(CONFIG.api.fleetUrl, { // Changed to fleetUrl
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth: { account_id: accountId, company_id: company_id },
                operation: "list_fleets",
                body: { company_id: company_id }
            })
        });

        const data = await res.json();
        const fleets = data.fleets || [];

        select.innerHTML = '<option value="" disabled selected>Select a Vehicle</option>';

        if (fleets.length === 0) {
            select.innerHTML += `<option value="" disabled>No vehicles found</option>`;
            return;
        }

        fleets.forEach(fleet => {
            if (!fleet.vehicles || fleet.vehicles.length === 0) return;

            // Create group for the fleet
            const optgroup = document.createElement('optgroup');
            optgroup.label = fleet.name;

            fleet.vehicles.forEach(d => {
                const option = document.createElement('option');
                option.value = d.imei;
                option.text = `${d.brand || d.name} - ${d.Plate_Number || d.imei}`;

                if (d.imei === preSelectedImei) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        });

    } catch (e) {
        console.error("Error loading fleets:", e);
        select.innerHTML = '<option value="" disabled>Error loading list</option>';
    }
}

// 3. Load Trips Function
window.loadTrips = async function () {
    const imei = document.getElementById('device-id').value; // Now gets value from select
    const fromDate = document.getElementById('from').value;
    const toDate = document.getElementById('to').value;
    const accountId = localStorage.getItem("accountId");
    const company_id = localStorage.getItem('company_id');

    if (!imei || !fromDate || !toDate) {
        alert("Please select a Vehicle and a date range.");
        return;
    }

    const btn = document.querySelector('button[onclick="loadTrips()"]');
    const list = document.getElementById('trip-list');

    // UI Loading State
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Searching...";
    }
    list.innerHTML = "";

    try {
        const startIso = new Date(fromDate + "T00:00:00").toISOString();
        const endIso = new Date(toDate + "T23:59:59").toISOString();
        const payload = {
            auth: { account_id: accountId, company_id: company_id },
            operation: "view_trips",
            body: {
                imei: imei,
                company_id: company_id,
                from: startIso,
                to: endIso
            }
        };

        const response = await fetch(CONFIG.api.tripUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.status === 200 && data.trips) {
            const trips = data.trips || [];

            if (trips.length === 0) {
                list.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10">No trips found for this period.</div>`;
            } else {
                trips.forEach((trip, index) => {
                    renderTripCard(trip, index + 1);
                });
            }
        } else {
            throw new Error(data.error || "Failed to retrieve trips.");
        }

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class="col-span-full text-center text-red-500 py-10">Error: ${err.message}</div>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Search Trips";
        }
    }
};

// 5. Render Trip Card (No changes needed, kept for context)
function renderTripCard(trip, index) {
    const list = document.getElementById('trip-list');
    const tripData = trip.trip_stats || {};
    const distance = tripData.distance_km ? tripData.distance_km.toFixed(2) : '0.00';
    const duration = tripData.duration_seconds ? (tripData.duration_seconds / 60).toFixed(0) : '0';

    const startTime = new Date(trip.start_date).toLocaleString();
    const endTime = trip.end_date ? new Date(trip.end_date).toLocaleString() : "In Progress";

    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition";
    card.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div class="bg-indigo-50 text-indigo-700 font-black px-3 py-1 rounded-lg text-xs">TRIP #${index}</div>
            <div class="text-right">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DISTANCE</div>
                <div class="text-sm font-bold text-slate-800">${distance} KM</div>
            </div>
        </div>
        
        <div class="space-y-3 mb-4">
            <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">Start Time</p>
                    <p class="text-xs font-bold text-slate-700">${startTime}</p>
                </div>
            </div>
            <div class="h-4 border-l border-slate-200 ml-[3px]"></div>
            <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0"></div>
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">End Time</p>
                    <p class="text-xs font-bold text-slate-700">${endTime}</p>
                </div>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-1.5 rounded-full bg-black shrink-0"></div>
                <div>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                    <p class="text-xs font-bold text-slate-700">${duration} min</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-500 border-t pt-3 mb-3">
            <div>Avg Speed: <span class="font-bold text-slate-700">${tripData.avg_speed || 0} km/h</span></div>
            <div>Max Speed: <span class="font-bold text-slate-700">${tripData.peak_speed || 0} km/h</span></div>
        </div>

        <button class="view-route-btn w-full bg-slate-900 text-white py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">
            VIEW ROUTE
        </button>
    `;

    card.querySelector('.view-route-btn').addEventListener('click', () => showMap(trip));
    list.appendChild(card);
}

// 6. Show Map Modal
function showMap(trip) {
    const modal = document.getElementById('map-modal');
    modal.classList.remove('hidden');

    setTimeout(() => {
        tripMap.invalidateSize();
    }, 100);

    pathLayer.clearLayers();

    const tripData = trip.trip_stats || {};
    const points = tripData.points || [];

    if (points.length === 0) {
        alert("No GPS points available for this trip.");
        return;
    }

    const correctedPoints = points.map(p => [p[1], p[0]]);
    const polyline = L.polyline(correctedPoints, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(pathLayer);
    tripMap.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    const startPoint = correctedPoints[0];
    const endPoint = correctedPoints[correctedPoints.length - 1];
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    L.marker(startPoint).addTo(pathLayer)
        .bindPopup(`<b>Start</b><br>${new Date(trip.start_date).toLocaleTimeString()}`);

    L.marker(endPoint, { icon: redIcon }).addTo(pathLayer)
        .bindPopup(`<b>End</b><br>${new Date(trip.end_date).toLocaleTimeString()}`);
}

window.closeMap = function () {
    document.getElementById('map-modal').classList.add('hidden');
};

// 8. Init Page
document.addEventListener('DOMContentLoaded', () => {
    // Set default To Date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('to').value = today;

    // Populate dropdown with devices
    populateDeviceDropdown();
});