import tkinter as tk
from tkinter import ttk
import tkintermapview
import json
import threading
import time
from datetime import datetime,timezone
from awscrt import mqtt5
from awsiot import mqtt5_client_builder

# --- AWS Configuration ---
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

        self.all_trips = self.load_trips()
        self.imeis = list(self.all_trips.keys())
        self.current_imei = self.imeis[0] if self.imeis else None
        self.current_trip_idx = 0
        self.is_simulating = False
        self.live_marker = None # Track the moving marker

        self.setup_ui()
        if self.current_imei:
            self.display_trip()

    def load_trips(self):
        try:
            with open('data/trips.json', 'r') as f:
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

        sim_frame = ttk.LabelFrame(control_frame, text="AWS IoT Simulation", padding="10")
        sim_frame.pack(fill=tk.X, pady=20)
        
        self.btn_sim = ttk.Button(sim_frame, text="🚀 Start Live Simulation", command=self.start_sim_thread)
        self.btn_sim.pack(fill=tk.X, pady=5)
        
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

    def display_trip(self):
        trips = self.all_trips[self.current_imei]
        trip = trips[self.current_trip_idx]
        self.map_widget.delete_all_path()
        self.map_widget.delete_all_marker()
        self.live_marker = None
        
        path = [(r['latitude'], r['longitude']) for r in trip]
        self.map_widget.set_path(path)
        self.map_widget.set_marker(path[0][0], path[0][1], text="Start", marker_color_circle="green")
        self.map_widget.set_marker(path[-1][0], path[-1][1], text="End", marker_color_circle="red")
        self.map_widget.set_position(path[0][0], path[0][1])
        self.map_widget.set_zoom(15)
        
        dist, dur, avg_s = self.calculate_stats(trip)
        self.lbl_trip_num.config(text=f"Trip: {self.current_trip_idx + 1} / {len(trips)}")
        self.lbl_dist.config(text=f"Distance: {dist:.2f} km")
        self.lbl_duration.config(text=f"Duration: {str(dur).split('.')[0]}")
        self.lbl_avg_speed.config(text=f"Avg Speed: {avg_s:.1f} km/h")

    def start_sim_thread(self):
        if self.is_simulating: return
        thread = threading.Thread(target=self.run_simulation, daemon=True)
        thread.start()

    def update_live_view(self, lat, lon, record_idx, total):
        """Thread-safe update for the map and progress bar"""
        # Create or move marker
        if self.live_marker is None:
            self.live_marker = self.map_widget.set_marker(lat, lon, text="Live Vehicle", marker_color_circle="blue")
        else:
            self.live_marker.set_position(lat, lon)
        
        # Follow marker
        self.map_widget.set_position(lat, lon)
        
        # Update progress
        progress = ((record_idx + 1) / total) * 100
        self.sim_progress['value'] = progress
        self.lbl_status.config(text=f"Status: Sending {record_idx+1}/{total}")

    def run_simulation(self):
        self.is_simulating = True
        self.btn_sim.config(state=tk.DISABLED)
        self.lbl_status.config(text="Status: Connecting...", foreground="blue")
        
        # Use an Event to wait for connection success
        connected_event = threading.Event()

        def on_connection_success(data):
            print("Connected successfully!")
            connected_event.set()

        def on_connection_failure(data):
            print(f"Connection failed: {data.exception}")

        try:
            # 1. Build Client with Callbacks
            mqtt_conn = mqtt5_client_builder.mtls_from_path(
                endpoint=ENDPOINT,
                cert_filepath=CERT_PATH,
                pri_key_filepath=KEY_PATH,
                ca_filepath=ROOT_CA_PATH,
                client_id=f"gui_{self.current_imei}",
                on_lifecycle_connection_success=on_connection_success,
                on_lifecycle_connection_failure=on_connection_failure
            )
            
            # 2. Start and WAIT for connection
            mqtt_conn.start()
            if not connected_event.wait(timeout=10):
                raise Exception("Connection Timeout: Could not connect to AWS IoT")

            trip = self.all_trips[self.current_imei][self.current_trip_idx]
            total = len(trip)
            
            for i, record in enumerate(trip):
                if i > 0:
                    delay = (datetime.strptime(record['timestamp'], '%Y-%m-%d %H:%M:%S') - 
                             datetime.strptime(trip[i-1]['timestamp'], '%Y-%m-%d %H:%M:%S')).total_seconds()
                    time.sleep(min(delay, 2)) # Cap delay for demo
                
                payload = record.copy()
                now_utc = datetime.now(timezone.utc) 
                # Get the timestamp in seconds (float), multiply by 1000, and convert to integer
                payload['timestamp']  = int(now_utc.timestamp() * 1000)
                payload['IMEI']  = str(payload['IMEI'])
                # 3. Publish and Check Result
                publish_future = mqtt_conn.publish(mqtt5.PublishPacket(
                    topic=TOPIC,
                    payload=json.dumps(payload),
                    qos=mqtt5.QoS.AT_LEAST_ONCE
                ))
                
                # Wait for the server to acknowledge (PubAck)
                pub_result = publish_future.result(timeout=5)
                if pub_result.puback.reason_code != mqtt5.PubackReasonCode.SUCCESS:
                    print(f"Publish failed: {pub_result.puback.reason_code}")

                self.root.after(0, self.update_live_view, record['latitude'], record['longitude'], i, total)

            self.lbl_status.config(text="Status: Finished!", foreground="green")
            mqtt_conn.stop() # MQTT5 uses stop() instead of disconnect()
            
        except Exception as e:
            self.lbl_status.config(text=f"Status: Error", foreground="red")
            print(f"Simulation Error: {e}")
        
        self.is_simulating = False
        self.btn_sim.config(state=tk.NORMAL)

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