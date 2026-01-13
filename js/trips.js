/**
 * TRIPS HISTORY LOGIC
 * Includes: Map Initialization, Marker Coloring, and Modal Fixes
 */

const TRIPS_API = "https://yjzamkco75.execute-api.us-east-1.amazonaws.com/production/trips";

// 1. Initialize the Modal Map
// We set a world view initially; it will be updated when a trip is clicked.
const tripMap = L.map('trip-map').setView([0, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
}).addTo(tripMap);

// Layer group to hold the path and markers so we can clear them easily
let pathLayer = L.layerGroup().addTo(tripMap);

// 2. Global State & Page Init
document.addEventListener('DOMContentLoaded', () => {
    // Load last used Device ID
    const savedId = localStorage.getItem('lastDeviceId') || "2147483647";
    document.getElementById('device-id').value = savedId;

    // Set default "To" date to today
    document.getElementById('to').value = new Date().toISOString().split('T')[0];
});

/**
 * Logs out the user by clearing tokens and redirecting to login page
**/
function logout() {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = "loginPage.html";
}

/**
 * Saves Device ID to local storage and refreshes the list
 */
function saveDeviceId() {
    const id = document.getElementById('device-id').value.trim();
    if (id) {
        localStorage.setItem('lastDeviceId', id);
        loadTrips();
    } else {
        alert("Please enter a valid Device ID");
    }
}

/**
 * Formats seconds into a human-readable string (e.g., 1h 20m)
 */
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return "0 min";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/**
 * Fetches trips from API and renders the cards
 */
async function loadTrips() {
    const id = document.getElementById('device-id').value.trim();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const container = document.getElementById('trip-list');

    if (!id || !from || !to) {
        alert("Please ensure Device ID and both dates are selected.");
        return;
    }

    container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400 italic">Searching for trips...</div>`;

    try {
        const res = await fetch(`${TRIPS_API}?deviceId=${id}&from=${from}&to=${to}`);
        const trips = await res.json();

        if (!trips || trips.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400">No trips found for this period.</div>`;
            return;
        }

        container.innerHTML = trips.map(t => {
            const stopCount = t.stopSegments ? t.stopSegments.length : 0;
            return `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition group" onclick='viewTrip(${JSON.stringify(t)})'>
                <div class="mb-4">
                    <p class="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Trip Period</p>
                    <p class="text-xs font-semibold text-slate-900">Start: ${new Date(t.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p class="text-xs font-semibold text-slate-900">End: ${new Date(t.endTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 py-3 border-y border-slate-50 text-center">
                    <div class="bg-slate-50 p-2 rounded-xl"><p class="text-[9px] text-slate-400 uppercase font-bold">Distance</p><p class="font-bold text-sm text-slate-800">${(t.distance_m / 1000).toFixed(2)} km</p></div>
                    <div class="bg-slate-50 p-2 rounded-xl"><p class="text-[9px] text-slate-400 uppercase font-bold">Avg Speed</p><p class="font-bold text-sm text-slate-800">${t.avg_speed} km/h</p></div>
                    <div class="bg-slate-50 p-2 rounded-xl"><p class="text-[9px] text-slate-400 uppercase font-bold">Duration</p><p class="font-bold text-sm text-slate-800">${formatDuration(t.duration_sec)}</p></div>
                    <div class="bg-slate-50 p-2 rounded-xl"><p class="text-[9px] text-slate-400 uppercase font-bold">Stops</p><p class="font-bold text-sm text-slate-800">${stopCount}</p></div>
                </div>
                <div class="text-[10px] text-slate-500 flex justify-between">
                    <span>Peak: ${t.max_speed} km/h</span>
                </div>
                <button class="w-full mt-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">View Route Path</button>
            </div>
        `;
        }).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="col-span-full text-center py-20 text-red-500 font-bold">Error connecting to server.</div>`;
    }
}

/**
 * Handles Modal Display and Map Centering Fix
 */
function viewTrip(trip) {
    document.getElementById('map-modal').classList.remove('hidden');
    pathLayer.clearLayers();

    if (!trip.points || trip.points.length === 0) return;

    const latlngs = trip.points.map(p => [p.lat, p.lng]);
    const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(pathLayer);

    // Updated helper to handle iconAnchor AND popupAnchor
    const createCenteredIcon = (colorClass, size) => L.divIcon({
        className: '',
        html: `<img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="${colorClass}" style="width:${size[0]}px; height:${size[1]}px;">`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1]], // Tip of the pin
        popupAnchor: [0, -size[1]]           // Top center of the pin
    });

    // Start Marker
    L.marker(latlngs[0], { icon: createCenteredIcon('marker-green', [25, 41]) })
        .addTo(pathLayer).bindPopup(`<b>Start</b>`).openPopup();

    // End Marker
    L.marker(latlngs[latlngs.length - 1], { icon: createCenteredIcon('marker-red', [25, 41]) })
        .addTo(pathLayer).bindPopup(`<b>End</b>`);

    // Stops
    if (trip.stopSegments) {
        trip.stopSegments.forEach((s, idx) => {
            L.marker([s.location.lat, s.location.lng], { icon: createCenteredIcon('marker-orange', [20, 32]) })
                .addTo(pathLayer).bindPopup(`<b>Stop ${idx + 1}</b><br>Duration: ${Math.round(s.duration_sec / 60)}m`);
        });
    }

    setTimeout(() => {
        tripMap.invalidateSize();
        tripMap.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 16 });
    }, 250);
}

/**
 * Closes the modal
 */
function closeMap() {
    document.getElementById('map-modal').classList.add('hidden');
}