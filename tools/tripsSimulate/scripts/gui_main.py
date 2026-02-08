# gui_main.py
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import tkintermapview
import os
import threading
from PIL import Image, ImageTk, ImageDraw
import time

# Custom Modules
import config
import utils
import process_data  # Import the processor
from simulator import DeviceSimulator
from api_client import APIClient

class LoginWindow:
    def __init__(self, root, on_success):
        self.root = root
        self.on_success = on_success
        self.root.title("FleetM Simulator Login")
        self.root.geometry("400x350")
        self.api = APIClient()

        frame = ttk.Frame(root, padding=20)
        frame.pack(expand=True, fill=tk.BOTH)

        ttk.Label(frame, text="Welcome Back", font=("Helvetica", 16, "bold")).pack(pady=10)
        
        ttk.Label(frame, text="Email:").pack(anchor='w')
        self.ent_email = ttk.Entry(frame, width=40)
        self.ent_email.pack(pady=5)
        self.ent_email.insert(0, config.DEFAULT_EMAIL)

        ttk.Label(frame, text="Password:").pack(anchor='w')
        self.ent_pass = ttk.Entry(frame, show="*", width=40)
        self.ent_pass.pack(pady=5)
        self.ent_pass.insert(0, config.DEFAULT_PASS)

        self.btn_login = ttk.Button(frame, text="Login", command=self.do_login)
        self.btn_login.pack(pady=20, fill=tk.X)
        
        self.lbl_status = ttk.Label(frame, text="", foreground="red")
        self.lbl_status.pack()

    def do_login(self):
        self.btn_login.config(state="disabled")
        self.lbl_status.config(text="Authenticating...", foreground="blue")
        threading.Thread(target=self._login_thread, args=(self.ent_email.get(), self.ent_pass.get()), daemon=True).start()

    def _login_thread(self, email, password):
        success, msg = self.api.login(email, password)
        self.root.after(0, lambda: self._login_result(success, msg))

    def _login_result(self, success, msg):
        self.btn_login.config(state="normal")
        if success:
            self.root.destroy()
            self.on_success(self.api)
        else:
            self.lbl_status.config(text=msg, foreground="red")

class IotSimulatorApp:
    def __init__(self, root, api_client):
        self.root = root
        self.api_client = api_client
        self.root.title("IoT Simulation Control Center")
        self.root.geometry("1400x900")
        
        self.load_data()
        self.load_icons()
        self.simulators = {}
        self.active_dv_imei = None 

        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        self.tab_device = ttk.Frame(self.notebook)
        self.tab_list = ttk.Frame(self.notebook)
        self.tab_factory = ttk.Frame(self.notebook)
        self.tab_update = ttk.Frame(self.notebook) # New Tab
        
        self.notebook.add(self.tab_device, text="  Device Map View  ")
        self.notebook.add(self.tab_list, text="  Multi-Device List  ")
        self.notebook.add(self.tab_factory, text="  Vehicle Factory  ")
        self.notebook.add(self.tab_update, text="  Data Update  ") # Add to notebook
        
        self.setup_device_tab()
        self.setup_list_tab()
        self.setup_factory_tab()
        self.setup_update_tab() # Setup new tab

    def load_data(self):
        self.trips = utils.load_trips_data()
        self.devices = utils.load_devices_data() # Returns List of IMEIs
        self.trip_names = [f"Route {i+1} ({len(t)} pts)" for i, t in enumerate(self.trips)]

    def load_icons(self):
        self.car_icon = None
        if os.path.exists(config.ICON_PATH):
            try:
                img = Image.open(config.ICON_PATH).convert("RGBA").resize((40, 40), Image.Resampling.LANCZOS)
                mask = Image.new('L', (40, 40), 0)
                ImageDraw.Draw(mask).ellipse((0, 0, 40, 40), fill=255)
                img.putalpha(mask)
                self.car_icon = ImageTk.PhotoImage(img)
            except Exception: pass

    # --- Tab 1: Device Map ---
    def setup_device_tab(self):
        paned = ttk.PanedWindow(self.tab_device, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        sidebar = ttk.Frame(paned, width=320, padding=15); paned.add(sidebar, weight=0)

        ttk.Label(sidebar, text="Device Selection:", font=("Arial", 10, "bold")).pack(anchor='w')
        self.var_dv_imei = tk.StringVar(value=self.devices[0] if self.devices else "")
        self.cb_devices = ttk.Combobox(sidebar, textvariable=self.var_dv_imei, values=self.devices, state="readonly")
        self.cb_devices.pack(fill=tk.X, pady=(5, 15))

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

        self.map_widget = tkintermapview.TkinterMapView(paned, width=900, height=700)
        self.map_widget.set_tile_server("https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}", max_zoom=22)
        paned.add(self.map_widget, weight=1)
        self.live_marker = None; self.current_trip_idx = 0; self.update_map_display()

    def update_map_display(self):
        self.map_widget.delete_all_path(); self.map_widget.delete_all_marker(); self.live_marker = None
        if not self.trips: return
        trip = self.trips[self.current_trip_idx]
        self.lbl_route_name.config(text=f"Route {self.current_trip_idx + 1}")
        stats = utils.calculate_trip_stats(trip)
        self.stats_box.config(text=f"Dist: {stats['dist']}\nDur:  {stats['dur']}\nMax:  {stats['max_s']}\nAvg:  {stats['avg_s']}")
        pts = [(p['latitude'], p['longitude']) for p in trip]
        if pts:
            self.map_widget.set_path(pts, color="#3498db", width=3)
            self.map_widget.set_marker(pts[0][0], pts[0][1], text="START", marker_color_outside="green")
            self.map_widget.set_marker(pts[-1][0], pts[-1][1], text="END", marker_color_outside="red")
            self.map_widget.set_position(pts[0][0], pts[0][1]); self.map_widget.set_zoom(14)

    def nav_trip(self, delta):
        if self.trips and 0 <= self.current_trip_idx + delta < len(self.trips):
            self.current_trip_idx += delta; self.update_map_display()

    def dv_start(self):
        imei = self.var_dv_imei.get()
        self.active_dv_imei = imei
        if imei in self.simulators: self.simulators[imei].stop()
        sim = DeviceSimulator(imei, self.trips[self.current_trip_idx], self.dv_update_ui)
        self.simulators[imei] = sim; sim.start()
        self.btn_dv_start.config(state="disabled"); self.btn_dv_pause.config(state="normal", text="⏸ Pause"); self.btn_dv_stop.config(state="normal")

    def dv_stop(self):
        if self.active_dv_imei in self.simulators: self.simulators[self.active_dv_imei].stop()

    def dv_pause(self):
        sim = self.simulators.get(self.active_dv_imei)
        if sim:
            if sim.paused: sim.resume(); self.btn_dv_pause.config(text="⏸ Pause")
            else: sim.pause(); self.btn_dv_pause.config(text="▶ Resume")

    def dv_update_ui(self, status, progress, record):
        self.root.after(0, lambda: self._dv_ui_callback(status, progress, record))

    def _dv_ui_callback(self, status, progress, record):
        self.lbl_dv_status.config(text=f"Status: {status}")
        if progress is not None: self.pb_dv['value'] = progress
        if status in ["Complete", "Stopped", "Error: Connection Failed"]:
            self.btn_dv_start.config(state="normal"); self.btn_dv_pause.config(state="disabled"); self.btn_dv_stop.config(state="disabled")
        if record:
            lat, lon = record['latitude'], record['longitude']
            if self.live_marker: self.live_marker.set_position(lat, lon)
            else: self.live_marker = self.map_widget.set_marker(lat, lon, text="Live", icon=self.car_icon)

    # --- Tab 2: List ---
    def setup_list_tab(self):
        container = ttk.Frame(self.tab_list)
        container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        canvas = tk.Canvas(container); scroll = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        self.list_frame = ttk.Frame(canvas); self.list_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=self.list_frame, anchor="nw"); canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side="left", fill="both", expand=True); scroll.pack(side="right", fill="y")
        self.refresh_list_tab()

    def refresh_list_tab(self):
        for widget in self.list_frame.winfo_children(): widget.destroy()
        cols = ["Device IMEI", "Select Route", "Controls", "Status", "Progress"]
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
            self.simulators[imei] = sim; sim.start()
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

    # --- Tab 3: Factory ---
    def setup_factory_tab(self):
        f_main = ttk.Frame(self.tab_factory, padding=30)
        f_main.pack(fill=tk.BOTH, expand=True)

        ttk.Label(f_main, text="Random Vehicle Generator", font=("Arial", 14, "bold")).pack(pady=10)
        
        frame_input = ttk.Frame(f_main)
        frame_input.pack(pady=10)
        ttk.Label(frame_input, text="Number of Vehicles to Create: ").pack(side=tk.LEFT)
        self.ent_count = ttk.Entry(frame_input, width=10)
        self.ent_count.insert(0, "5")
        self.ent_count.pack(side=tk.LEFT, padx=10)
        
        self.btn_create = ttk.Button(f_main, text="Create & Activate Vehicles", command=self.run_factory)
        self.btn_create.pack(pady=10)
        
        ttk.Label(f_main, text="Process Log:", font=("Arial", 10, "bold")).pack(anchor="w", pady=(20, 5))
        self.txt_log = scrolledtext.ScrolledText(f_main, height=20, width=100, state="disabled")
        self.txt_log.pack(fill=tk.BOTH, expand=True)

    def log_factory(self, msg):
        self.txt_log.config(state="normal")
        self.txt_log.insert(tk.END, msg + "\n")
        self.txt_log.see(tk.END)
        self.txt_log.config(state="disabled")

    def run_factory(self):
        try: count = int(self.ent_count.get())
        except ValueError: messagebox.showerror("Error", "Invalid number"); return
        self.btn_create.config(state="disabled")
        self.log_factory(f"--- Starting creation of {count} vehicles ---")
        threading.Thread(target=self._factory_thread, args=(count,), daemon=True).start()

    def _factory_thread(self, count):
        created_count = 0
        for i in range(count):
            self.root.after(0, lambda i=i: self.log_factory(f"Processing Vehicle {i+1}..."))
            data = utils.generate_vehicle_data()
            imei = data['imei']
            
            success, result = self.api_client.register_device(imei)
            if not success:
                self.root.after(0, lambda r=result: self.log_factory(f"  [Failed Register] {r}"))
                continue
            
            token = result
            success_act, msg_act = self.api_client.activate_device(imei, token, data)
            if success_act:
                self.root.after(0, lambda im=imei: self.log_factory(f"  [Activated] {im}"))
                utils.append_device_to_file(imei, "Simulation") # Auto-update CSV
                created_count += 1
            else:
                self.root.after(0, lambda m=msg_act: self.log_factory(f"  [Failed Activate] {m}"))
            time.sleep(0.5)

        self.root.after(0, lambda c=created_count: self._factory_finished(c))

    def _factory_finished(self, count):
        self.log_factory(f"--- Finished. Created: {count} ---")
        self.btn_create.config(state="normal")
        self.refresh_all_data()
        messagebox.showinfo("Factory Complete", f"Created {count} vehicles. Lists updated.")

    def refresh_all_data(self):
        self.load_data()
        self.cb_devices['values'] = self.devices
        self.refresh_list_tab()

    # --- Tab 4: Data Update (NEW) ---
    def setup_update_tab(self):
        f_main = ttk.Frame(self.tab_update, padding=30)
        f_main.pack(fill=tk.BOTH, expand=True)

        # 1. Device List Sync
        frame_dev = ttk.LabelFrame(f_main, text="Device List Sync", padding=15)
        frame_dev.pack(fill=tk.X, pady=10)
        
        lbl_info = ttk.Label(frame_dev, text="Fetch the latest device list from the server and update local storage (devices.csv).")
        lbl_info.pack(anchor="w", pady=5)
        
        self.btn_sync_dev = ttk.Button(frame_dev, text="Sync Device List", command=self.do_sync_devices)
        self.btn_sync_dev.pack(anchor="w", pady=5)
        
        self.lbl_sync_status = ttk.Label(frame_dev, text="Last Sync: Never", foreground="gray")
        self.lbl_sync_status.pack(anchor="w")

        # 2. Trip Data Update
        frame_trip = ttk.LabelFrame(f_main, text="Trip Data Update", padding=15)
        frame_trip.pack(fill=tk.BOTH, expand=True, pady=10)
        
        ttk.Label(frame_trip, text="Select a REAL device (not Simulation) to fetch logs:").pack(anchor="w")
        
        # Filter for non-simulation devices
        all_devs = utils.load_devices_full()
        real_devs = [d['imei'] for d in all_devs if d['type'] != 'Simulation']
        
        self.var_real_imei = tk.StringVar()
        self.cb_real_devs = ttk.Combobox(frame_trip, textvariable=self.var_real_imei, values=real_devs, state="readonly", width=30)
        self.cb_real_devs.pack(anchor="w", pady=5)
        if real_devs: self.cb_real_devs.current(0)
        
        ttk.Label(frame_trip, text="Record Limit:").pack(anchor="w")
        self.ent_limit = ttk.Entry(frame_trip, width=10)
        self.ent_limit.insert(0, "100")
        self.ent_limit.pack(anchor="w", pady=5)
        
        self.btn_fetch_logs = ttk.Button(frame_trip, text="Fetch & Append Logs", command=self.do_fetch_logs)
        self.btn_fetch_logs.pack(anchor="w", pady=10)
        
        self.txt_update_log = scrolledtext.ScrolledText(frame_trip, height=10)
        self.txt_update_log.pack(fill=tk.BOTH, expand=True)

    def log_update(self, msg):
        self.txt_update_log.insert(tk.END, msg + "\n")
        self.txt_update_log.see(tk.END)

    def do_sync_devices(self):
        self.btn_sync_dev.config(state="disabled")
        self.lbl_sync_status.config(text="Syncing...", foreground="blue")
        threading.Thread(target=self._sync_thread, daemon=True).start()

    def _sync_thread(self):
        success, data = self.api_client.fetch_all_devices()
        self.root.after(0, lambda: self._sync_result(success, data))

    def _sync_result(self, success, data):
        self.btn_sync_dev.config(state="normal")
        if success:
            utils.save_devices_list(data)
            self.lbl_sync_status.config(text=f"Success! {len(data)} devices found.", foreground="green")
            # Refresh UI lists
            self.refresh_all_data()
            # Update Real Dev Combobox
            all_devs = utils.load_devices_full()
            real_devs = [d['imei'] for d in all_devs if d.get('type') != 'Simulation']
            self.cb_real_devs['values'] = real_devs
            if real_devs: self.cb_real_devs.current(0)
        else:
            self.lbl_sync_status.config(text=f"Failed: {data}", foreground="red")

    def do_fetch_logs(self):
        imei = self.var_real_imei.get()
        if not imei: 
            return
        
        # --- Logic to make limit optional ---
        raw_limit = self.ent_limit.get().strip()
        limit = None
        
        if raw_limit:
            try:
                limit = int(raw_limit)
            except ValueError:
                # If they typed something that isn't a number, 
                # you might want to alert them or just default to None
                messagebox.showwarning("Input Error", "Please enter a valid number for the limit or leave it empty for all records.")
                return
        
        self.btn_fetch_logs.config(state="disabled")
        
        display_text = f"{limit} records" if limit else "all records"
        self.log_update(f"Fetching {display_text} for {imei}...")
        
        # Pass the 'limit' (which is now either an int or None) to the thread
        threading.Thread(
            target=self._fetch_logs_thread, 
            args=(imei, limit), 
            daemon=True
        ).start()

    def _fetch_logs_thread(self, imei, limit):
        success, records = self.api_client.fetch_device_logs(imei, limit)
        if success:
            count = len(records)
            self.root.after(0, lambda: self.log_update(f"  Got {count} records. Saving..."))
            if count > 0:
                # Append to carlogges.json
                utils.append_logs_to_file(records)
                self.root.after(0, lambda: self.log_update(f"  Saved to carlogges.json"))
                
                # Run Processor
                self.root.after(0, lambda: self.log_update(f"  Processing trips..."))
                try:
                    process_data.process_trips()
                    self.root.after(0, lambda: self.log_update(f"  Trips updated successfully."))
                    # Reload Data in App
                    self.root.after(0, self.refresh_all_data)
                except Exception as e:
                    self.root.after(0, lambda: self.log_update(f"  Processing Error: {e}"))
        else:
            self.root.after(0, lambda: self.log_update(f"  Error: {records}"))
        
        self.root.after(0, lambda: self.btn_fetch_logs.config(state="normal"))

def main():
    root = tk.Tk()
    def launch_app(api_client):
        root.deiconify()
        IotSimulatorApp(root, api_client)
    root.withdraw()
    login_win = tk.Toplevel(root)
    LoginWindow(login_win, launch_app)
    root.mainloop()

if __name__ == "__main__":
    main()