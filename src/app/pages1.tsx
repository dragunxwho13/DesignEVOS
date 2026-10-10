import { useMemo, useState } from "react";
import { Search, ArrowRight, ArrowUpDown, ChevronLeft } from "lucide-react";
import { PageHeader } from "./Shell";
import { useStore } from "../lib/store";
import { Link, navigate } from "../lib/router";
import { Panel, Metric, Status, Badge, Segmented, Empty, Note, inputCls, cx, ButtonLink, Button, Disclosure, InfoTip, Drawer, DataState, useLoad, ProvBadge, Tween } from "../components/ui";
import ConstraintEditor from "./ConstraintEditor";
import { getBackend } from "../services";
import { TimeChart, Donut, Legend, C } from "../components/charts";
import EnergySchematic from "../components/EnergySchematic";
import { CHARGERS, NOW, STEPS, fmtT, inr, sohTrend, CHARGE_EFF, STRATEGIES, compareStrategies, type Readiness, type VehicleState, type Strategy } from "../lib/sim";

const hourLabels = (from = 0) => Array.from({ length: STEPS - from }, (_, i) => fmtT(i + from));

export function Overview() {
  const { sim, alerts, acked } = useStore();
  const t = sim.totals;
  const now = sim.flows[NOW];
  const counts = (["Ready", "Charging", "Scheduled", "At risk", "Idle", "Unavailable"] as Readiness[]).map((r) => ({ r, n: sim.vehicles.filter((v) => v.readiness === r).length }));
  const colors: Record<string, string> = { Ready: C.teal, Charging: C.cyan, Scheduled: "#9FB3C8", "At risk": C.err, Idle: "#D9E2EC", Unavailable: C.warn };
  const ready = counts[0].n;
  const activeSessions = sim.sessions.filter((s) => s.start <= NOW && s.end > NOW);
  const queue = sim.sessions.filter((s) => s.start > NOW).sort((a, b) => a.start - b.start).slice(0, 6);
  const openAlerts = alerts.filter((a) => !acked.has(a.id));
  const events = [
    ...sim.sessions.filter((s) => s.start <= NOW).map((s) => ({ t: s.start, text: `${s.vehicleId} started charging on ${s.chargerId} at ${s.powerKW} kW` })),
    ...alerts.filter((a) => a.time <= NOW).map((a) => ({ t: a.time, text: `${a.asset}: ${a.title}` })),
    { t: 24, text: "Off-peak tariff window ended" },
    { t: 26, text: "PV generation started" },
  ].sort((a, b) => b.t - a.t).slice(0, 6);

  return (
    <>
      <PageHeader title="Overview" sub="Readiness, charging and energy for the demo depot at a glance. Select any panel to go deeper." right={<ButtonLink to="/app/scenarios" variant="secondary" size="sm">Run a scenario</ButtonLink>} />
      <Panel className="mb-5">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <div className="text-xs font-medium text-muted">Fleet readiness for upcoming departures</div>
            <div className="tnum mt-1 text-5xl font-semibold tracking-tight"><Tween value={ready} /><span className="text-xl text-muted"> / 20 ready</span></div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={counts.map((c) => `${c.r} ${c.n}`).join(", ")}>
              {counts.map((c) => c.n > 0 && <div key={c.r} style={{ width: `${c.n * 5}%`, background: colors[c.r], transition: "width 600ms cubic-bezier(0.65,0,0.35,1)" }} />)}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {counts.map((c) => <li key={c.r} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[c.r] }} />{c.r} <span className="tnum font-medium text-ink"><Tween value={c.n} /></span></li>)}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-6 border-line sm:grid-cols-4 lg:border-l lg:pl-8">
            <Metric label="Active sessions" value={activeSessions.length} hint={`${queue.length ? "next " + fmtT(queue[0].start) : "none queued"}`} />
            <Metric label="Demand now" value={now.load.toFixed(0)} unit="kW" hint={`limit ${sim.a.gridLimitKW} kW grid`} />
            <Metric label="Renewable share" value={`${Math.round(t.renewableShare * 100)}%`} hint="solar-derived, today" />
            <Metric label="Estimated cost" value={inr(t.cost)} hint="grid import, today" />
          </div>
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Energy mix through the day" sub="Supply to site demand, kW, 15-min steps. Shaded area is forecast." right={<Link to="/app/energy" className="text-sm font-medium text-[#0d7584] hover:underline">Energy manager</Link>}>
          <TimeChart title="Energy mix" summary={`PV ${t.pvToLoad.toFixed(0)} kWh, storage ${t.storageToLoad.toFixed(0)} kWh, grid ${t.grid.toFixed(0)} kWh.`} unit="kW" height={260}
            xLabels={hourLabels()} marker={{ x: NOW, label: "Now · forecast →" }} refLines={[{ y: sim.a.gridLimitKW, label: `Grid limit ${sim.a.gridLimitKW} kW`, color: C.err }]}
            series={[
              { key: "pv", label: "PV to load", color: C.teal, kind: "area", stack: true, values: sim.flows.map((f) => f.pvToLoad) },
              { key: "st", label: "Storage", color: C.storage, kind: "area", stack: true, values: sim.flows.map((f) => f.storageToLoad) },
              { key: "gr", label: "Grid", color: "#AEB9C7", kind: "area", stack: true, values: sim.flows.map((f) => f.grid) },
            ]} />
        </Panel>
        <Panel title="Alerts" sub={`${openAlerts.length} open`} right={<Link to="/app/alerts" className="text-sm font-medium text-[#0d7584] hover:underline">All alerts</Link>}>
          <ul className="divide-y divide-line">
            {openAlerts.slice(0, 3).map((a) => (
              <li key={a.id} className="py-3 first:pt-0"><div className="flex items-center justify-between gap-2"><Status s={a.severity} /><span className="tnum text-xs text-muted">{fmtT(a.time)}</span></div><p className="mt-1.5 text-sm font-medium">{a.asset} · {a.title}</p></li>
            ))}
            {!openAlerts.length && <Empty title="No open alerts">All alerts are acknowledged.</Empty>}
          </ul>
        </Panel>
        <Panel title="Charging queue" sub={queue.length ? `Next: ${queue[0].vehicleId} at ${fmtT(queue[0].start)} · ${queue.length} queued` : "Nothing queued"} collapsible="ov-queue" defaultOpen={false} right={<Link to="/app/scheduler" className="text-sm font-medium text-[#0d7584] hover:underline">Scheduler</Link>}>
          {queue.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Vehicle</th><th className="pb-2 font-medium">Charger</th><th className="pb-2 font-medium">Window</th><th className="pb-2 font-medium">Departure</th><th className="pb-2 text-right font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {queue.map((s) => {
                    const v = sim.vehicles.find((x) => x.id === s.vehicleId)!;
                    return (
                      <tr key={s.vehicleId} className="cursor-pointer hover:bg-soft" onClick={() => navigate(`/app/fleet/${v.id}`)}>
                        <td className="py-2.5 font-medium"><Link to={`/app/fleet/${v.id}`}>{v.id}</Link></td><td className="tnum">{s.chargerId}</td><td className="tnum">{fmtT(s.start)}–{fmtT(s.end)}</td><td className="tnum">{fmtT(v.departure)}</td><td className="text-right"><Status s={v.readiness} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <Empty title="Queue is empty">All requested vehicles are charging or complete.</Empty>}
        </Panel>
        <Panel title="Recent events" sub={`${events.length} latest simulated events today`} collapsible="ov-events" defaultOpen={false}>
          <ol className="relative space-y-4 border-l border-line pl-4">
            {events.map((e, i) => (
              <li key={i} className="relative"><span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full border-2 border-white bg-cyan" /><span className="tnum text-xs text-muted">{fmtT(e.t)}</span><p className="text-sm">{e.text}</p></li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}

type SortKey = "id" | "soc" | "departure" | "soh" | "energy";
export function Fleet() {
  const { a } = useStore();
  const state = useLoad(() => getBackend().vehicles.list(a), [a], (d) => d.length === 0);
  const list = state.status === "ready" ? state.data : [];
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("All");
  const [st, setSt] = useState("All");
  const [sort, setSort] = useState<SortKey>("departure");
  const [dir, setDir] = useState<1 | -1>(1);
  const rows = useMemo(() => {
    const r = list.filter((v) =>
      (cls === "All" || v.cls === cls) && (st === "All" || v.readiness === st) &&
      (q === "" || `${v.id} ${v.cls} ${v.session?.chargerId ?? ""}`.toLowerCase().includes(q.toLowerCase())));
    const val = (v: VehicleState) => (sort === "id" ? v.id : sort === "soc" ? v.soc : sort === "soh" ? v.estSoH : sort === "energy" ? v.energyRequiredKWh : v.departure);
    return r.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  }, [list, q, cls, st, sort, dir]);
  const sig = `${q}|${cls}|${st}|${sort}|${dir}`;
  const th = (k: SortKey, label: string) => (
    <th className="px-4 py-3 font-medium" aria-sort={sort === k ? (dir === 1 ? "ascending" : "descending") : "none"}>
      <button className={cx("inline-flex items-center gap-1 hover:text-ink", sort === k && "text-ink")} onClick={() => (sort === k ? setDir(dir === 1 ? -1 : 1) : (setSort(k), setDir(1)))}>{label}<ArrowUpDown size={12} aria-hidden /></button>
    </th>
  );
  return (
    <>
      <PageHeader title="Fleet" sub={`${list.length || 20} simulated campus vehicles: 6 shuttle buses, 4 service vans and 10 utility carts. Select a vehicle for detail.`} right={<ProvBadge p="simulated" />} />
      <Panel pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-56 flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="fleet-q" className="sr-only">Search vehicles</label>
            <input id="fleet-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by ID, class or charger" className={cx(inputCls, "pl-9")} />
          </div>
          <label className="sr-only" htmlFor="fleet-cls">Class</label>
          <select id="fleet-cls" value={cls} onChange={(e) => setCls(e.target.value)} className={cx(inputCls, "w-auto")}>
            {["All", "Shuttle bus", "Service van", "Utility cart"].map((c) => <option key={c} value={c}>{c === "All" ? "All classes" : c}</option>)}
          </select>
          <label className="sr-only" htmlFor="fleet-st">Readiness</label>
          <select id="fleet-st" value={st} onChange={(e) => setSt(e.target.value)} className={cx(inputCls, "w-auto")}>
            {["All", "Ready", "Charging", "Scheduled", "At risk", "Idle", "Unavailable"].map((c) => <option key={c} value={c}>{c === "All" ? "All statuses" : c}</option>)}
          </select>
          <span className="tnum text-xs text-muted" aria-live="polite">{rows.length} of {list.length}{(q || cls !== "All" || st !== "All") && " · filtered"}</span>
          {(q || cls !== "All" || st !== "All") && <Button size="sm" variant="ghost" onClick={() => { setQ(""); setCls("All"); setSt("All"); }}>Clear filters</Button>}
        </div>
        {state.status !== "ready" ? <DataState state={state} emptyTitle="No vehicles loaded">{() => null}</DataState> : rows.length === 0 ? (
          <div className="p-6"><Empty title="No matching vehicles">Try a different search or <button className="font-medium text-[#0d7584] underline" onClick={() => { setQ(""); setCls("All"); setSt("All"); }}>clear filters</button>.</Empty></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-soft/60 text-left text-xs text-muted">
                  <tr>{th("id", "Vehicle")}<th className="px-4 py-3 font-medium">Class</th>{th("soc", "SoC / target")}{th("soh", "Est. SoH")}<th className="px-4 py-3 font-medium">Readiness</th><th className="px-4 py-3 font-medium">Priority</th>{th("departure", "Arrival → departure")}{th("energy", "Energy req.")}<th className="px-4 py-3 font-medium">Charger</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((v, i) => (
                    <tr key={`${v.id}|${sig}`} style={{ ["--i" as string]: i }} className="row-in group cursor-pointer transition-colors duration-150 hover:bg-soft" onClick={() => navigate(`/app/fleet/${v.id}`)}>
                      <td className="px-4 py-3 font-medium"><Link to={`/app/fleet/${v.id}`} onClick={(e) => e.stopPropagation()}>{v.id}</Link></td>
                      <td className="px-4 py-3 text-muted">{v.cls}</td>
                      <td className="px-4 py-3"><SocBar v={v} /></td>
                      <td className="tnum px-4 py-3">{v.estSoH}% <span className="text-xs text-muted">± {v.sohUnc}</span></td>
                      <td className="px-4 py-3"><Status s={v.readiness} /></td>
                      <td className="px-4 py-3 text-xs">{v.priority === "Normal" ? <span className="text-muted">Normal</span> : <Badge tone={v.priority === "High" ? "info" : "neutral"}>{v.priority}</Badge>}</td>
                      <td className="tnum px-4 py-3">{fmtT(v.arrival)} → {fmtT(v.departure)} <span className="text-xs text-muted">· {v.requiredSoC}%</span></td>
                      <td className="tnum px-4 py-3">{v.energyRequiredKWh ? `${v.energyRequiredKWh.toFixed(1)} kWh` : <span className="text-muted">—</span>}</td>
                      <td className="tnum px-4 py-3">{v.session?.chargerId ?? <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-3 text-right"><ArrowRight size={15} className="inline text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {rows.map((v, i) => (
                <li key={`${v.id}|${sig}`} style={{ ["--i" as string]: i }} className="row-in"><Link to={`/app/fleet/${v.id}`} className="block p-4 active:bg-soft">
                  <div className="flex items-center justify-between"><span className="font-medium">{v.id} <span className="text-xs font-normal text-muted">· {v.cls}</span></span><Status s={v.readiness} /></div>
                  <div className="mt-2"><SocBar v={v} /></div>
                  <div className="tnum mt-2 flex justify-between text-xs text-muted"><span>Departs {fmtT(v.departure)} · needs {v.requiredSoC}%</span><span>{v.session?.chargerId ?? "No charger"}</span></div>
                </Link></li>
              ))}
            </ul>
          </>
        )}
      </Panel>
      <p className="mt-3 text-xs text-muted">SoC = state of charge (battery fill level). SoH = state of health, estimated battery capacity relative to new. Both are simulated demo values.</p>
    </>
  );
}

function SocBar({ v }: { v: VehicleState }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1.5 w-24 rounded-full bg-line" role="img" aria-label={`SoC ${v.soc}%, target ${v.requiredSoC}%`}>
        <div className="absolute h-1.5 rounded-full" style={{ width: `${v.soc}%`, background: v.soc >= v.requiredSoC ? C.teal : v.soc < 30 ? C.warn : C.cyan }} />
        <div className="absolute -top-1 h-3.5 w-px bg-ink" style={{ left: `${v.requiredSoC}%` }} />
      </div>
      <span className="tnum w-9 text-sm">{v.soc}%</span>
    </div>
  );
}

export function VehicleDetail({ id }: { id: string }) {
  const { sim, alerts } = useStore();
  const [edit, setEdit] = useState(false);
  const v = sim.vehicles.find((x) => x.id === id);
  if (!v) return (<><PageHeader title="Vehicle not found" sub={`No vehicle with ID “${id}” exists in the demo fleet.`} /><ButtonLink to="/app/fleet" variant="secondary">Back to fleet</ButtonLink></>);
  const s = v.session;
  const socLine = Array.from({ length: STEPS }, (_, t) => {
    if (!s) return v.soc;
    if (t < s.start) return v.soc;
    const done = Math.min(t, s.end) - s.start;
    return Math.min(100, v.soc + (s.powerKW * done * 0.25 * CHARGE_EFF / v.capKWh) * 100);
  });
  const trend = sohTrend(v);
  return (
    <>
      <Link to="/app/fleet" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} />Fleet</Link>
      <PageHeader title={v.id} sub={`${v.cls} · ${v.capKWh} kWh battery · accepts up to ${v.maxKW} kW${v.dcOnly ? " (DC only)" : v.acOnly ? " (AC only)" : ""}`} right={<div className="flex items-center gap-2"><Status s={v.readiness} /><Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit constraints</Button></div>} />
      {alerts.filter((x) => x.asset === v.id).map((x) => (
        <div key={x.id} role="status" className={cx("mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm", x.severity === "Critical" ? "bg-[#f6e3e2]" : "bg-[#f8eedd]")}>
          <Status s={x.severity} /><span><b className="font-medium">{x.title}.</b> <span className="text-muted">{x.detail}</span></span>
        </div>
      ))}
      {v.dataIssue && <p className="mb-4 rounded-lg bg-[#f8eedd] px-4 py-3 text-sm text-[#8a5f1f]">◆ Data quality: {v.dataIssue}</p>}
      <Drawer open={edit} onClose={() => setEdit(false)} title={`Constraints · ${v.id}`}><ConstraintEditor vehicleId={v.id} onDone={() => setEdit(false)} /></Drawer>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel title="Charging timeline" sub="Simulated SoC across the demo day. Solid = plan before now; dashed = projected.">
          <TimeChart title={`${v.id} SoC timeline`} summary={`From ${v.soc}% to projected ${v.projectedSoC}% by departure at ${fmtT(v.departure)}.`} unit="%" yMax={100} height={240}
            xLabels={hourLabels()} marker={{ x: NOW, label: "Now" }}
            refLines={[{ y: v.requiredSoC, label: `Required ${v.requiredSoC}%`, color: C.teal }]}
            series={[
              { key: "h", label: "SoC (simulated)", color: C.ink, kind: "line", values: socLine.map((x, t) => (t <= NOW ? x : undefined)) },
              { key: "p", label: "Projected SoC", color: C.cyan, kind: "dashed", values: socLine.map((x, t) => (t >= NOW && t <= v.departure ? x : undefined)) },
            ]} />
          <div className="mt-4 grid grid-cols-2 gap-6 border-t border-line pt-4 sm:grid-cols-4">
            <Metric label="Current SoC" value={`${v.soc}%`} />
            <Metric label="Projected at departure" value={`${v.projectedSoC}%`} tone={v.projectedSoC < v.requiredSoC ? "err" : "ok"} hint={v.projectedSoC < v.requiredSoC ? "below target" : "meets target"} />
            <Metric label="Energy to deliver" value={s ? s.energyKWh.toFixed(1) : "0"} unit="kWh" />
            <Metric label="Departure" value={fmtT(v.departure)} hint={`needs ${v.requiredSoC}%`} />
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Current assignment">
            {s ? (
              <dl className="space-y-2 text-sm">
                {[["Charger", `${s.chargerId} · ${s.powerKW} kW`], ["Window", `${fmtT(s.start)}–${fmtT(s.end)}`], ["Priority rank", `#${s.rank} (score ${s.priority})`], ["Status", v.note]].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="tnum text-right font-medium">{val}</dd></div>
                ))}
              </dl>
            ) : <p className="text-sm text-muted">{v.note}.</p>}
            {s && <ButtonLink to={`/app/explain/${v.id}`} variant="secondary" size="sm" className="mt-4 w-full">Why this assignment?</ButtonLink>}
          </Panel>
          <Panel title="Constraints" sub={s ? `${s.constraints.length} constraints applied` : "None active"} collapsible="vd-cons" defaultOpen={false}>
            {s ? <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">{s.constraints.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-muted">No active charging constraints.</p>}
          </Panel>
        </div>
        <Panel title="Estimated battery health" sub={`${v.estSoH}% ± ${v.sohUnc} estimated · show 12-month trend`} collapsible="vd-soh" defaultOpen={false} right={v.sohFlag ? <Badge tone="warn">Flag</Badge> : <Badge tone="ok">No flag</Badge>}>
          <TimeChart title="SoH trend" summary={`Estimated SoH ${v.estSoH}% ± ${v.sohUnc}.`} unit="%" height={190} yMax={100}
            xLabels={trend.map((p) => `M-${11 - p.m}`)} band={{ lo: trend.map((p) => p.lo), hi: trend.map((p) => p.hi), color: C.teal, label: "Uncertainty" }}
            series={[{ key: "s", label: "Estimated SoH", color: C.teal, kind: "line", values: trend.map((p) => p.value) }]} />
          {v.sohFlag && <p className="mt-3 text-sm text-[#8a5f1f]">{v.sohFlag}.</p>}
        </Panel>
        <Panel title="Data sources and provenance" sub="Simulated demo fleet · estimated SoH" collapsible="vd-prov" defaultOpen={false}>
          <dl className="space-y-2 text-sm">
            {[["Vehicle record", "Simulated demo fleet"], ["SoC", "Simulated, start of window"], ["SoH", "Estimated (cycle/age heuristic)"], ["Schedule", "EVOS demo heuristic"], ["Cycles · age", `${v.cycles} · ${v.ageMonths} months`]].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{val}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}

export function Scheduler() {
  const { sim, a, change, setA, toast } = useStore();
  const [sel, setSel] = useState<string | null>(sim.sessions[0]?.vehicleId ?? null);
  const [edit, setEdit] = useState<string | null>(null);
  const cmp = useMemo(() => compareStrategies(a), [a]);
  const strat = STRATEGIES.find((x) => x.id === a.strategy)!;
  const nOv = Object.keys(a.overrides).length;
  const span = STEPS - NOW;
  const pos = (t: number) => `${((t - NOW) / span) * 100}%`;
  const hours = Array.from({ length: 15 }, (_, i) => NOW + i * 4);
  const s = sim.sessions.find((x) => x.vehicleId === sel);
  const conflicts = sim.sessions.filter((x) => x.late || x.delayedByCap);
  const loadSeries = sim.flows.slice(NOW);
  return (
    <>
      <PageHeader title="Charging scheduler" sub="Assign requested vehicles to chargers. Choose a strategy, adjust vehicle constraints and see how the schedule, energy and cost respond." right={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Scheduling strategy" value={a.strategy} onChange={(v: Strategy) => change({ ...a, strategy: v }, `Strategy set to ${STRATEGIES.find((x) => x.id === v)!.short} — all views updated`)} options={STRATEGIES.map((x) => ({ v: x.id, label: x.short }))} />
          <Button size="sm" variant="secondary" onClick={() => setEdit(sel ?? sim.sessions[0]?.vehicleId ?? "BUS-01")}>Edit vehicle constraints</Button>
        </div>} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-white px-5 py-3.5 text-sm">
        <p className="max-w-3xl text-muted"><b className="font-semibold text-ink">{strat.label}.</b> {strat.desc}</p>
        <div className="flex items-center gap-2">
          <ProvBadge p="simulated" />
          {nOv > 0 && <Button size="sm" variant="ghost" onClick={() => { setA({ ...a, overrides: {} }); toast(`${nOv} vehicle override${nOv > 1 ? "s" : ""} cleared`); }}>Clear {nOv} override{nOv > 1 ? "s" : ""}</Button>}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-5 rounded-xl border border-line bg-white px-5 py-4 sm:grid-cols-4" aria-live="polite">
        <Metric label="Departures met" value={`${sim.totals.onTime}/${sim.totals.requested}`} tone={sim.totals.atRisk ? "err" : "ok"} hint={sim.totals.atRisk ? `${sim.totals.atRisk} at risk` : "all on time"} />
        <Metric label="Total lateness" value={`${sim.totals.lateMinutes} min`} />
        <Metric label="Peak grid import" value={`${sim.totals.peakGrid.toFixed(1)} kW`} hint={`limit ${a.gridLimitKW} kW${sim.totals.exceedSteps ? ` · ▲ exceeded ${sim.totals.exceedSteps * 15} min` : ""}`} tone={sim.totals.exceedSteps ? "err" : undefined} />
        <Metric label="Estimated cost" value={inr(sim.totals.cost)} hint="grid import, demo day" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Panel title="Charger lanes" sub={`${fmtT(NOW)}–24:00 · ${sim.sessions.length} sessions · select a bar for its rationale`} className="min-w-0">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="relative ml-20 h-6 text-[10.5px] text-muted">
                {hours.map((t) => <span key={t} className="tnum absolute -translate-x-1/2" style={{ left: pos(t) }}>{fmtT(t)}</span>)}
              </div>
              {CHARGERS.map((c) => {
                const fault = sim.a.chargerFault && c.id === "AC-4";
                return (
                  <div key={c.id} className="flex items-center border-t border-line py-2">
                    <div className="w-20 shrink-0"><div className="text-sm font-medium">{c.id}</div><div className="text-[11px] text-muted">{c.type} · {c.maxKW} kW</div></div>
                    <div className={cx("relative h-10 flex-1 rounded-md", fault ? "bg-[repeating-linear-gradient(135deg,#f6e3e2_0_6px,#fff_6px_12px)]" : "bg-soft")}>
                      {hours.map((t) => <span key={t} className="absolute inset-y-0 w-px bg-white" style={{ left: pos(t) }} />)}
                      {fault && <span className="absolute inset-0 grid place-items-center text-xs font-medium text-err">▲ Fault — excluded</span>}
                      {sim.sessions.filter((x) => x.chargerId === c.id).map((x) => {
                        const v = sim.vehicles.find((y) => y.id === x.vehicleId)!;
                        return (
                          <button key={x.vehicleId} onClick={() => setSel(x.vehicleId)} aria-pressed={sel === x.vehicleId}
                            aria-label={`${x.vehicleId} on ${c.id} ${fmtT(x.start)} to ${fmtT(x.end)}${x.late ? ", misses departure" : ""}`}
                            className={cx("gantt-bar absolute inset-y-1 overflow-hidden rounded px-1.5 text-left text-[11px] font-medium hover:-translate-y-px hover:shadow-md",
                              x.late ? "bg-[#f8eedd] text-[#8a5f1f] ring-1 ring-warn" : "bg-cyan/20 text-[#0d5e69] ring-1 ring-cyan/50", sel === x.vehicleId && "ring-2 ring-ink")}
                            style={{ left: pos(x.start), width: `calc(${pos(x.end)} - ${pos(x.start)})` }}>
                            <span className="block truncate">{x.late ? "▲ " : ""}{x.vehicleId}</span>
                            <span className="absolute top-0 bottom-0 w-0.5 bg-ink/50" style={{ left: `${((v.departure - x.start) / (x.end - x.start)) * 100}%`, display: v.departure < x.end ? "block" : "none" }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-cyan/20 ring-1 ring-cyan/50" />Meets departure</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-[#f8eedd] ring-1 ring-warn" />▲ Finishes after departure (line marks departure)</span>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="mb-2 text-sm font-semibold">Charging load vs site power cap</h3>
            <TimeChart title="Charging load vs cap" summary="Scheduled charging power stays within the site cap at each step." unit="kW" height={180}
              xLabels={loadSeries.map((f) => fmtT(f.t))}
              series={[
                { key: "c", label: "Scheduled charging", color: C.cyan, kind: "area", values: loadSeries.map((f) => f.charging) },
                { key: "cap", label: "Site cap (grid limit + PV + storage support − base)", color: C.err, kind: "dashed", values: loadSeries.map((f) => f.cap - f.base) },
              ]} />
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="Why this order?">
            {s ? (
              <div key={s.vehicleId} className="fade-in space-y-4 text-sm">
                <div className="flex items-center justify-between"><span className="text-base font-semibold">{s.vehicleId}</span><Badge tone={s.late ? "warn" : "info"}>Rank #{s.rank}</Badge></div>
                <p className="leading-relaxed text-muted">{s.rationale}</p>
                <Disclosure id="sched-score" label="Show scoring breakdown"><ScoreBars s={s.score} /></Disclosure>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(s.vehicleId)}>Edit constraints</Button>
                  <ButtonLink to={`/app/explain/${s.vehicleId}`} variant="secondary" size="sm">Decision detail</ButtonLink>
                </div>
              </div>
            ) : <p className="text-sm text-muted">Select a session.</p>}
          </Panel>
          <Panel title="Placement order" sub={`${a.strategy === "fcfs" ? "By arrival time" : a.strategy === "rule" ? "Priority, then earliest departure" : "Higher score is placed first"} · view all ${sim.sessions.length}`} collapsible="sc-order" defaultOpen={false}>
            <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {sim.sessions.map((x) => (
                <li key={x.vehicleId}><button onClick={() => setSel(x.vehicleId)} className={cx("flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors", sel === x.vehicleId ? "bg-soft" : "hover:bg-soft/70")}>
                  <span className="tnum w-6 text-xs text-muted">{x.rank}</span><span className="flex-1 font-medium">{x.vehicleId}{a.overrides[x.vehicleId] && <span className="ml-1.5 text-[10px] font-normal text-[#0d7584]">edited</span>}</span><span className="tnum text-xs text-muted">{x.priority}</span>{x.late && <span className="text-xs text-warn" aria-label="at risk">▲</span>}
                </button></li>
              ))}
            </ol>
          </Panel>
          <Panel title="Conflicts" sub={`${conflicts.length} flagged`}>
            {conflicts.length ? <ul className="space-y-2 text-sm">{conflicts.map((x) => <li key={x.vehicleId} className="flex gap-2"><span className={x.late ? "text-err" : "text-warn"}>{x.late ? "▲" : "◆"}</span><span><b className="font-medium">{x.vehicleId}</b> — {x.late ? "finishes after departure" : "start delayed by site power cap"}</span></li>)}</ul> : <p className="text-sm text-muted">No conflicts in this scenario.</p>}
          </Panel>
        </div>
      </div>
      <Panel className="mt-5" title="Compare scheduling strategies" sub={`Departures met — ${cmp.map((c) => `${c.short} ${c.r.totals.onTime}/${c.r.totals.requested}`).join(" · ")}. Expand for cost, peak and lateness.`} collapsible="sc-cmp" defaultOpen={false} right={<ButtonLink to="/app/experiments" size="sm" variant="secondary">Set up an experiment</ButtonLink>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Metric</th>{cmp.map((c) => <th key={c.id} className={cx("pb-2 text-right font-medium", c.id === a.strategy && "text-ink")}>{c.short}{c.id === a.strategy && " (active)"}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {([
                ["Departures met", (t) => `${t.onTime}/${t.requested}`],
                ["Total lateness", (t) => `${t.lateMinutes} min`],
                ["Energy not delivered by departure", (t) => `${t.unservedKWh.toFixed(1)} kWh`],
                ["Peak grid import", (t) => `${t.peakGrid.toFixed(1)} kW`],
                ["Minutes above grid limit", (t) => `${t.exceedSteps * 15}`],
                ["Estimated energy cost", (t) => inr(t.cost)],
                ["Estimated emissions", (t) => `${t.emissionsKg.toFixed(0)} kg`],
              ] as [string, (t: typeof sim.totals) => string][]).map(([l, f]) => (
                <tr key={l}><td className="py-2.5 text-muted">{l}</td>{cmp.map((c) => <td key={c.id} className={cx("tnum py-2.5 text-right", c.id === a.strategy && "font-semibold")}><Tween value={f(c.r.totals)} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <Disclosure id="sched-cmp-note" label="How to read this comparison" className="mt-4">FCFS charges at full power with no site cap, so it can finish sooner but may exceed the grid limit. Rule-based and EVOS respect the cap and may delay starts. Differences come from this deterministic demo model on one demo day; they are not evidence that any strategy performs better in practice.</Disclosure>
      </Panel>
      <Drawer open={!!edit} onClose={() => setEdit(null)} title="Vehicle constraints">
        {edit && (
          <div className="space-y-5">
            <Field2 value={edit} onChange={setEdit} />
            <ConstraintEditor vehicleId={edit} onDone={() => setEdit(null)} />
          </div>
        )}
      </Drawer>
    </>
  );
}

function Field2({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { sim } = useStore();
  return (
    <div>
      <label htmlFor="ce-v" className="text-sm font-medium">Vehicle</label>
      <select id="ce-v" value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, "mt-1.5")}>
        {sim.vehicles.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.cls} · {v.readiness}</option>)}
      </select>
    </div>
  );
}

export function ScoreBars({ s }: { s: { urgency: number; deficit: number; slack: number; classWeight: number; total: number } }) {
  const rows = [["Urgency", s.urgency, 0.45, "energy needed ÷ time to departure"], ["SoC deficit", s.deficit, 0.2, "gap to required SoC"], ["Low slack", s.slack, 0.2, "little spare time"], ["Service class", s.classWeight, 0.15, "bus > van > cart"]] as const;
  const pr = (s as { priority?: number }).priority ?? 0;
  return (
    <div className="space-y-2.5">
      {rows.map(([l, v, w, d]) => (
        <div key={l}>
          <div className="flex justify-between text-xs"><span className="font-medium">{l} <span className="font-normal text-muted">× {w}</span></span><span className="tnum text-muted">{(v * w * 100).toFixed(0)} pts</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-soft"><div className="h-1.5 rounded-full bg-cyan transition-[width] duration-300" style={{ width: `${v * 100}%` }} /></div>
          <div className="mt-0.5 text-[11px] text-muted">{d}</div>
        </div>
      ))}
      {pr !== 0 && <div className="flex justify-between text-xs"><span className="font-medium">Operator priority override</span><span className="tnum text-muted">{pr > 0 ? "+" : ""}{Math.round(pr * 100)} pts</span></div>}
      <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold"><span>Priority score</span><span className="tnum">{Math.round(s.total * 100)}</span></div>
    </div>
  );
}

const RANGES = { day: [0, STEPS], am: [24, 52], pm: [48, 72], eve: [68, STEPS] } as const;
export function Energy() {
  const { sim } = useStore();
  const [t, setT] = useState(52);
  const [range, setRange] = useState<keyof typeof RANGES>("day");
  const [r0, r1] = RANGES[range];
  const fl = sim.flows.slice(r0, r1);
  const rangeKWh = (k: "pvToLoad" | "storageToLoad" | "grid") => fl.reduce((m, x) => m + x[k] * 0.25, 0);
  const rangeCost = fl.reduce((m, x) => m + x.grid * 0.25 * sim.a.tariffINR * (x.t >= 68 && x.t < 88 ? sim.a.peakMult : x.t < 24 ? 0.75 : 1), 0);
  const f = sim.flows[t];
  const tot = sim.totals;
  return (
    <>
      <PageHeader title="Energy manager" sub="Dispatch rule: PV serves demand first, surplus charges storage; storage discharges during peak tariff or to keep grid import under the limit, never below reserve." />
      <Panel title="Source flows at selected time" sub="Diagram and metrics are read from the same 15-minute dispatch step." right={
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <label htmlFor="en-t" className="text-xs text-muted">Time</label>
          <input id="en-t" type="range" min={0} max={STEPS - 1} value={t} onChange={(e) => setT(Number(e.target.value))} className="min-w-0 flex-1 accent-cyan sm:w-44 sm:flex-none" />
          <span className="tnum w-12 text-sm font-semibold">{fmtT(t)}</span>
          {t >= NOW && <Badge tone="cyan">Forecast</Badge>}
        </div>}>
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <EnergySchematic assets={sim.a} f={f} sessions={sim.sessions} faultAC4={sim.a.chargerFault} />
          <div className="grid grid-cols-2 content-start gap-x-6 gap-y-5 border-line lg:border-l lg:pl-6">
            <Metric label="PV output" value={f.pv.toFixed(1)} unit="kW" hint={`of ${sim.a.pvKWp} kWp capacity`} />
            <Metric label="Charging demand" value={f.charging.toFixed(1)} unit="kW" hint={`+ base ${f.base.toFixed(0)} kW`} />
            <Metric label="Grid import" value={f.grid.toFixed(1)} unit="kW" tone={f.exceed > 0 ? "err" : undefined} hint={f.exceed > 0 ? `▲ ${f.exceed.toFixed(1)} kW over limit` : `limit ${sim.a.gridLimitKW} kW`} />
            <Metric label="Storage" value={`${f.storageSoC.toFixed(0)}%`} hint={f.storageToLoad > 0 ? `discharging ${f.storageToLoad.toFixed(1)} kW` : f.pvToStorage > 0 ? `charging ${f.pvToStorage.toFixed(1)} kW` : `idle · reserve ${sim.a.reservePct}%`} />
            <Metric label="PV export / curtailed" value={f.pvExport.toFixed(1)} unit="kW" />
            <Metric label="Tariff" value={`₹${(sim.a.tariffINR * (t >= 68 && t < 88 ? sim.a.peakMult : t < 24 ? 0.75 : 1)).toFixed(2)}`} unit="/kWh" hint={t >= 68 && t < 88 ? "peak" : t < 24 ? "off-peak" : "standard"} />
            <div className="col-span-2"><Note>Demand = PV to load + storage + grid ({f.pvToLoad.toFixed(1)} + {f.storageToLoad.toFixed(1)} + {f.grid.toFixed(1)} = {f.load.toFixed(1)} kW).</Note></div>
          </div>
        </div>
      </Panel>
      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Panel title="Supply by source vs grid limit" sub="Which source meets demand, and is the grid limit respected? kW, 15-min steps." right={
          <Segmented label="Time range" value={range} onChange={setRange} options={[{ v: "day", label: "Full day" }, { v: "am", label: "06–13" }, { v: "pm", label: "12–18" }, { v: "eve", label: "17–24" }]} />}>
          <TimeChart title="Supply by source" summary={`Peak grid import ${tot.peakGrid.toFixed(1)} kW vs ${sim.a.gridLimitKW} kW limit.`} unit="kW" height={260}
            xLabels={fl.map((x) => fmtT(x.t))} marker={NOW > r0 && NOW < r1 ? { x: NOW - r0, label: "Now · forecast →" } : undefined} refLines={[{ y: sim.a.gridLimitKW, label: `Grid limit ${sim.a.gridLimitKW} kW`, color: C.err }]}
            series={[
              { key: "pv", label: "PV to load", color: C.teal, kind: "area", stack: true, values: fl.map((x) => x.pvToLoad) },
              { key: "st", label: "Storage", color: C.storage, kind: "area", stack: true, values: fl.map((x) => x.storageToLoad) },
              { key: "gr", label: "Grid", color: "#AEB9C7", kind: "area", stack: true, values: fl.map((x) => x.grid) },
              { key: "pvt", label: "Total PV output", color: C.warn, kind: "dashed", values: fl.map((x) => x.pv) },
            ]} />
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm sm:grid-cols-4">
            {[["PV to load", `${rangeKWh("pvToLoad").toFixed(0)} kWh`], ["Storage", `${rangeKWh("storageToLoad").toFixed(0)} kWh`], ["Grid import", `${rangeKWh("grid").toFixed(0)} kWh`], ["Est. grid cost", inr(rangeCost)]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k} (range)</dt><dd className="tnum mt-0.5 font-semibold">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Day totals" sub="Demo day, kWh">
          <div className="flex items-center gap-6">
            <Donut size={130} label="Source mix" parts={[{ label: "PV", value: tot.pvToLoad, color: C.teal }, { label: "Storage", value: tot.storageToLoad, color: C.storage }, { label: "Grid", value: tot.grid, color: C.grid }]}
              center={<><span className="tnum text-lg font-semibold">{tot.load.toFixed(0)}</span><span className="text-[10px] text-muted">kWh demand</span></>} />
            <Legend items={[{ label: "PV", color: C.teal, value: tot.pvToLoad.toFixed(0) }, { label: "Storage", color: C.storage, value: tot.storageToLoad.toFixed(0) }, { label: "Grid", color: C.grid, value: tot.grid.toFixed(0) }]} />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold">Storage state of charge</h3>
            <TimeChart title="Storage SoC" summary={`Minimum ${tot.minStorage.toFixed(0)}%, reserve ${sim.a.reservePct}%.`} unit="%" yMax={100} height={150}
              xLabels={hourLabels()} refLines={[{ y: sim.a.reservePct, label: `Reserve ${sim.a.reservePct}%`, color: C.warn }]}
              series={[{ key: "s", label: "Storage SoC", color: C.storage, kind: "line", values: sim.flows.map((x) => x.storageSoC) }]} />
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Constraint checks" sub={tot.exceedSteps === 0 && tot.minStorage >= sim.a.reservePct - 0.01 ? "✓ All 4 checks passed for the demo day" : "▲ A constraint was exceeded — expand for detail"} collapsible="en-cons" defaultOpen={false}>
          <ul className="space-y-2.5 text-sm">
            {[
              [tot.exceedSteps === 0, "Grid import within limit", tot.exceedSteps === 0 ? `Peak ${tot.peakGrid.toFixed(1)} kW ≤ ${sim.a.gridLimitKW} kW` : `▲ Exceeded for ${tot.exceedSteps * 15} min (peak ${tot.peakGrid.toFixed(1)} kW) — flagged`],
              [tot.minStorage >= sim.a.reservePct - 0.01, "Storage respects reserve", `Minimum ${tot.minStorage.toFixed(0)}% vs ${sim.a.reservePct}% reserve`],
              [true, "PV ≤ installed capacity", `Peak ${Math.max(...sim.flows.map((x) => x.pv)).toFixed(1)} kW of ${sim.a.pvKWp} kWp`],
              [true, "Energy balance", "PV + storage + grid = demand at every step"],
            ].map(([ok, l, d]) => (
              <li key={String(l)} className="flex items-start gap-3"><span aria-hidden className={ok ? "text-ok" : "text-err"}>{ok ? "✓" : "▲"}</span><span><b className="font-medium">{l}</b> <span className="sr-only">{ok ? "passed" : "failed"}</span><span className="block text-xs text-muted">{d}</span></span></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Tariff and carbon signals" sub={`₹${(sim.a.tariffINR * 0.75).toFixed(2)}–₹${(sim.a.tariffINR * sim.a.peakMult).toFixed(2)}/kWh · ${sim.a.carbonG} gCO₂e/kWh`} collapsible="en-price" defaultOpen={false}>
          <TimeChart title="Tariff" summary={`Off-peak ₹${(sim.a.tariffINR * 0.75).toFixed(2)}, standard ₹${sim.a.tariffINR}, peak ₹${(sim.a.tariffINR * sim.a.peakMult).toFixed(2)} per kWh.`} unit="₹/kWh" height={150}
            xLabels={hourLabels()} series={[{ key: "p", label: "Tariff", color: C.ink, kind: "line", values: sim.flows.map((x) => sim.a.tariffINR * (x.t >= 68 && x.t < 88 ? sim.a.peakMult : x.t < 24 ? 0.75 : 1)) }]} />
          <p className="mt-2 text-xs text-muted">Grid carbon intensity: {sim.a.carbonG} gCO₂e/kWh (constant demo value; hourly data not connected).</p>
        </Panel>
      </div>
      <div className="mt-5"><Disclosure id="en-model" label="View energy model assumptions">Rooftop PV is {sim.a.pvKWp} kWp capacity; instantaneous output follows a modelled irradiance curve × daily weather factor × solar multiplier, capped at capacity. Storage is {sim.a.storageKWh} kWh / {sim.a.storageKW} kW with 95% charge efficiency. Values are simulated. <Link to="/app/settings" className="font-medium text-[#0d7584] underline">Edit assumptions</Link>.</Disclosure></div>
    </>
  );
}
