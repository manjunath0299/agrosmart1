
import json
import uuid
import time
import threading
from datetime import datetime

import paho.mqtt.client as mqtt


BROKER_HOST = "localhost"
BROKER_PORT = 1883

DEFAULT_DEVICE_ID = "ESP32-001"

# ESP32 sends status every 5 seconds.
# Mark it offline after 15 seconds without a valid message.
DEVICE_TIMEOUT_SECONDS = 15


class MQTTService:
    def __init__(
        self,
        broker_host: str = BROKER_HOST,
        broker_port: int = BROKER_PORT,
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port

        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"AgroSmart-FastAPI-{uuid.uuid4().hex[:8]}",
        )

        self.connected = False

        # Latest status received from each ESP32 device.
        self.device_statuses = {}
        self.status_lock = threading.Lock()

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        self._connect()

    # ---------------------------------------------------------
    # MQTT CONNECTION
    # ---------------------------------------------------------

    def _connect(self):
        try:
            self.client.connect(
                self.broker_host,
                self.broker_port,
                keepalive=60,
            )

            self.client.loop_start()

        except Exception as exc:
            self.connected = False
            print(f"[MQTT] Connection failed: {exc}")

    def _on_connect(
        self,
        client,
        userdata,
        flags,
        reason_code,
        properties=None,
    ):
        if reason_code == 0:
            self.connected = True
            print(
                f"[MQTT] Connected to "
                f"{self.broker_host}:{self.broker_port}"
            )

            # Listen for status messages from ESP32 devices.
            result, message_id = client.subscribe(
                "agrosmart/devices/+/status",
                qos=0,
            )

            if result == mqtt.MQTT_ERR_SUCCESS:
                print("[MQTT] Subscribed to ESP32 status messages")
            else:
                print(
                    f"[MQTT] Status subscription failed: {result}"
                )

        else:
            self.connected = False
            print(
                f"[MQTT] Connection rejected: {reason_code}"
            )

    def _on_disconnect(
        self,
        client,
        userdata,
        disconnect_flags,
        reason_code,
        properties=None,
    ):
        self.connected = False
        print("[MQTT] Disconnected")

    # ---------------------------------------------------------
    # RECEIVE ESP32 STATUS
    # ---------------------------------------------------------

    def _on_message(self, client, userdata, message):
        prefix = "agrosmart/devices/"
        suffix = "/status"

        topic = message.topic

        if not topic.startswith(prefix) or not topic.endswith(suffix):
            return

        device_id = topic[len(prefix):-len(suffix)]

        if not device_id:
            return

        try:
            payload = json.loads(message.payload.decode("utf-8"))

            if not isinstance(payload, dict):
                raise ValueError("Status payload must be a JSON object")

            # Only accept a status message that identifies the
            # same device as the MQTT topic.
            payload_device_id = payload.get("device_id")

            if payload_device_id != device_id:
                print(
                    f"[MQTT] Ignored mismatched device ID on {topic}"
                )
                return

        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            print(f"[MQTT] Invalid status message on {topic}: {exc}")
            return

        received_at = datetime.now().astimezone().isoformat(
            timespec="seconds"
        )

        with self.status_lock:
            self.device_statuses[device_id] = {
                "payload": payload,
                "last_seen": received_at,
                "last_seen_monotonic": time.monotonic(),
            }

        print(f"[MQTT] Status received from {device_id}")

    # ---------------------------------------------------------
    # DEVICE TOPICS
    # ---------------------------------------------------------

    @staticmethod
    def command_topic(device_id: str) -> str:
        return f"agrosmart/devices/{device_id}/command"

    @staticmethod
    def status_topic(device_id: str) -> str:
        return f"agrosmart/devices/{device_id}/status"

    # ---------------------------------------------------------
    # DEVICE STATUS / ONLINE CHECK
    # ---------------------------------------------------------

    def get_device_status(
        self,
        device_id: str = DEFAULT_DEVICE_ID,
    ) -> dict:
        with self.status_lock:
            record = self.device_statuses.get(device_id)

            if record is None:
                return {
                    "device_id": device_id,
                    "status": "UNKNOWN",
                    "last_seen": None,
                    "age_seconds": None,
                    "details": None,
                    "message": "No valid status message received yet.",
                }

            # Copy values while holding the lock.
            payload = dict(record["payload"])
            last_seen = record["last_seen"]
            last_seen_monotonic = record["last_seen_monotonic"]

        age_seconds = max(
            0,
            round(time.monotonic() - last_seen_monotonic, 1),
        )

        device_state = (
            "ONLINE"
            if age_seconds <= DEVICE_TIMEOUT_SECONDS
            else "OFFLINE"
        )

        return {
            "device_id": device_id,
            "status": device_state,
            "last_seen": last_seen,
            "age_seconds": age_seconds,
            "details": payload,
            "message": (
                "Recent ESP32 status received."
                if device_state == "ONLINE"
                else "ESP32 status message is stale."
            ),
        }

    # ---------------------------------------------------------
    # PUBLISH SPRAY COMMAND
    # ---------------------------------------------------------

    def publish_spray_command(
        self,
        device_id: str,
        bottle: int,
        target_volume_ml: float,
    ) -> dict:

        if not self.connected:
            raise RuntimeError(
                "MQTT broker is not connected."
            )

        command_id = (
            f"SP-"
            f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-"
            f"{uuid.uuid4().hex[:6].upper()}"
        )

        payload = {
            "command_id": command_id,
            "device_id": device_id,
            "action": "SPRAY",
            "bottle": bottle,
            "target_volume_ml": target_volume_ml,
        }

        topic = self.command_topic(device_id)

        result = self.client.publish(
            topic,
            json.dumps(payload),
            qos=1,
        )

        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise RuntimeError(
                f"MQTT publish failed: {result.rc}"
            )

        print("\n[MQTT] SPRAY COMMAND PUBLISHED")
        print(f"Topic   : {topic}")
        print(json.dumps(payload, indent=2))

        return {
            "published": True,
            "command_id": command_id,
            "device_id": device_id,
            "topic": topic,
            "payload": payload,
        }

    # ---------------------------------------------------------
    # HEALTH
    # ---------------------------------------------------------

    def health(self) -> dict:
        return {
            "connected": self.connected,
            "broker": self.broker_host,
            "port": self.broker_port,
            "devices": {
                DEFAULT_DEVICE_ID: self.get_device_status(
                    DEFAULT_DEVICE_ID
                )
            },
        }


# Singleton used by FastAPI.
mqtt_service = MQTTService()
