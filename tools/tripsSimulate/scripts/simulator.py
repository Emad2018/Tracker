# simulator.py
import time
import json
import threading
import copy
from datetime import datetime, timezone
from awscrt import mqtt5
from awsiot import mqtt5_client_builder
import config

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
        if self.update_cb: self.update_cb("Paused", 0, None) 
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
                endpoint=config.ENDPOINT, cert_filepath=config.CERT_PATH, pri_key_filepath=config.KEY_PATH,
                ca_filepath=config.ROOT_CA_PATH, client_id=f"Sim_{self.imei}_{int(time.time())}"
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
            
            payload = copy.deepcopy(point)
            payload['IMEI'] = self.imei
            payload['timestamp'] = int(datetime.now(timezone.utc).timestamp()) *1000  # Convert to ms
            try:
                self.client.publish(mqtt5.PublishPacket(topic=f"{config.TOPIC_PREFIX}/{self.imei}", payload=json.dumps(payload), qos=mqtt5.QoS.AT_LEAST_ONCE))
            except Exception as e:
                print(f"Error publishing message for IMEI {self.imei}: {e}")

            if self.update_cb: self.update_cb("Running", (i+1)/total * 100, point)

            if i < total - 1:
                try:
                    t1 = datetime.strptime(point['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
                    t2 = datetime.strptime(self.trip[i+1]['timestamp'], "%Y-%m-%dT%H:%M:%SZ")
                    wait_s = (t2 - t1).total_seconds()
                    start_w = time.time()
                    while time.time() - start_w < max(0.1, wait_s):
                        if self.stopped: break
                        time.sleep(0.1)
                except: time.sleep(1.0)

        if self.client: self.client.stop()
        status = "Complete" if not self.stopped else "Stopped"
        if self.update_cb: self.update_cb(status, 100 if status == "Complete" else None, None)