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

async function loadProfile() {
  const res = await fetch(`${API_BASE}/profile`, {
    headers: { "Authorization": "Bearer " + localStorage.getItem("idToken") }
  });
  const profile = await res.json();

  document.getElementById("username").innerText = profile.name || "User Name";
  document.getElementById("email").innerText = profile.email || "No email";
  document.getElementById("user-id").innerText = profile.userId;
  document.getElementById("created").innerText = new Date(profile.createdAt).toLocaleString();
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
    row.className = "grid grid-cols-4 items-center bg-slate-50 border border-slate-100 rounded-xl p-3 hover:shadow-md transition";

    row.innerHTML = `
        <span class="font-mono text-sm font-black text-slate-800">${device.deviceId}</span>

        <span class="text-[10px] font-black px-2 py-1 rounded-full 
        ${status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}">
        ${status}
        </span>

        <span class="text-[11px] font-bold text-slate-600">
        ${new Date(device.lastUpdate).toLocaleString()}
        </span>

        <div class="flex gap-2 justify-end">
        <a href="live.html?device=${device.deviceId}"
            class="text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg transition">
            TRACK
        </a>

        <button onclick="deleteDevice('${device.deviceId}')"
            class="text-[10px] font-black bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-lg transition">
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
