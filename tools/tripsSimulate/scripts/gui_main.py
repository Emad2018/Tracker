import tkinter as tk
from tkinter import ttk
import tkintermapview
import json
import threading
import time
import os
import copy
from PIL import Image, ImageTk, ImageOps, ImageDraw
from datetime import datetime, timezone
from math import radians, cos, sin, asin, sqrt
from awscrt import mqtt5
from awsiot import mqtt5_client_builder

# --- AWS Configuration ---
ENDPOINT = "a2ocgpntw8531n-ats.iot.us-east-1.amazonaws.com"
CERT_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-certificate.pem.crt"
KEY_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-private.pem.key"
ROOT_CA_PATH = "certificate/AmazonRootCA1.pem"
TOPIC_PREFIX = "FMC150/Sim"

# --- Helper Functions ---
def haversine(lon1, lat1, lon2, lat2):
    R = 6371000 
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * (2 * asin(sqrt(a)))

def calculate_trip_stats(trip):
    if not trip or len(trip) < 2:
        return {"dist": "0 km", "dur": "0s", "max_s": "0 km/h", "avg_s": "0 km/h"}
    total_dist = 0
    max_speed = 0
    speed_sum = 0
    try:
        start_time = datetime.strptime(trip[0]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        end_time = datetime.strptime(trip[-1]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
        duration = end_time - start_time
    except:
        duration = "N/A"
    for i in range(len(trip)):
        p = trip[i]
        s = p.get('speed_gnss', 0)
        max_speed = max(max_speed, s)
        speed_sum += s
        if i > 0:
            total_dist += haversine(trip[i-1]['longitude'], trip[i-1]['latitude'], p['longitude'], p['latitude'])
    dist=total_dist/1000
    avg_s=dist/(duration.total_seconds()/3600) if  duration.total_seconds() > 0 else 0
    return {
        "dist": f"{dist:.2f} km", "dur": str(duration),
        "max_s": f"{max_speed} km/h", "avg_s": f"{avg_s:.1f} km/h"
    }

# --- Simulator Class ---
class DeviceSimulator:
    def __init__(self, imei, trip_data, update_cb=None):
        self.imei = imei
        self.trip = trip_data
        self.update_cb = update_cb
        self.client = None
        self.paused = False
        self.stopped = False

    def start(self):
        self.stopped = False
        threading.Thread(target=self._run, daemon=True).start()

    def pause(self):
        self.update_cb("Paused", 0, None) 
        self.paused = True
    def resume(self): self.paused = False

    def stop(self):
        self.stopped = True
        if self.client:
            try: self.client.stop()
            except: pass

    def _run(self):
        try:
            self.client = mqtt5_client_builder.mtls_from_path(
                endpoint=ENDPOINT, cert_filepath=CERT_PATH, pri_key_filepath=KEY_PATH,
                ca_filepath=ROOT_CA_PATH, client_id=f"Sim_{self.imei}_{int(time.time())}"
            )
            self.client.start()
        except Exception:
            if self.update_cb: self.update_cb("Error: Connection Failed", 0, None)
            return

        total = len(self.trip)
        for i, point in enumerate(self.trip):
            if self.stopped: break
            
            while self.paused:
                if self.stopped: break
                time.sleep(0.2)

            # Send current real-time timestamp to AWS
            payload = copy.deepcopy(point)
            payload['IMEI'] = self.imei
            payload['timestamp'] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            
            try:
                self.client.publish(mqtt5.PublishPacket(
                    topic=f"{TOPIC_PREFIX}/{self.imei}", 
                    payload=json.dumps(payload), qos=mqtt5.QoS.AT_LEAST_ONCE
                ))
            except: pass

            if self.update_cb:
                self.update_cb("Running", (i+1)/total * 100, point)

            # Timing logic: Wait based on difference in original timestamps
            if i < total - 1:
                try:
                    t1 = datetime.strptime(point['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
                    t2 = datetime.strptime(self.trip[i+1]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
                    wait_seconds = (t2 - t1).total_seconds()
                    
                    # Responsive sleep loop (checks for stop every 100ms)
                    start_wait = time.time()
                    while time.time() - start_wait < max(0.1, wait_seconds):
                        if self.stopped: break
                        time.sleep(0.1)
                except:
                    time.sleep(1.0)

        if self.client: self.client.stop()
        final_status = "Complete" if not self.stopped else "Stopped"
        if self.update_cb: self.update_cb(final_status, 100 if final_status == "Complete" else None, None)

# --- Main GUI Application ---
class IotSimulatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("IoT Simulation Control Center")
        self.root.geometry("1400x850")
        
        self.load_data()
        self.load_icons()
        self.simulators = {}
        self.active_dv_imei = None 

        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        self.tab_device, self.tab_list = ttk.Frame(self.notebook), ttk.Frame(self.notebook)
        self.notebook.add(self.tab_device, text="  Device Map View  ")
        self.notebook.add(self.tab_list, text="  Multi-Device List  ")
        
        self.setup_device_tab()
        self.setup_list_tab()

    def load_data(self):
        # Path safety check
        t_path = 'data/trips.json' if os.path.exists('data/trips.json') else 'trips.json'
        try:
            with open(t_path, 'r') as f: self.trips = [t for t in json.load(f) if t]
        except: self.trips = []

        d_path = 'data/devices.txt' if os.path.exists('data/devices.txt') else 'devices.txt'
        if os.path.exists(d_path):
            with open(d_path, 'r') as f: self.devices = [l.strip() for l in f if l.strip()]
        else: self.devices = ["Sim_Device_1", "Sim_Device_2"]
        
        self.trip_names = [f"Route {i+1} ({len(t)} pts)" for i, t in enumerate(self.trips)]

    def load_icons(self):
        self.car_icon = None
        icon_path = os.path.join("data", "car.png")
        if os.path.exists(icon_path):
            try:
                # Create round, transparent Uber-style icon
                img = Image.open(icon_path).convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
                mask = Image.new('L', (40, 40), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, 40, 40), fill=255)
                img.putalpha(mask)
                self.car_icon = ImageTk.PhotoImage(img)
            except Exception as e:
                print(f"Icon error: {e}")

    def setup_device_tab(self):
        paned = ttk.PanedWindow(self.tab_device, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        sidebar = ttk.Frame(paned, width=320, padding=15); paned.add(sidebar, weight=0)

        ttk.Label(sidebar, text="Device Selection:", font=("Arial", 10, "bold")).pack(anchor='w')
        self.var_dv_imei = tk.StringVar(value=self.devices[0] if self.devices else "")
        ttk.Combobox(sidebar, textvariable=self.var_dv_imei, values=self.devices, state="readonly").pack(fill=tk.X, pady=(5, 15))

        ttk.Label(sidebar, text="Route Controls:", font=("Arial", 10, "bold")).pack(anchor='w')
        nav = ttk.Frame(sidebar); nav.pack(fill=tk.X, pady=5)
        ttk.Button(nav, text="< Prev", command=lambda: self.nav_trip(-1)).pack(side=tk.LEFT, expand=True)
        ttk.Button(nav, text="Next >", command=lambda: self.nav_trip(1)).pack(side=tk.LEFT, expand=True)
        
        self.lbl_route_name = ttk.Label(sidebar, text="Route 1", font=("Arial", 10, "italic"), foreground="#2980b9")
        self.lbl_route_name.pack(pady=5)
        
        self.stats_box = ttk.Label(sidebar, text="", justify=tk.LEFT, font=("Consolas", 9))
        self.stats_box.pack(fill=tk.X, pady=10)

        self.btn_dv_start = ttk.Button(sidebar, text="▶ Start Simulation", command=self.dv_start)
        self.btn_dv_start.pack(fill=tk.X, pady=2)
        self.btn_dv_pause = ttk.Button(sidebar, text="⏸ Pause", state="disabled", command=self.dv_pause)
        self.btn_dv_pause.pack(fill=tk.X, pady=2)
        self.btn_dv_stop = ttk.Button(sidebar, text="⏹ Stop", state="disabled", command=self.dv_stop)
        self.btn_dv_stop.pack(fill=tk.X, pady=2)

        self.pb_dv = ttk.Progressbar(sidebar, orient="horizontal", mode="determinate")
        self.pb_dv.pack(fill=tk.X, pady=15)
        self.lbl_dv_status = ttk.Label(sidebar, text="Status: Ready", font=("Arial", 9))
        self.lbl_dv_status.pack()

        # Google Map Style Integration
        self.map_widget = tkintermapview.TkinterMapView(paned, width=900, height=700)
        self.map_widget.set_tile_server("https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}", max_zoom=22)
        paned.add(self.map_widget, weight=1)
        
        self.live_marker = None
        self.current_trip_idx = 0
        self.update_map_display()

    def update_map_display(self):
        self.map_widget.delete_all_path(); self.map_widget.delete_all_marker(); self.live_marker = None
        if not self.trips: return
        trip = self.trips[self.current_trip_idx]
        self.lbl_route_name.config(text=f"Route {self.current_trip_idx + 1}")
        
        stats = calculate_trip_stats(trip)
        self.stats_box.config(text=f"Dist: {stats['dist']}\nDur:  {stats['dur']}\nMax:  {stats['max_s']}\nAvg:  {stats['avg_s']}")
        
        pts = [(p['latitude'], p['longitude']) for p in trip]
        if pts:
            self.map_widget.set_path(pts, color="#3498db", width=3)
            # Start/Stop Markers
            self.map_widget.set_marker(pts[0][0], pts[0][1], text="START", marker_color_outside="green")
            self.map_widget.set_marker(pts[-1][0], pts[-1][1], text="END", marker_color_outside="red")
            self.map_widget.set_position(pts[0][0], pts[0][1]); self.map_widget.set_zoom(14)

    def nav_trip(self, delta):
        if 0 <= self.current_trip_idx + delta < len(self.trips):
            self.current_trip_idx += delta; self.update_map_display()

    def dv_start(self):
        imei = self.var_dv_imei.get()
        self.active_dv_imei = imei
        if imei in self.simulators: self.simulators[imei].stop()
        
        sim = DeviceSimulator(imei, self.trips[self.current_trip_idx], self.dv_update_ui)
        self.simulators[imei] = sim
        sim.start()

        self.btn_dv_start.config(state="disabled")
        self.btn_dv_pause.config(state="normal", text="⏸ Pause")
        self.btn_dv_stop.config(state="normal")

    def dv_stop(self):
        if self.active_dv_imei in self.simulators:
            self.simulators[self.active_dv_imei].stop()

    def dv_pause(self):
        sim = self.simulators.get(self.active_dv_imei)
        if sim:
            if sim.paused: 
                sim.resume(); self.btn_dv_pause.config(text="⏸ Pause")
            else: 
                sim.pause(); self.btn_dv_pause.config(text="▶ Resume")

    def dv_update_ui(self, status, progress, record):
        self.root.after(0, lambda: self._dv_ui_callback(status, progress, record))

    def _dv_ui_callback(self, status, progress, record):
        self.lbl_dv_status.config(text=f"Status: {status}")
        if progress is not None: self.pb_dv['value'] = progress
        
        if status in ["Complete", "Stopped", "Error: Connection Failed"]:
            self.btn_dv_start.config(state="normal")
            self.btn_dv_pause.config(state="disabled")
            self.btn_dv_stop.config(state="disabled")
        
        if record:
            lat, lon = record['latitude'], record['longitude']
            if self.live_marker: self.live_marker.set_position(lat, lon)
            else: self.live_marker = self.map_widget.set_marker(lat, lon, text="Live", icon=self.car_icon)

    def setup_list_tab(self):
        container = ttk.Frame(self.tab_list)
        container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        canvas = tk.Canvas(container); scroll = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        self.list_frame = ttk.Frame(canvas); self.list_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.list_frame, anchor="nw"); canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True); scroll.pack(side="right", fill="y")
        
        cols = ["Device IMEI", "Select Route", "Simulation Controls", "Status", "Progress"]
        for c, text in enumerate(cols): ttk.Label(self.list_frame, text=text, font=("Arial", 9, "bold")).grid(row=0, column=c, padx=15, pady=10)
        
        self.list_widgets = {}
        for i, imei in enumerate(self.devices):
            row = i + 1
            ttk.Label(self.list_frame, text=imei).grid(row=row, column=0, padx=15)
            
            v_route = tk.StringVar(); cb = ttk.Combobox(self.list_frame, textvariable=v_route, values=self.trip_names, state="readonly", width=15)
            if self.trip_names: cb.current(0)
            cb.grid(row=row, column=1, padx=15)
            
            ctrls = ttk.Frame(self.list_frame); ctrls.grid(row=row, column=2, padx=15)
            b_run = ttk.Button(ctrls, text="▶", width=3, command=lambda im=imei: self.list_start(im))
            b_pause = ttk.Button(ctrls, text="⏸", width=3, state="disabled", command=lambda im=imei: self.list_pause(im))
            b_stop = ttk.Button(ctrls, text="⏹", width=3, state="disabled", command=lambda im=imei: self.list_stop(im))
            b_run.pack(side=tk.LEFT); b_pause.pack(side=tk.LEFT); b_stop.pack(side=tk.LEFT)
            
            lbl_s = ttk.Label(self.list_frame, text="Idle", width=12); lbl_s.grid(row=row, column=3, padx=15)
            pb = ttk.Progressbar(self.list_frame, length=120); pb.grid(row=row, column=4, padx=15)
            
            self.list_widgets[imei] = {"route_var": v_route, "run_btn": b_run, "pause_btn": b_pause, "stop_btn": b_stop, "status_lbl": lbl_s, "pb": pb}

    def list_pause(self, imei):
        sim = self.simulators.get(imei)
        if sim:
            if sim.paused: sim.resume(); self.list_widgets[imei]["pause_btn"].config(text="⏸")
            else: sim.pause(); self.list_widgets[imei]["pause_btn"].config(text="▶")

    def list_start(self, imei):
        w = self.list_widgets[imei]
        try:
            r_idx = self.trip_names.index(w["route_var"].get())
            if imei in self.simulators: self.simulators[imei].stop()
            sim = DeviceSimulator(imei, self.trips[r_idx], lambda s, p, r: self.list_update_ui(imei, s, p))
            self.simulators[imei] = sim
            sim.start()
            w["run_btn"].config(state="disabled"); w["pause_btn"].config(state="normal"); w["stop_btn"].config(state="normal")
        except: pass

    def list_stop(self, imei):
        if imei in self.simulators: self.simulators[imei].stop()
        w = self.list_widgets.get(imei)
        if w:
            w["run_btn"].config(state="normal"); w["pause_btn"].config(state="disabled"); w["stop_btn"].config(state="disabled")
            w["status_lbl"].config(text="Stopped")

    def list_update_ui(self, imei, status, progress):
        self.root.after(0, lambda: self._list_ui_callback(imei, status, progress))

    def _list_ui_callback(self, imei, status, progress):
        w = self.list_widgets.get(imei)
        if not w: return
        w["status_lbl"].config(text=status)
        if progress is not None: w["pb"]["value"] = progress
        if status in ["Complete", "Stopped", "Error: Connection Failed"]:
            w["run_btn"].config(state="normal"); w["stop_btn"].config(state="disabled")

if __name__ == "__main__":
    root = tk.Tk(); app = IotSimulatorApp(root); root.mainloop()