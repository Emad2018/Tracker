const API_BASE = "https://yjzamkco75.execute-api.us-east-1.amazonaws.com/Dev";

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
  loadDevices();
    const editBtn = document.getElementById("editToggle");
     const addPanel = document.getElementById("add-panel");


    editBtn.addEventListener("click", () => {
    addPanel.classList.toggle("hidden");
    editBtn.innerText = isHidden ? "EDIT" : "CANCEL";
  });
});

/**
 * Format a JS Date object to "DD-MM-YYYY hh:mm:ss AM/PM"
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted date string
 */
function formatDateTime(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  const h24 = d.getHours();
  const h12 = h24 % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';

  return `${day}-${month}-${year} ${h12}:${m}:${s} ${ampm}`;
}


window.logout =function() {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = "../html/loginPage.html";
}

function checkDeviceActive(data) {
  if (!data.timestamp) return false;

  const deviceTime = new Date(data.timestamp.replace(" ", "T"));
  const now = new Date();
  let is_active = false;
  const diffMinutes = Math.floor((now - deviceTime) / 60000);
  if (diffMinutes > 15) {
    is_active = false;
  } else {
    is_active = true;
  }
  return is_active;
}

async function loadProfile() {
  const res = await fetch(`${API_BASE}/profile`, {
    headers: { "Authorization": "Bearer " + localStorage.getItem("idToken") }
  });
  const profile = await res.json();
  console.log("this is profile",profile);
    const email = profile.email || "No email";
    const username = email.split("@")[0];

  document.getElementById("username").innerText = username;
  document.getElementById("email").innerText = profile.email || "No email";
  const avatarLetterEl = document.getElementById("avatar-letter");
    if (avatarLetterEl) {
      avatarLetterEl.innerText = username.charAt(0).toUpperCase();
    }
  // document.getElementById("user-id").innerText = profile.userId;
  document.getElementById("created").innerText =formatDateTime(profile.createdAt);

}


async function loadDevices() {
  const res = await fetch(`${API_BASE}/devices`, {
    headers: { "Authorization": "Bearer " + localStorage.getItem("idToken") }
  });
  const devices = await res.json();
  console.log("this is devices",devices);
  

  const list = document.getElementById("device-list");
  const emptyMsg = document.getElementById("no-devices");

  list.innerHTML = "";

  if (!devices.length) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

    devices.forEach(device => {
    const status = checkDeviceActive(device); // calculate real status

    const row = document.createElement("div");
    row.className = "grid grid-cols-[2fr_1fr_2fr_3fr] items-center bg-slate-50 border border-slate-100 rounded-xl p-3 hover:shadow-md transition";

    row.innerHTML = `
      <span class="font-mono text-sm font-black text-slate-800">${device.deviceId}</span>

      <span class="text-[10px] font-black px-2 py-1 rounded-full 
      ${status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">
      ${status ? "ACTIVE" : "INACTIVE"}
      </span>

      <span class="text-[11px] font-bold text-slate-600">
      ${formatDateTime(device.lastUpdate)}
      </span>

      <div class="flex gap-2 justify-end">
          <a href="../html/live.html?device=${device.deviceId}"
              class="text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition whitespace-nowrap">
              TRACK
          </a>

          <a href="../html/trips.html?device=${device.deviceId}"
              class="text-[10px] font-black bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition whitespace-nowrap">
              HISTORY
          </a>

          <button onclick="deleteDevice('${device.deviceId}')"
              class="text-[10px] font-black bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg transition whitespace-nowrap">
              DELETE
          </button>
      </div>
  `;



    list.appendChild(row);
    });

}

async function addDevice() {
  // Get the value from the input field instead of prompt
  const input = document.getElementById("newDeviceId");
  const id = input.value.trim();
  if (!id) return; // do nothing if empty

  try {
    const res = await fetch(`${API_BASE}/devices`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("idToken"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ deviceId: id })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Error adding device:", err);
      alert("Failed to add device: " + (err.error || "Unknown error"));
      return;
    }

    // Clear the input field after success
    input.value = "";

    // Reload the device list
    loadDevices();
  } catch (err) {
    console.error(err);
    alert("Failed to add device: " + err.message);
  }
}


async function deleteDevice(deviceId) {
  try {
    const res = await fetch(`${API_BASE}/devices`, {
      method: "DELETE",
      headers: {
        "Authorization": "Bearer " + localStorage.getItem("idToken"),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ deviceId })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Error deleting device:", err);
      alert("Failed to delete device: " + (err.error || "Unknown error"));
      return;
    }

    // Reload the devices list after deletion
    loadDevices();
  } catch (err) {
    console.error(err);
    alert("Failed to delete device: " + err.message);
  }
}
