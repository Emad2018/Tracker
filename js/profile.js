import { CONFIG } from './config.js';
import { AuthService } from './auth-service.js';

// --- GLOBAL EXPOSURE ---
// We attach these to 'window' immediately so HTML onclick events can find them
if (!AuthService.isAuthenticated()) {
  window.location.href = CONFIG.routes.login;
}
window.logout = () => {
  AuthService.logout();
};

window.loadDevices = loadDevices;

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadDevices();
});

function loadProfile() {
  const profileStr = localStorage.getItem("userProfile");
  if (!profileStr) return;

  try {
    const p = JSON.parse(profileStr);
    setText("p-name", p.name);
    setText("p-email", p.email);
    setText("p-company", p.company_name || "N/A");
    const initials = p.name.split(" ").map(n => n.charAt(0).toUpperCase()).join("");
    setText("avatar-letter", initials);
    const role = p.role || "User";
    setText("p-role", role.replace('_', ' ').toUpperCase());
  } catch (e) {
    console.error("Error parsing profile:", e);
  }
}

// In profile.js, replace the loadDevices function:

async function loadDevices() {
  const listContainer = document.getElementById('device-list');
  const accountId = localStorage.getItem('accountId');
  const company_id = localStorage.getItem('company_id');

  listContainer.innerHTML = `
    <div class="col-span-full flex justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>`;

  try {
    // Change to fleetUrl
    const res = await fetch(CONFIG.api.fleetUrl, {
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

    if (fleets.length === 0) {
      listContainer.innerHTML = `<p class="col-span-full text-center text-slate-400 py-10">No fleets found.</p>`;
      return;
    }

    // Inside profile.js -> loadDevices()

    let html = '';
    let globalCardIndex = 0; // Used to stagger animations

    fleets.forEach((fleet) => {
      if (fleet.vehicles && fleet.vehicles.length > 0) {

        // Add Fleet Header with animation
        html += `
            <div class="col-span-full mt-4 mb-2 border-b border-slate-200 pb-2 flex justify-between items-end animate-fade-slide" style="opacity: 0; animation-delay: ${globalCardIndex * 0.05}s;">
                <h3 class="text-xl font-black text-slate-800">${fleet.name}</h3>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${fleet.vehicle_count} Vehicles</span>
            </div>`;
        globalCardIndex++;

        // Add Vehicle Cards with staggered animation
        html += fleet.vehicles.map(d => {
          const cardDelay = globalCardIndex * 0.05;
          globalCardIndex++;
          return `
              <div class="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-50 hover:shadow-xl transition-all group flex flex-col justify-between animate-fade-slide" style="opacity: 0; animation-delay: ${cardDelay}s;">
                  <div>
                      <div class="flex justify-between items-start mb-4">
                          <div class="bg-slate-900 p-3 rounded-2xl">
                              <svg class="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                          </div>
                          <div class="flex flex-col items-end space-y-1">
                              <a href="live.html?imei=${d.imei}" class="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-tighter">
                                  Track Live →
                              </a>
                              <a href="trips.html?imei=${d.imei}" class="text-[10px] font-black text-pink-600 hover:text-pink-800 uppercase tracking-tighter">
                                  Trip History →
                              </a>
                          </div>
                      </div>

                      <h3 class="font-black text-slate-800 text-lg leading-tight">${d.brand || d.name}</h3>
                      <p class="text-slate-400 text-[11px] font-mono mb-4">Plate: ${d.Plate_Number || 'N/A'}</p>
                      
                      <div class="grid grid-cols-2 gap-2 mb-4">
                          <div class="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <span class="block text-[8px] uppercase font-black text-slate-400 mb-0.5">Color</span>
                              <span class="text-xs font-bold text-slate-700">${d.color || 'Standard'}</span>
                          </div>
                          <div class="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                              <span class="block text-[8px] uppercase font-black text-slate-400 mb-0.5">Type</span>
                              <span class="text-xs font-bold text-slate-700">${d.type || 'Tracker'}</span>
                          </div>
                      </div>
                  </div>
                  
                  <div class="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                      <div class="flex items-center space-x-2">
                          <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          <span class="text-[9px] font-black text-slate-500 uppercase">System Active</span>
                      </div>
                      <span class="text-[9px] bg-slate-100 px-2 py-1 rounded-lg font-bold text-slate-600">ID: ${d.imei || 'N/A'}</span>
                  </div>
              </div>
            `;
        }).join('');
      }
    });

    listContainer.innerHTML = html || `<p class="col-span-full text-center text-slate-400 py-10">No vehicles found in your fleets.</p>`;

  } catch (e) {
    console.error("Device load error", e);
    listContainer.innerHTML = `<p class="col-span-full text-red-500 text-center py-10 font-bold">Failed to refresh fleet data.</p>`;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val || "--";
}