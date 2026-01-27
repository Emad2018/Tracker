import tkinter as tk
from tkinter import ttk
import tkintermapview
import json
import threading
import time
from datetime import datetime, timezone
from awscrt import mqtt5
from awsiot import mqtt5_client_builder
import math

# --- AWS Configuration ---
# TODO: Ensure these match your local setup
ENDPOINT = "a2ocgpntw8531n-ats.iot.us-east-1.amazonaws.com"
CERT_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-certificate.pem.crt"
KEY_PATH = "certificate/89217285ce46f0edac3380d8421a9f1edf1e5f90c68ed0e5679b609fa036a707-private.pem.key"
ROOT_CA_PATH = "certificate/AmazonRootCA1.pem"
TOPIC = "FMC150/Sim"

class TripViewer:
    def __init__(self, root):
        self.root = root
        self.root.title("FMC150 Control Center - Live Simulation")
        self.root.geometry("1200x800")
        
        # Enable DPI awareness for sharper text on Windows
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
        except:
            pass

        self.all_trips = self.load_trips()
        self.imeis = list(self.all_trips.keys())
        self.current_imei = self.imeis[0] if self.imeis else None
        self.current_trip_idx = 0
        
        # Simulation Control Flags
        self.is_simulating = False
        self.is_paused = False
        self.stop_requested = False
        self.live_marker = None 

        self.setup_ui()
        if self.current_imei:
            self.display_trip()

    def load_trips(self):
        try:
            import os
            path = 'trips.json' if os.path.exists('trips.json') else 'data/trips.json'
            with open(path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def setup_ui(self):
        # Sidebar
        control_frame = ttk.Frame(self.root, padding="15")
        control_frame.pack(side=tk.LEFT, fill=tk.Y)

        ttk.Label(control_frame, text="Device IMEI:", font=('Arial', 10, 'bold')).pack(pady=5)
        self.imei_selector = ttk.Combobox(control_frame, values=self.imeis)
        self.imei_selector.set(self.current_imei)
        self.imei_selector.pack(fill=tk.X, pady=5)
        self.imei_selector.bind("<<ComboboxSelected>>", self.on_imei_change)

        nav_frame = ttk.Frame(control_frame)
        nav_frame.pack(pady=15)
        ttk.Button(nav_frame, text="◀ Prev", command=self.prev_trip).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="Next ▶", command=self.next_trip).pack(side=tk.LEFT, padx=5)

        stats_frame = ttk.LabelFrame(control_frame, text="Trip Dashboard", padding="10")
        stats_frame.pack(fill=tk.X, pady=10)
        self.lbl_trip_num = ttk.Label(stats_frame, text="Trip: -")
        self.lbl_trip_num.pack(anchor=tk.W)
        self.lbl_dist = ttk.Label(stats_frame, text="Distance: -")
        self.lbl_dist.pack(anchor=tk.W)
        self.lbl_duration = ttk.Label(stats_frame, text="Duration: -")
        self.lbl_duration.pack(anchor=tk.W)
        self.lbl_avg_speed = ttk.Label(stats_frame, text="Avg Speed: -")
        self.lbl_avg_speed.pack(anchor=tk.W)

        # --- Simulation Controls ---
        sim_frame = ttk.LabelFrame(control_frame, text="AWS IoT Simulation", padding="10")
        sim_frame.pack(fill=tk.X, pady=20)
        
        # Button Container
        btn_frame = ttk.Frame(sim_frame)
        btn_frame.pack(fill=tk.X, pady=5)

        self.btn_sim = ttk.Button(btn_frame, text="▶ Start", command=self.start_sim_thread)
        self.btn_sim.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)

        self.btn_pause = ttk.Button(btn_frame, text="⏸ Pause", command=self.toggle_pause, state=tk.DISABLED)
        self.btn_pause.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)

        self.btn_stop = ttk.Button(btn_frame, text="⏹ Stop", command=self.stop_simulation, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        self.sim_progress = ttk.Progressbar(sim_frame, orient=tk.HORIZONTAL, length=100, mode='determinate')
        self.sim_progress.pack(fill=tk.X, pady=5)
        
        self.lbl_status = ttk.Label(sim_frame, text="Status: Ready", foreground="gray")
        self.lbl_status.pack(anchor=tk.W)

        # Map
        self.map_widget = tkintermapview.TkinterMapView(self.root, corner_radius=0)
        self.map_widget.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

    def calculate_stats(self, trip):
        dist_km = (trip[-1]['total_odometer_m'] - trip[0]['total_odometer_m']) / 1000.0
        t1 = datetime.strptime(trip[0]['timestamp'], '%Y-%m-%d %H:%M:%S')
        t2 = datetime.strptime(trip[-1]['timestamp'], '%Y-%m-%d %H:%M:%S')
        dur = t2 - t1
        hours = dur.total_seconds() / 3600.0
        avg_s = dist_km / hours if hours > 0 else 0
        return dist_km, dur, avg_s

    def rdp_simplify(self, points, epsilon):
        if len(points) < 3: return points
        def distance_point_line(px, py, x1, y1, x2, y2):
            if x1 == x2 and y1 == y2: return math.sqrt((px - x1)**2 + (py - y1)**2)
            u = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / ((x2 - x1)**2 + (y2 - y1)**2)
            u = max(0, min(1, u))
            ix = x1 + u * (x2 - x1); iy = y1 + u * (y2 - y1)
            return math.sqrt((px - ix)**2 + (py - iy)**2)

        dmax = 0; index = 0
        for i in range(1, len(points) - 1):
            d = distance_point_line(points[i][0], points[i][1], points[0][0], points[0][1], points[-1][0], points[-1][1])
            if d > dmax: index = i; dmax = d

        if dmax > epsilon:
            res1 = self.rdp_simplify(points[:index+1], epsilon)
            res2 = self.rdp_simplify(points[index:], epsilon)
            return res1[:-1] + res2
        else:
            return [points[0], points[-1]]

    def display_trip(self):
        trips = self.all_trips[self.current_imei]
        trip = trips[self.current_trip_idx]
        
        self.map_widget.delete_all_path()
        self.map_widget.delete_all_marker()
        self.live_marker = None
        
        raw_coords = [(r['latitude'], r['longitude']) for r in trip]
        optimized_path = self.rdp_simplify(raw_coords, 0.0001)

        dist, dur, avg_s = self.calculate_stats(trip)
        self.lbl_trip_num.config(text=f"Trip: {self.current_trip_idx + 1} / {len(trips)}")
        self.lbl_dist.config(text=f"Distance: {dist:.2f} km")
        self.lbl_duration.config(text=f"Duration: {str(dur).split('.')[0]}")
        self.lbl_avg_speed.config(text=f"Avg Speed: {avg_s:.1f} km/h")
        
        if optimized_path:
            self.map_widget.set_position(optimized_path[0][0], optimized_path[0][1])
            self.map_widget.set_path(optimized_path)
            self.map_widget.set_marker(optimized_path[0][0], optimized_path[0][1], text="Start", marker_color_circle="green")
            self.map_widget.set_marker(optimized_path[-1][0], optimized_path[-1][1], text="End", marker_color_circle="red")
            self.map_widget.set_zoom(15)

    # --- Control Handlers ---
    def start_sim_thread(self):
        if self.is_simulating: return
        self.stop_requested = False
        self.is_paused = False
        
        # Update UI state
        self.btn_sim.config(state=tk.DISABLED)
        self.btn_pause.config(state=tk.NORMAL, text="⏸ Pause")
        self.btn_stop.config(state=tk.NORMAL)
        
        thread = threading.Thread(target=self.run_simulation, daemon=True)
        thread.start()

    def toggle_pause(self):
        if not self.is_simulating: return
        self.is_paused = not self.is_paused
        if self.is_paused:
            self.btn_pause.config(text="▶ Resume")
            self.lbl_status.config(text="Status: Paused", foreground="orange")
        else:
            self.btn_pause.config(text="⏸ Pause")
            self.lbl_status.config(text="Status: Resuming...", foreground="blue")

    def stop_simulation(self):
        if not self.is_simulating: return
        self.stop_requested = True
        self.lbl_status.config(text="Status: Stopping...", foreground="red")
        self.btn_pause.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.DISABLED)

    def update_live_view(self, lat, lon, record_idx, total, should_center):
        if self.live_marker is None:
            self.live_marker = self.map_widget.set_marker(lat, lon, text="LIVE", marker_color_circle="blue")
        else:
            self.live_marker.set_position(lat, lon)
        
        if should_center:
            self.map_widget.set_position(lat, lon)
        
        self.sim_progress['value'] = ((record_idx + 1) / total) * 100
        if not self.is_paused:
            self.lbl_status.config(text=f"Status: Sending {record_idx+1}/{total}")

    def run_simulation(self):
        self.is_simulating = True
        self.lbl_status.config(text="Status: Connecting...", foreground="blue")
        
        connected_event = threading.Event()

        def on_connection_success(data):
            print("Connected successfully!")
            connected_event.set()

        def on_connection_failure(data):
            print(f"Connection failed: {data.exception}")

        try:
            mqtt_conn = mqtt5_client_builder.mtls_from_path(
                endpoint=ENDPOINT, cert_filepath=CERT_PATH, pri_key_filepath=KEY_PATH,
                ca_filepath=ROOT_CA_PATH, client_id=f"gui_{self.current_imei}",
                on_lifecycle_connection_success=on_connection_success,
                on_lifecycle_connection_failure=on_connection_failure
            )
            
            mqtt_conn.start()
            if not connected_event.wait(timeout=10):
                raise Exception("Connection Timeout")

            trip = self.all_trips[self.current_imei][self.current_trip_idx]
            total = len(trip)
            
            # Throttling
            last_ui_update_time = 0
            last_map_center_time = 0
            
            for i, record in enumerate(trip):
                # --- STOP CHECK ---
                if self.stop_requested:
                    print("Simulation stopped by user.")
                    break

                # --- PAUSE CHECK ---
                while self.is_paused:
                    if self.stop_requested: break # Allow stopping while paused
                    time.sleep(0.1)

                # Delay Logic
                if i > 0:
                    delay = (datetime.strptime(record['timestamp'], '%Y-%m-%d %H:%M:%S') - 
                             datetime.strptime(trip[i-1]['timestamp'], '%Y-%m-%d %H:%M:%S')).total_seconds()
                    if delay > 0:
                        # Sleep in small chunks to remain responsive to Stop/Pause
                        sleep_time = min(delay, 2)
                        start_sleep = time.time()
                        while time.time() - start_sleep < sleep_time:
                            if self.stop_requested: break
                            time.sleep(0.1) 
                
                if self.stop_requested: break

                # Publish
                payload = record.copy()
                now_utc = datetime.now(timezone.utc)
                payload['timestamp'] = int(now_utc.timestamp() * 1000)
                # Ensure fields exist or strip if not needed. Adjust based on your CSV structure
                # payload['IMEI'] = str(payload.get('DeviceId', self.current_imei)) 

                mqtt_conn.publish(mqtt5.PublishPacket(
                    topic=TOPIC, payload=json.dumps(payload), qos=mqtt5.QoS.AT_LEAST_ONCE
                ))
                
                # UI Update Logic (Throttled)
                current_time = time.time()
                if current_time - last_ui_update_time > 0.1 or i == total - 1:
                    should_center = False
                    if current_time - last_map_center_time > 3.0:
                        should_center = True
                        last_map_center_time = current_time
                    
                    self.root.after(0, self.update_live_view, record['latitude'], record['longitude'], i, total, should_center)
                    last_ui_update_time = current_time

            if self.stop_requested:
                self.lbl_status.config(text="Status: Stopped", foreground="red")
            else:
                self.lbl_status.config(text="Status: Finished!", foreground="green")
            
            mqtt_conn.stop()
            
        except Exception as e:
            self.lbl_status.config(text=f"Status: Error", foreground="red")
            print(f"Simulation Error: {e}")
        
        self.is_simulating = False
        self.btn_sim.config(state=tk.NORMAL)
        self.btn_pause.config(state=tk.DISABLED, text="⏸ Pause")
        self.btn_stop.config(state=tk.DISABLED)

    def on_imei_change(self, e): 
        self.current_imei = self.imei_selector.get()
        self.current_trip_idx = 0
        self.display_trip()

    def next_trip(self):
        if self.current_trip_idx < len(self.all_trips[self.current_imei]) - 1:
            self.current_trip_idx += 1
            self.display_trip()

    def prev_trip(self):
        if self.current_trip_idx > 0:
            self.current_trip_idx -= 1
            self.display_trip()

if __name__ == "__main__":
    root = tk.Tk()
    app = TripViewer(root)
    root.mainloop()