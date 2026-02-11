import { CONFIG } from "./config.js";

// 1. Initialize Map & Layers
const tripMap = L.map('trip-map').setView([30.0444, 31.2357], 6); // Default view (Egypt)
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

// 3. Load Trips Function
window.loadTrips = async function () {
    const imei = document.getElementById('device-id').value.trim();
    const fromDate = document.getElementById('from').value;
    const toDate = document.getElementById('to').value;
    const accountId = localStorage.getItem("accountId");

    if (!imei || !fromDate || !toDate) {
        alert("Please enter Device IMEI and select a date range.");
        return;
    }

    const btn = document.querySelector('button[onclick="loadTrips()"]');
    const list = document.getElementById('trip-list');

    // UI Loading State
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Searching...";
    }
    list.innerHTML = ""; // Clear previous results

    try {
        // Construct ISO timestamps for the API
        const startIso = new Date(fromDate).toISOString();
        const endIso = new Date(toDate).toISOString(); // Consider setting time to 23:59:59 for end date if needed

        const payload = {
            creator_id: accountId,
            action: "view_trips",
            body: {
                imei: imei,
                start_date: startIso,
                end_date: endIso
            }
        };

        const response = await fetch(CONFIG.api.tripUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        // 4. Handle Response
        // The API returns { statusCode: 200, body: "stringified_json" }
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
            throw new Error(data.message || "Failed to retrieve trips.");
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

// 5. Render Trip Card
function renderTripCard(trip, index) {
    const list = document.getElementById('trip-list');

    // Extract data from the new structure
    const tripData = trip.trip_data || {};
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

    // Attach event listener directly to pass the trip object safely
    card.querySelector('.view-route-btn').addEventListener('click', () => showMap(trip));

    list.appendChild(card);
}

// 6. Show Map Modal
function showMap(trip) {
    const modal = document.getElementById('map-modal');
    modal.classList.remove('hidden');

    // Wait for modal to be visible before resizing map
    setTimeout(() => {
        tripMap.invalidateSize();
    }, 100);

    // Clear previous layers
    pathLayer.clearLayers();

    const tripData = trip.trip_data || {};
    const points = tripData.points || []; // Points are now [[lat, lng], [lat, lng]]

    if (points.length === 0) {
        alert("No GPS points available for this trip.");
        return;
    }

    // Draw Polyline
    const correctedPoints = points.map(p => [p[1], p[0]]);
    const polyline = L.polyline(correctedPoints, { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(pathLayer);
    tripMap.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // Add Start/End Markers
    // Points structure is already [lat, lng], so we can access directly
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

// 7. Close Map Helper
window.closeMap = function () {
    document.getElementById('map-modal').classList.add('hidden');
};

// 8. Init Page (Load saved IMEI)
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const deviceIdFromProfile = params.get('imei');

    if (deviceIdFromProfile) {
        document.getElementById('device-id').value = deviceIdFromProfile;
        localStorage.setItem('lastImei', deviceIdFromProfile);
    }

    const today = new Date().toISOString().split('T')[0];

    document.getElementById('to').value = today;

});