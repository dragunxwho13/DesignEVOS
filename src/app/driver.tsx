import { useMemo, useState } from "react"
import { BatteryCharging, CarFront, Clock3, MapPin, PlugZap } from "lucide-react"
import { PageHeader } from "./Shell"
import { useStore } from "../lib/store"
import { Badge, Button, Empty, Metric, Panel, Status, inputCls, ButtonLink } from "../components/ui"
import { fmtT, inr, NOW, tariffAt } from "../lib/sim"

export function DriverHome() {
  const { sim, a, live } = useStore()
  const [selectedId, setSelectedId] = useState(sim.vehicles[0]?.id ?? "")
  const vehicle = sim.vehicles.find((item) => item.id === selectedId) ?? sim.vehicles[0]
  const session = vehicle?.session
  const tariff = tariffAt(NOW, a)
  const liveSource = live?.sources.find((source) => source.usable)
  const acnBaseline = live?.parameters.acnHistoricalBaseline
  const ready = vehicle ? vehicle.projectedSoC >= vehicle.requiredSoC : false
  const eta = session ? fmtT(session.end) : "No active session"
  const statusText = session?.start !== undefined && session.start <= NOW && session.end > NOW
    ? `Charging on ${session.chargerId} at ${session.powerKW} kW`
    : ready
      ? "Ready for your next departure"
      : session
        ? `Scheduled on ${session.chargerId} at ${fmtT(session.start)}`
        : "No session scheduled"

  const nearby = useMemo(
    () => [
      { id: "DC-1", type: "DC fast", status: "Available", power: "30 kW", distance: "On site" },
      { id: "AC-1", type: "AC", status: "Available", power: "7.4 kW", distance: "On site" },
      { id: "AC-2", type: "AC", status: "In use", power: "7.4 kW", distance: "On site" },
    ],
    [],
  )

  if (!vehicle) return <Empty title="No vehicle registered">Ask the station manager to add your vehicle to the local registry.</Empty>

  return (
    <>
      <PageHeader
        title="Driver view"
        sub="A focused view of your charging session, departure readiness, cost context and available plugs."
        right={<ButtonLink to="/app/fleet" variant="secondary" size="sm">Manage vehicles</ButtonLink>}
      />
      <Panel className="mb-5 border-cyan/30 bg-gradient-to-br from-white to-mint/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted"><CarFront size={16} />Choose vehicle</div>
            <select className={`${inputCls} mt-2 min-w-52`} value={vehicle.id} onChange={(event) => setSelectedId(event.target.value)}>
              {sim.vehicles.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.cls}</option>)}
            </select>
          </div>
          <Badge tone={ready ? "ok" : session ? "info" : "neutral"}>{statusText}</Badge>
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Current SoC" value={`${vehicle.soc}%`} hint={`target ${vehicle.requiredSoC}%`} />
          <Metric label="Projected at completion" value={`${vehicle.projectedSoC}%`} hint={eta} />
          <Metric label="Energy remaining" value={`${vehicle.energyRequiredKWh.toFixed(1)} kWh`} hint="to target SoC" />
          <Metric label="Estimated rate" value={inr(tariff)} hint="per kWh at this time" />
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Your charging session" sub={liveSource ? `Source context: ${liveSource.source} · ${liveSource.provenance}` : "Session details are from the station's configured operational model."}>
          {session ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-soft p-4"><div className="flex items-center gap-2 text-sm font-medium"><BatteryCharging size={16} className="text-teal" />Charge progress</div><div className="mt-4 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, (vehicle.projectedSoC / vehicle.requiredSoC) * 100)}%` }} /></div><p className="tnum mt-2 text-sm text-muted">{vehicle.projectedSoC}% projected · finishes {eta}</p></div>
              <div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted">Charger</span><b>{session.chargerId}</b></div><div className="flex justify-between"><span className="text-muted">Power</span><b>{session.powerKW} kW</b></div><div className="flex justify-between"><span className="text-muted">Window</span><b>{fmtT(session.start)}–{fmtT(session.end)}</b></div><div className="flex justify-between"><span className="text-muted">Departure</span><b>{fmtT(vehicle.departure)}</b></div></div>
            </div>
          ) : <Empty title="No charging session">Your manager has not scheduled a session for this vehicle.</Empty>}
        </Panel>
        <Panel title="Charging benchmark" sub="Historical ACN-Data context for the site, not this vehicle's live telemetry.">
          {acnBaseline ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Historical sessions" value={acnBaseline.recordCount} />
              <Metric label="Average delivered" value={`${acnBaseline.averageSessionEnergyKWh?.toFixed(1) ?? "—"} kWh`} />
              <Metric label="Observed stations" value={acnBaseline.stationCount} />
            </div>
          ) : (
            <p className="text-sm text-muted">ACN benchmark data will appear when the backend returns a usable response.</p>
          )}
        </Panel>
        <Panel title="Available chargers" sub="Use the closest compatible plug; availability is refreshed with the workspace.">
          <ul className="divide-y divide-line">{nearby.map((charger) => <li key={charger.id} className="flex items-center gap-3 py-3 first:pt-0"><PlugZap size={17} className={charger.status === "Available" ? "text-teal" : "text-muted"} /><div className="min-w-0 flex-1"><p className="font-medium">{charger.id} <span className="text-xs font-normal text-muted">· {charger.type}</span></p><p className="text-xs text-muted"><MapPin size={11} className="mr-1 inline" />{charger.distance} · {charger.power}</p></div><Status s={charger.status === "Available" ? "Ready" : "Charging"} /></li>)}</ul>
        </Panel>
        <Panel title="Before you leave" sub="The checks a driver needs at a glance.">
          <ul className="space-y-3 text-sm"><li className="flex gap-3"><Clock3 size={16} className="mt-0.5 text-cyan" /><span><b>Departure</b><br /><span className="text-muted">{fmtT(vehicle.departure)} · {ready ? "target currently covered" : "keep this vehicle plugged in"}</span></span></li><li className="flex gap-3"><BatteryCharging size={16} className="mt-0.5 text-teal" /><span><b>Target</b><br /><span className="text-muted">{vehicle.requiredSoC}% minimum SoC · {vehicle.note}</span></span></li></ul>
        </Panel>
      </div>
    </>
  )
}
