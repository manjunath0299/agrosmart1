
import {
  Activity,
  Clock3,
  Cpu,
  Droplets,
  ShieldCheck,
  Wifi,
} from "lucide-react";

function StatusCard({ icon: Icon, label, value, detail, tone = "normal" }) {
  const toneClasses = {
    normal: "text-slate-200",
    good: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
    info: "text-sky-400",
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon size={19} className={toneClasses[tone]} />
      </div>
      <p className={`mt-4 break-words text-xl font-bold ${toneClasses[tone]}`}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
    </div>
  );
}

function formatNumber(value, decimals = 2) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0
  ) {
    return "Unavailable";
  }

  return Number(value).toFixed(decimals);
}

export default function DevicesPage({
  deviceId,
  deviceStatus,
  brokerConnected,
  deviceDetails,
  lastSeen,
  ageSeconds,
}) {
  const online = deviceStatus === "ONLINE";
  const flowRate = deviceDetails?.flow_rate_lpm;
  const liquidDispensed = deviceDetails?.flow_litres;
  const uptime = deviceDetails?.uptime_seconds;
  const relayEnabled = deviceDetails?.relay_outputs_enabled === true;
  const dispensingActive = deviceDetails?.irrigation_active;

  return (
    <section className="mt-6 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Hardware monitoring
        </p>
        <h2 className="mt-2 text-2xl font-bold">Connected Devices</h2>
        <p className="mt-2 text-sm text-slate-400">
          Monitor the ESP32 nutrient-dispensing controller and its reported
          telemetry. This page does not operate pumps.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          icon={Cpu}
          label="ESP32 Controller"
          value={deviceStatus || "UNKNOWN"}
          detail={`Device ID: ${deviceId}`}
          tone={online ? "good" : "warning"}
        />

        <StatusCard
          icon={Wifi}
          label="MQTT Broker"
          value={brokerConnected ? "Connected" : "Disconnected"}
          detail="Backend-reported broker connection"
          tone={brokerConnected ? "good" : "danger"}
        />

        <StatusCard
          icon={Clock3}
          label="Device Uptime"
          value={
            uptime == null || !Number.isFinite(Number(uptime))
              ? "Unavailable"
              : `${Math.floor(Number(uptime) / 3600)}h ${Math.floor(
                  (Number(uptime) % 3600) / 60
                )}m`
          }
          detail="Time since the controller started"
          tone="info"
        />

        <StatusCard
          icon={Activity}
          label="Last Device Update"
          value={
            ageSeconds == null || !Number.isFinite(Number(ageSeconds))
              ? "Unavailable"
              : `${Number(ageSeconds).toFixed(1)} seconds ago`
          }
          detail={
            lastSeen
              ? new Date(lastSeen).toLocaleString()
              : "No timestamp received"
          }
        />

        <StatusCard
          icon={Droplets}
          label="Dispensing Flow Rate"
          value={
            flowRate == null
              ? "Unavailable"
              : `${formatNumber(flowRate)} L/min`
          }
          detail="Flow reported by the ESP32; not simulated data"
          tone="info"
        />

        <StatusCard
          icon={Droplets}
          label="Reported Liquid Dispensed"
          value={
            liquidDispensed == null
              ? "Unavailable"
              : `${formatNumber(liquidDispensed)} L`
          }
          detail="Cumulative liquid volume reported by the device"
          tone="info"
        />
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={22}
            className="mt-0.5 shrink-0 text-amber-400"
          />
          <div>
            <h3 className="font-semibold text-amber-300">
              Hardware Safety — Monitoring Only
            </h3>

            <p className="mt-2 text-sm text-slate-300">
              Relay outputs:{" "}
              <strong>
                {relayEnabled
                  ? "Device reports enabled — verify hardware safety"
                  : "Disabled or not confirmed enabled"}
              </strong>
            </p>

            <p className="mt-1 text-sm text-slate-300">
              Pump/dispensing activity:{" "}
              <strong>
                {dispensingActive == null
                  ? "Unknown"
                  : dispensingActive
                    ? "Active"
                    : "Inactive"}
              </strong>
            </p>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              This page only displays device telemetry. It cannot start or stop
              dispensing. Keep ENABLE_RELAY_OUTPUTS=false and leave physical
              pumps disconnected while testing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
