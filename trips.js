/**
 * TRIPS HISTORY LOGIC
 * Includes: Map Initialization, Marker Coloring, and Modal Fixes
 */

const TRIPS_API = "https://yjzamkco75.execute-api.us-east-1.amazonaws.com/production/trips";

// 1. Initialize the Modal Map
const tripMap = L.map('trip-map').setView([0, 0], 2);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
}).addTo(tripMap);

let pathLayer = L.layerGroup().addTo(tripMap);

// 2. Global State & Page Init
document.addEventListener('DOMContentLoaded', () => {
    const savedId = localStorage.getItem('lastDeviceId') || "2147483647";
    document.getElementById('device-id').value = savedId;

    // Default "From" to beginning of today, "To" to now
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('from').value = today;
    document.getElementById('to').value = today;
});

function saveDeviceId() {
    const id = document.getElementById('device-id').value.trim();
    if (id) {
        localStorage.setItem('lastDeviceId', id);
        loadTrips();
    } else {
        alert("Please enter a valid Device ID");
    }
}

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return "0 min";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

/**
 * UPDATED: Fetches trips using imei and millisecond timestamps
 */
async function loadTrips() {
    const imei = document.getElementById('device-id').value.trim();
    const fromStr = document.getElementById('from').value;
    const toStr = document.getElementById('to').value;
    const container = document.getElementById('trip-list');

    if (!imei || !fromStr || !toStr) {
        alert("Please ensure Device ID and both dates are selected.");
        return;
    }

    // Convert "YYYY-MM-DD" to Start of Day and End of Day (Milliseconds)
    const fromTs = new Date(fromStr + "T00:00:00").getTime();
    const toTs = new Date(toStr + "T23:59:59").getTime();

    container.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400 italic">Searching for trips...</div>`;

    try {
        // Change: Use 'imei' instead of 'deviceId'
        const url = `${TRIPS_API}?imei=${imei}&from=${fromTs}&to=${toTs}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error("Server error");

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
                <div class="text-[10px] text-slate-500 flex justify-between pt-2">
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

// viewTrip and closeMap functions remain unchanged...
function viewTrip(trip) {
    document.getElementById('map-modal').classList.remove('hidden');
    pathLayer.clearLayers();

    if (!trip.points || trip.points.length === 0) return;

    const latlngs = trip.points.map(p => [p.lat, p.lng]);
    const polyline = L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(pathLayer);

    const createCenteredIcon = (colorClass, size) => L.divIcon({
        className: '',
        html: `<img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="${colorClass}" style="width:${size[0]}px; height:${size[1]}px;">`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1]],
        popupAnchor: [0, -size[1]]
    });

    L.marker(latlngs[0], { icon: createCenteredIcon('marker-green', [25, 41]) })
        .addTo(pathLayer).bindPopup(`<b>Start</b>`).openPopup();

    L.marker(latlngs[latlngs.length - 1], { icon: createCenteredIcon('marker-red', [25, 41]) })
        .addTo(pathLayer).bindPopup(`<b>End</b>`);

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

function closeMap() {
    document.getElementById('map-modal').classList.add('hidden');
}