import { useMemo, useState } from "react"
import { BatteryCharging, CheckCircle2, Clock3, PlugZap, TriangleAlert, Zap } from "lucide-react"
import { PageHeader } from "./Shell"
import { useStore } from "../lib/store"
import { Badge, Empty, Field, Metric, Panel, ProvBadge, TextLink, Tween, inputCls, ButtonLink, cx } from "../components/ui"
import { CHARGERS, fmtT, inr, NOW, tariffAt } from "../lib/sim"

export function DriverHome() {
  const { sim, a, live } = useStore()
  const [selectedId, setSelectedId] = useState(sim.vehicles[0]?.id ?? "")
  const vehicle = sim.vehicles.find((item) => item.id === selectedId) ?? sim.vehicles[0]
  const session = vehicle?.session
  const tariff = tariffAt(NOW, a)
  const solarSource = live?.sources.find((s) => s.usable && s.status === "connected" && /NASA|PVGIS/i.test(s.source))
  const acnBaseline = live?.parameters.acnHistoricalBaseline
  const acnUsable = live?.sources.some((s) => s.source === "ACN-Data" && s.usable && s.status === "connected")
  // Ready only when the projected charge meets the target *and* the session ends before departure.
  const ready = vehicle ? vehicle.projectedSoC >= vehicle.requiredSoC && !vehicle.session?.late && vehicle.readiness !== "At risk" : false
  const charging = !!session && session.start <= NOW && session.end > NOW

  // Charger availability right now, derived from the simulated schedule and injected faults.
  const chargers = useMemo(() => {
    const faults = new Set(a.faults ?? [])
    return CHARGERS.map((c) => {
      const occupant = sim.sessions.find((s) => s.chargerId === c.id && s.start <= NOW && s.end > NOW)
      const next = sim.sessions.filter((s) => s.chargerId === c.id && s.start > NOW).sort((x, y) => x.start - y.start)[0]
      const derated = faults.has("dc2-comm") && c.id === "DC-2"
      return { ...c, occupant, next, derated, compatible: vehicle ? c.compat.includes(vehicle.cls) : false }
    }).sort((x, y) => Number(y.compatible) - Number(x.compatible) || Number(!!x.occupant) - Number(!!y.occupant))
  }, [sim.sessions, a.faults, vehicle])

  if (!vehicle) return <Empty title="No vehicle registered">Ask the station manager to add your vehicle to the local registry.</Empty>

  const headline = charging
    ? `Charging on ${session!.chargerId} at ${session!.powerKW} kW`
    : session
      ? `Plug in at ${session.chargerId} from ${fmtT(session.start)}`
      : ready
        ? "No charge needed before departure"
        : "No charging session scheduled"
  const verdict = ready
    ? { tone: "ok" as const, icon: CheckCircle2, text: `On track for ${vehicle.requiredSoC}% by ${fmtT(vehicle.departure)}` }
    : { tone: "err" as const, icon: TriangleAlert, text: `May not reach ${vehicle.requiredSoC}% by ${fmtT(vehicle.departure)} · ${vehicle.note}` }
  const projectedGain = Math.max(0, vehicle.projectedSoC - vehicle.soc)

  return (
    <>
      <PageHeader
        title="Driver view"
        sub="Your charging session, whether you will be ready to leave, and which plugs are free."
        right={<ButtonLink to="/app/fleet" variant="secondary" size="sm">Manage vehicles</ButtonLink>}
      />
      <Panel className="mb-5 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{vehicle.id} · {vehicle.cls}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{headline}</p>
            <p className={cx("mt-2 inline-flex items-start gap-1.5 text-sm font-medium", verdict.tone === "ok" ? "text-ok" : "text-err")}>
              <verdict.icon size={16} className="mt-0.5 shrink-0" aria-hidden />
              {verdict.text}
            </p>
            {/* Battery gauge: solid = now, lighter = projected gain, tick = required target. */}
            <div className="mt-6">
              <div
                className="relative h-4 rounded-full bg-soft ring-1 ring-line ring-inset"
                role="img"
                aria-label={`Battery ${vehicle.soc}% now, projected ${vehicle.projectedSoC}%, target ${vehicle.requiredSoC}%`}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-cyan/30 transition-[width] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ width: `${vehicle.projectedSoC}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-cyan transition-[width] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]" style={{ width: `${vehicle.soc}%` }} />
                <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-ink" style={{ left: `calc(${vehicle.requiredSoC}% - 1px)` }} />
              </div>
              <div className="tnum mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
                <span><span className="font-medium text-ink">{vehicle.soc}%</span> now{projectedGain > 0 && <> · +{projectedGain}% planned</>}</span>
                <span>Target {vehicle.requiredSoC}% · departs {fmtT(vehicle.departure)}</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-xl bg-soft p-4">
            <Field id="driver-vehicle" label="Your vehicle">
              <select id="driver-vehicle" className={inputCls} value={vehicle.id} onChange={(event) => setSelectedId(event.target.value)}>
                {sim.vehicles.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.cls}</option>)}
              </select>
            </Field>
            <div className="flex flex-wrap gap-1.5"><ProvBadge p="simulated" /><Badge tone={ready ? "ok" : "err"}>{ready ? "Ready" : "At risk"}</Badge></div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 lg:grid-cols-4">
          <Metric label="Projected charge" value={`${vehicle.projectedSoC}%`} tone={ready ? "ok" : "err"} hint={ready ? "meets target in time" : session?.late ? "reached after departure" : "below target"} />
          <Metric label="Session ends" value={session ? fmtT(session.end) : "—"} hint={session ? `${fmtT(session.start)}–${fmtT(session.end)}` : "not scheduled"} />
          <Metric label="Energy to target" value={vehicle.energyRequiredKWh.toFixed(1)} unit="kWh" hint="still required" />
          <Metric label="Tariff now" value={inr(tariff)} unit="/kWh" hint="configured time-of-use" />
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Chargers on site"
          sub={`Availability at ${fmtT(NOW)} from the simulated schedule. Compatible with your ${vehicle.cls.toLowerCase()} first.`}
          right={<ProvBadge p="simulated" />}
        >
          <ul className="divide-y divide-line">
            {chargers.map((c) => {
              const yours = session?.chargerId === c.id
              const state = c.occupant ? (c.occupant.vehicleId === vehicle.id ? "You" : "In use") : c.derated ? "Derated" : "Free"
              return (
                <li key={c.id} className={cx("flex items-center gap-3 py-3 first:pt-0 last:pb-0", !c.compatible && "opacity-55")}>
                  <span aria-hidden className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", state === "Free" ? "bg-ok-soft text-ok" : state === "You" ? "bg-info-soft text-info-ink" : state === "Derated" ? "bg-warn-soft text-warn-ink" : "bg-soft text-muted")}>
                    {c.type === "DC" ? <Zap size={16} /> : <PlugZap size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {c.id} <span className="font-normal text-muted">· {c.type} {c.derated ? "20" : c.maxKW} kW · {c.connector}</span>
                      {yours && <Badge tone="info" className="ml-2">Your plug</Badge>}
                    </p>
                    <p className="tnum truncate text-xs text-muted">
                      {!c.compatible ? `Not compatible with ${vehicle.cls.toLowerCase()}` : c.occupant ? `${c.occupant.vehicleId} until ${fmtT(c.occupant.end)}` : c.next ? `Free until ${fmtT(c.next.start)} (${c.next.vehicleId})` : "Free for the rest of the day"}
                    </p>
                  </div>
                  <Badge tone={state === "Free" ? "ok" : state === "You" ? "info" : state === "Derated" ? "warn" : "neutral"}>{state}</Badge>
                </li>
              )
            })}
          </ul>
        </Panel>
        <div className="space-y-5">
          <Panel title="Before you leave">
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3"><Clock3 size={16} className="mt-0.5 shrink-0 text-info-ink" aria-hidden /><span><span className="block font-medium">Departure {fmtT(vehicle.departure)}</span><span className="text-muted">{ready ? "Target currently covered by the plan." : "Keep the vehicle plugged in and tell your station manager."}</span></span></li>
              <li className="flex gap-3"><BatteryCharging size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden /><span><span className="block font-medium">Minimum {vehicle.requiredSoC}% state of charge</span><span className="text-muted">{vehicle.note}.</span></span></li>
            </ul>
          </Panel>
          <Panel title="Where these numbers come from" pad>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Battery and session</dt><dd className="text-right font-medium">Simulated</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Solar and weather input</dt><dd className="text-right font-medium">{solarSource ? solarSource.source : "Fallback profile"}</dd></div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Historical benchmark</dt>
                <dd className="tnum text-right font-medium">{acnUsable && acnBaseline ? <><Tween value={acnBaseline.recordCount} /> ACN sessions · {acnBaseline.averageSessionEnergyKWh?.toFixed(1) ?? "—"} kWh avg</> : "ACN not connected"}</dd>
              </div>
            </dl>
            <TextLink to="/app/datasets" className="mt-4 text-xs">Check source status</TextLink>
          </Panel>
        </div>
      </div>
    </>
  )
}
