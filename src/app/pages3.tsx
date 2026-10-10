import { useEffect, useMemo, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { PageHeader } from "./Shell";
import { useStore } from "../lib/store";
import { Link } from "../lib/router";
import { Panel, Metric, Status, Badge, Segmented, Note, cx, Button, Field, inputCls, Slider, Toggle, Empty, Tween } from "../components/ui";
import { TimeChart, C } from "../components/charts";
import EnergySchematic from "../components/EnergySchematic";
import { Architecture } from "../site/Site";
import { simulate, DEFAULTS, NOW, STEPS, fmtT, inr, CHARGERS, DAY_NAMES, DAY_SOLAR, type Assumptions, type SimResult } from "../lib/sim";

type Inputs = Pick<Assumptions, "requesting" | "reservePct" | "gridLimitKW" | "solarMult" | "tariffINR">;
const pick = (a: Assumptions): Inputs => ({ requesting: a.requesting, reservePct: a.reservePct, gridLimitKW: a.gridLimitKW, solarMult: a.solarMult, tariffINR: a.tariffINR });

export function Scenarios() {
  const { a, sim, setA, toast } = useStore();
  const [draft, setDraft] = useState<Inputs>(pick(a));
  const [run, setRun] = useState<{ r: SimResult; at: string; inputs: Inputs } | null>(null);
  const [history, setHistory] = useState<{ at: string; inputs: Inputs; onTime: number; cost: number; kg: number }[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(run ? run.inputs : pick(a));
  const doRun = () => {
    const r = simulate({ ...a, ...draft });
    const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setRun({ r, at, inputs: draft });
    setHistory((h) => [{ at, inputs: draft, onTime: r.totals.onTime, cost: r.totals.cost, kg: r.totals.emissionsKg }, ...h].slice(0, 5));
  };
  const reset = () => { setDraft(pick(a)); setRun(null); };
  const apply = () => { if (!run) return; setA({ ...a, ...run.inputs }); setRun(null); toast("Scenario applied — it is now the workspace baseline"); };
  const b = sim.totals;
  const s = run?.r.totals;
  const rows: [string, (t: SimResult["totals"]) => number, (n: number) => string, boolean][] = [
    ["Vehicles on time / requested", (t) => t.onTime, (n) => n.toFixed(0), true],
    ["At-risk sessions", (t) => t.atRisk, (n) => n.toFixed(0), false],
    ["Estimated cost (₹, day)", (t) => t.cost, inr, false],
    ["Solar-derived share (%)", (t) => t.renewableShare * 100, (n) => `${n.toFixed(0)}%`, true],
    ["Grid import (kWh)", (t) => t.grid, (n) => n.toFixed(0), false],
    ["Estimated emissions (kg CO₂e)", (t) => t.emissionsKg, (n) => n.toFixed(0), false],
    ["Peak grid import (kW)", (t) => t.peakGrid, (n) => n.toFixed(1), false],
    ["Storage wear proxy (equiv. cycles)", (t) => t.storageCycles, (n) => n.toFixed(2), false],
  ];
  const sliders: [keyof Inputs, string, number, number, number, (v: number) => string, string][] = [
    ["requesting", "Vehicles requesting charge", 0, 19, 1, (v) => `${v}`, "Of 19 available vehicles; those below target are queued first"],
    ["reservePct", "Storage reserve", 0, 60, 5, (v) => `${v}%`, "Storage will not discharge below this"],
    ["gridLimitKW", "Grid import limit", 30, 150, 5, (v) => `${v} kW`, "Scheduler respects it; exceedances are flagged"],
    ["solarMult", "Solar availability", 0, 1.5, 0.05, (v) => `× ${v.toFixed(2)}`, `Multiplies the ${DAY_NAMES[a.day]} weather factor (${DAY_SOLAR[a.day]})`],
    ["tariffINR", "Standard energy price", 4, 16, 0.5, (v) => `₹${v.toFixed(1)}`, "per kWh; peak × " + a.peakMult],
  ];
  return (
    <>
      <PageHeader title="What-if simulator" sub="Change assumptions, run a deterministic scenario and compare it against the current baseline. Identical inputs always give identical results." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Panel title="Scenario inputs" sub="Baseline = current workspace assumptions">
          <div className="space-y-5">
            {sliders.map(([k, label, min, max, step, fmt, help]) => (
              <div key={k}>
                <div className="flex items-baseline justify-between"><label htmlFor={`sc-${k}`} className="text-sm font-medium">{label}</label>{draft[k] !== pick(a)[k] && <span className="text-[11px] text-muted">baseline {fmt(pick(a)[k])}</span>}</div>
                <div className="mt-1.5"><Slider id={`sc-${k}`} value={draft[k]} min={min} max={max} step={step} fmt={fmt} onChange={(v) => setDraft({ ...draft, [k]: v })} /></div>
                <p className="mt-1 text-[11px] text-muted">{help}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button onClick={doRun} className="flex-1" disabled={!dirty && !!run}><Play size={15} />Run scenario</Button>
            <Button variant="secondary" onClick={reset} aria-label="Reset to baseline"><RotateCcw size={15} />Reset</Button>
          </div>
          {!dirty && run && <p className="mt-2 text-xs text-muted">Results are current. Change an input to run again.</p>}
        </Panel>
        <div className="space-y-5">
          <Panel title="Baseline vs scenario" sub={run ? `Scenario run at ${run.at} · illustrative simulation` : "Run a scenario to compare"} right={run && <Button size="sm" variant="dark" onClick={apply}>Apply as new baseline</Button>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Metric</th><th className="pb-2 text-right font-medium">Baseline</th><th className="pb-2 text-right font-medium">Scenario</th><th className="pb-2 text-right font-medium">Change</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map(([l, f, fmt, higherBetter]) => {
                    const bv = f(b), sv = s ? f(s) : undefined;
                    const d = sv !== undefined ? sv - bv : 0;
                    const good = higherBetter ? d > 0 : d < 0;
                    return (
                      <tr key={l}>
                        <td className="py-2.5">{l}</td>
                        <td className="tnum text-right"><Tween value={`${fmt(bv)}${l.startsWith("Vehicles") ? ` / ${b.requested}` : ""}`} /></td>
                        <td className="tnum text-right font-medium">{sv !== undefined ? <Tween value={`${fmt(sv)}${l.startsWith("Vehicles") ? ` / ${s!.requested}` : ""}`} /> : <span className="text-muted">—</span>}</td>
                        <td className={cx("tnum text-right text-xs", sv === undefined || Math.abs(d) < 0.005 ? "text-muted" : good ? "text-ok" : "text-err")}>
                          {sv === undefined ? "" : Math.abs(d) < 0.005 ? "no change" : `${d > 0 ? "▲ +" : "▼ "}${fmt(Math.abs(d) * (d < 0 ? -1 : 1)).replace("₹-", "-₹")}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Grid import: baseline vs scenario" sub="kW · demo day">
            <TimeChart title="Grid import comparison" summary={s ? `Baseline peak ${b.peakGrid.toFixed(0)} kW, scenario peak ${s.peakGrid.toFixed(0)} kW.` : "Baseline only."} unit="kW" height={220}
              xLabels={sim.flows.map((f) => fmtT(f.t))} refLines={[{ y: run ? run.inputs.gridLimitKW : a.gridLimitKW, label: `Limit ${run ? run.inputs.gridLimitKW : a.gridLimitKW} kW`, color: C.err }]}
              series={[
                { key: "b", label: "Baseline", color: "#9AA8B8", kind: "line", values: sim.flows.map((f) => f.grid) },
                ...(run ? [{ key: "s", label: "Scenario", color: C.cyan, kind: "line" as const, values: run.r.flows.map((f) => f.grid) }] : []),
              ]} />
          </Panel>
          {history.length > 0 && (
            <Panel title="Run history" sub="This session">
              <ul className="divide-y divide-line text-sm">
                {history.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="tnum text-xs text-muted">{h.at}</span>
                    <span className="tnum text-xs">{h.inputs.requesting} veh · {h.inputs.reservePct}% · {h.inputs.gridLimitKW} kW · ×{h.inputs.solarMult.toFixed(2)} · ₹{h.inputs.tariffINR}</span>
                    <span className="tnum text-xs">{h.onTime} on time · {inr(h.cost)} · {h.kg.toFixed(0)} kg</span>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(h.inputs)}>Load inputs</Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

export function SystemView() {
  const { sim } = useStore();
  const [t, setT] = useState(NOW);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => (x + 1 >= STEPS ? (setPlaying(false), x) : x + 1)), 400);
    return () => clearInterval(id);
  }, [playing]);
  const f = sim.flows[t];
  const active = sim.sessions.filter((s) => s.start <= t && s.end > t);
  const detail = useMemo(() => {
    if (!sel) return null;
    if (sel === "pv") return { title: "Rooftop PV", rows: [["Capacity", `${sim.a.pvKWp} kWp`], ["Output", `${f.pv.toFixed(1)} kW`], ["To loads", `${f.pvToLoad.toFixed(1)} kW`], ["To storage", `${f.pvToStorage.toFixed(1)} kW`], ["Export/curtailed", `${f.pvExport.toFixed(1)} kW`]] };
    if (sel === "grid") return { title: "Grid connection", rows: [["Import", `${f.grid.toFixed(1)} kW`], ["Limit", `${sim.a.gridLimitKW} kW`], ["Headroom", `${(sim.a.gridLimitKW - f.grid).toFixed(1)} kW`]] };
    if (sel === "sto") return { title: "Stationary battery", rows: [["Capacity / power", `${sim.a.storageKWh} kWh / ${sim.a.storageKW} kW`], ["State of charge", `${f.storageSoC.toFixed(1)}%`], ["Reserve", `${sim.a.reservePct}%`], ["Discharge", `${f.storageToLoad.toFixed(1)} kW`], ["Charge", `${f.pvToStorage.toFixed(1)} kW`]] };
    const c = CHARGERS.find((x) => x.id === sel)!;
    const s = active.find((x) => x.chargerId === sel);
    return { title: `Charger ${c.id}`, rows: [["Type", `${c.type} · ${c.connector}`], ["Max power", `${c.maxKW} kW`], ["Status", sim.a.chargerFault && c.id === "AC-4" ? "Fault (simulated)" : s ? "Charging" : "Available"], ["Vehicle", s ? s.vehicleId : "—"], ["Power", s ? `${s.powerKW} kW` : "0 kW"]] };
  }, [sel, f, active, sim]);
  return (
    <>
      <PageHeader title="System view" sub="Schematic of the simulated depot. Line thickness scales with power; moving traces show flow direction. Select an asset for detail." />
      <Panel title={<span className="flex items-center gap-2">Schematic <Badge tone="warn">Simulated</Badge>{t >= NOW && <Badge tone="cyan">Forecast</Badge>}</span>} right={
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => { if (t >= STEPS - 1) setT(0); setPlaying(!playing); }} aria-label={playing ? "Pause timeline" : "Play timeline"}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? "Pause" : "Play day"}</Button>
          <label htmlFor="sv-t" className="sr-only">Time of day</label>
          <input id="sv-t" type="range" min={0} max={STEPS - 1} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="w-40 accent-cyan md:w-56" />
          <span className="tnum w-12 text-sm font-semibold">{fmtT(t)}</span>
        </div>}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="rounded-xl bg-deep p-3 md:p-5"><EnergySchematic assets={sim.a} f={f} sessions={sim.sessions} faultAC4={sim.a.chargerFault} dark onSelect={setSel} selected={sel} /></div>
          <div>
            {detail ? (
              <div key={sel} className="fade-in">
                <div className="flex items-center justify-between"><h3 className="font-semibold">{detail.title}</h3><button className="text-xs text-muted hover:text-ink" onClick={() => setSel(null)}>Clear</button></div>
                <dl className="mt-3 space-y-2 text-sm">{detail.rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tnum font-medium">{v}</dd></div>)}</dl>
              </div>
            ) : <p className="text-sm text-muted">Select PV, grid, storage or a charger in the schematic.</p>}
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold">At {fmtT(t)}</h3>
              <dl className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">Active sessions</dt><dd className="tnum">{active.length}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Site demand</dt><dd className="tnum">{f.load.toFixed(1)} kW</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Grid share</dt><dd className="tnum">{f.load ? Math.round((f.grid / f.load) * 100) : 0}%</dd></div>
              </dl>
            </div>
            <ul className="mt-6 space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2"><span className="h-0.5 w-5 bg-teal" />PV</li>
              <li className="flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: C.grid }} />Grid</li>
              <li className="flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: C.storage }} />Storage</li>
              <li className="flex items-center gap-2"><span className="h-0.5 w-5 bg-cyan" />Charging</li>
            </ul>
          </div>
        </div>
      </Panel>
    </>
  );
}

export function Alerts() {
  const { alerts, acked, toggleAck } = useStore();
  const [sev, setSev] = useState("All");
  const [cat, setCat] = useState("All");
  const [state, setState] = useState<"open" | "ack" | "all">("open");
  const rows = alerts.filter((x) => (sev === "All" || x.severity === sev) && (cat === "All" || x.category === cat) && (state === "all" || (state === "ack") === acked.has(x.id)));
  return (
    <>
      <PageHeader title="Alerts and events" sub="Derived from the current simulation. Acknowledgements persist for this browser session." />
      <Panel pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Segmented label="Status" value={state} onChange={setState} options={[{ v: "open", label: "Open" }, { v: "ack", label: "Acknowledged" }, { v: "all", label: "All" }]} />
          <label htmlFor="al-sev" className="sr-only">Severity</label>
          <select id="al-sev" value={sev} onChange={(e) => setSev(e.target.value)} className={cx(inputCls, "w-auto")}>{["All", "Critical", "Warning", "Info"].map((x) => <option key={x} value={x}>{x === "All" ? "All severities" : x}</option>)}</select>
          <label htmlFor="al-cat" className="sr-only">Category</label>
          <select id="al-cat" value={cat} onChange={(e) => setCat(e.target.value)} className={cx(inputCls, "w-auto")}>{["All", "Fleet", "Charging", "Energy", "Battery"].map((x) => <option key={x} value={x}>{x === "All" ? "All categories" : x}</option>)}</select>
          <span className="tnum text-xs text-muted" aria-live="polite">{rows.length} shown</span>
        </div>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((x) => (
              <li key={x.id} className={cx("flex flex-col gap-3 p-5 transition-opacity duration-200 sm:flex-row sm:items-start", acked.has(x.id) && "opacity-60")}>
                <div className="w-24 shrink-0"><Status s={x.severity} /><div className="tnum mt-1.5 text-xs text-muted">{fmtT(x.time)}</div></div>
                <div className="flex-1">
                  <p className="font-medium">{x.title} <span className="font-normal text-muted">· {x.asset}</span></p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{x.detail}</p>
                  <Badge className="mt-2">{x.category}</Badge>
                </div>
                <Button size="sm" variant={acked.has(x.id) ? "ghost" : "secondary"} onClick={() => toggleAck(x.id)}>{acked.has(x.id) ? "Undo acknowledge" : "Acknowledge"}</Button>
              </li>
            ))}
          </ul>
        ) : <div className="p-6"><Empty title={state === "open" ? "No open alerts match" : "No alerts match"}>Adjust the filters above.</Empty></div>}
      </Panel>
    </>
  );
}

type Num = "reservePct" | "gridLimitKW" | "solarMult" | "tariffINR" | "peakMult" | "carbonG" | "requesting" | "storageStartPct" | "pvKWp" | "storageKWh" | "storageKW";
const LIMITS: Record<Num, [number, number, string, string]> = {
  requesting: [0, 19, "vehicles", "Vehicles requesting charge"],
  reservePct: [0, 80, "%", "Storage reserve"],
  storageStartPct: [0, 100, "%", "Storage SoC at 00:00"],
  gridLimitKW: [20, 300, "kW", "Grid import limit"],
  solarMult: [0, 1.5, "×", "Solar availability multiplier"],
  tariffINR: [1, 40, "₹/kWh", "Standard energy price"],
  peakMult: [1, 3, "×", "Peak tariff multiplier (17:00–22:00)"],
  carbonG: [0, 1500, "g CO₂e/kWh", "Grid carbon intensity"],
  pvKWp: [0, 500, "kWp", "Rooftop PV capacity"],
  storageKWh: [10, 500, "kWh", "Stationary battery capacity"],
  storageKW: [5, 250, "kW", "Stationary battery power"],
};
export function Settings() {
  const { a, change, resetAll } = useStore();
  const [d, setD] = useState<Record<string, string>>(() => Object.fromEntries(Object.keys(LIMITS).map((k) => [k, String(a[k as Num])])));
  const [day, setDay] = useState(a.day);
  const [fault, setFault] = useState(a.chargerFault);
  useEffect(() => { setD(Object.fromEntries(Object.keys(LIMITS).map((k) => [k, String(a[k as Num])]))); setDay(a.day); setFault(a.chargerFault); }, [a]);
  const errs: Record<string, string> = {};
  (Object.keys(LIMITS) as Num[]).forEach((k) => {
    const [lo, hi, unit] = LIMITS[k];
    const n = Number(d[k]);
    if (d[k].trim() === "" || Number.isNaN(n)) errs[k] = "Enter a number.";
    else if (n < lo || n > hi) errs[k] = `Must be between ${lo} and ${hi} ${unit}.`;
    else if (k === "requesting" && !Number.isInteger(n)) errs[k] = "Use a whole number of vehicles.";
  });
  if (!errs.storageStartPct && !errs.reservePct && Number(d.storageStartPct) < Number(d.reservePct)) errs.storageStartPct = "Start SoC should not be below the reserve.";
  const valid = Object.keys(errs).length === 0;
  const save = () => {
    if (!valid) return;
    const next = { ...a, day, chargerFault: fault } as Assumptions;
    (Object.keys(LIMITS) as Num[]).forEach((k) => ((next as unknown as Record<string, number>)[k] = Number(d[k])));
    change(next, "Configuration saved — all screens updated");
  };
  const restore = () => change({ ...DEFAULTS, overrides: a.overrides, faults: a.faults, strategy: a.strategy }, "Illustrative defaults restored");
  const exportCfg = () => {
    const blob = new Blob([JSON.stringify({ kind: "evos-simulation-config", version: 1, exportedAt: new Date().toISOString(), provenance: "illustrative", config: a }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const el = document.createElement("a"); el.href = url; el.download = "evos-config.json"; el.click(); URL.revokeObjectURL(url);
  };
  const groups: [string, Num[], boolean][] = [["Fleet & charging", ["requesting"], false], ["Core energy assumptions", ["reservePct", "gridLimitKW", "solarMult"], false], ["Tariff and emissions", ["tariffINR", "carbonG"], false], ["Advanced settings · asset sizes and start state", ["pvKWp", "storageKWh", "storageKW", "storageStartPct", "peakMult"], true]];
  return (
    <>
      <PageHeader title="Simulation configuration" sub="Illustrative assumptions for the EVOS reference campus — not verified measurements. Saving re-runs the simulation so every view updates together; each run is linked to this configuration." />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="grid gap-5 lg:grid-cols-2">
        {groups.map(([g, ks, adv]) => (
          <Panel key={g} title={g} sub={adv ? `${ks.filter((k) => !!errs[k]).length ? "▲ Contains errors — " : ""}PV ${d.pvKWp} kWp · storage ${d.storageKWh} kWh / ${d.storageKW} kW` : undefined} collapsible={adv ? "set-adv" : undefined} defaultOpen={false}>
            <div className="grid gap-4 sm:grid-cols-2">
              {ks.map((k) => (
                <Field key={k} id={`set-${k}`} label={`${LIMITS[k][3]} (${LIMITS[k][2]})`} error={errs[k]} help={`Range ${LIMITS[k][0]}–${LIMITS[k][1]} · default ${DEFAULTS[k]}`}>
                  <input id={`set-${k}`} inputMode="decimal" value={d[k]} aria-invalid={!!errs[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={inputCls} />
                </Field>
              ))}
              {g === "Fleet & charging" && (
                <div className="flex items-center justify-between gap-4 sm:col-span-2">
                  <div><label htmlFor="set-fault" className="text-sm font-medium">Simulate AC-4 charger fault</label><p className="text-xs text-muted">Removes AC-4 from scheduling</p></div>
                  <Toggle id="set-fault" checked={fault} onChange={setFault} label="Simulate AC-4 charger fault" />
                </div>
              )}
            </div>
          </Panel>
        ))}
        <Panel title="Period and units">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="set-day" label="Demo day" help={`Weather factor ${DAY_SOLAR[day]}`}>
              <select id="set-day" value={day} onChange={(e) => setDay(Number(e.target.value))} className={inputCls}>{DAY_NAMES.map((n, i) => <option key={n} value={i}>{n} · solar ×{DAY_SOLAR[i]}</option>)}</select>
            </Field>
            <Field id="set-cur" label="Currency" help="Only INR is modelled in this demo">
              <select id="set-cur" disabled className={cx(inputCls, "opacity-60")}><option>INR (₹)</option></select>
            </Field>
            <div className="text-xs text-muted sm:col-span-2">Units: power kW · energy kWh · SoC/SoH % · emissions kg CO₂e · 15-minute timesteps.</div>
          </div>
        </Panel>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <Button type="submit" disabled={!valid}>Save assumptions</Button>
          <Button type="button" variant="secondary" onClick={restore}>Restore default values</Button>
          <Button type="button" variant="ghost" onClick={exportCfg}>Export configuration (JSON)</Button>
          <Button type="button" variant="ghost" className="text-err hover:bg-[#f6e3e2] hover:text-err" onClick={resetAll}>Reset entire simulation</Button>
          {!valid && <span role="status" className="text-sm text-err">Fix {Object.keys(errs).length} field{Object.keys(errs).length > 1 ? "s" : ""} to save.</span>}
        </div>
      </form>
      <p className="mt-2 text-xs text-muted">“Reset entire simulation” also clears vehicle overrides, injected faults and strategy. Every change can be undone from the confirmation message.</p>
      <div className="mt-5"><Note title="Fixed demo assets">20 vehicles; chargers DC-1/DC-2 30 kW and AC-1–AC-4 7.4 kW. Peak 17:00–22:00, off-peak 00:00–06:00 at 0.75× standard.</Note></div>
    </>
  );
}

export function Methodology() {
  return (
    <>
      <PageHeader title="Methodology and about" sub="How the EVOS demo works, what the data is, and what it cannot tell you." />
      <div className="space-y-5">
        <Panel title="Six-layer framework"><Architecture inApp /></Panel>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Explore dataset details" sub="20 vehicles · 6 chargers · 100 kWp PV · 100 kWh storage (defaults)" collapsible="me-data" defaultOpen={false}>
            <table className="w-full text-sm"><tbody className="divide-y divide-line">
              {[["Fleet", "20 vehicles: 6 shuttle buses, 10 utility carts, 4 service vans — not a real fleet"], ["Chargers", "6: two 30 kW DC, four 7.4 kW AC; compatibility enforced"], ["Rooftop solar", "100 kWp capacity (not instantaneous output)"], ["Stationary battery", "100 kWh capacity; 50 kW power"], ["Reserve · grid limit", "20% · 80 kW (defaults, editable)"], ["Currency", "INR; illustrative tariffs"], ["Period", "One demo day in 15-minute steps; 7-day weather variation"]].map(([k, v]) => (
                <tr key={k}><th className="py-2.5 pr-4 text-left align-top font-medium">{k}</th><td className="py-2.5 text-muted">{v}</td></tr>
              ))}
            </tbody></table>
          </Panel>
          <Panel title="Algorithms" sub="Scheduler strategies, dispatch, forecasting, battery health, emissions" collapsible="me-alg" defaultOpen={false}>
            <ol className="list-decimal space-y-2.5 pl-4 text-sm text-muted">
              <li><b className="text-ink">Scheduler strategies</b> — FCFS (arrival order, full power, no site cap); rule-based (High priority first, then earliest departure); EVOS: weighted priority score (urgency 0.45, SoC deficit 0.2, low slack 0.2, service class 0.15); greedy placement on the compatible charger with earliest finish, delayed when the site power cap would be exceeded.</li>
              <li><b className="text-ink">Energy manager</b> — rule-based dispatch: PV first, surplus to storage; storage discharges at peak tariff or above the grid limit, never below reserve.</li>
              <li><b className="text-ink">Forecasting</b> — profile-based expectation with bounds that widen with lead time.</li>
              <li><b className="text-ink">Battery health</b> — linear heuristic on cycles, age and fast-charge share, with an uncertainty band.</li>
              <li><b className="text-ink">Emissions</b> — grid kWh × constant carbon intensity vs a grid-only baseline.</li>
            </ol>
          </Panel>
          <Panel title="Limitations">
            <ul className="list-disc space-y-2 pl-4 text-sm text-muted">
              <li>All values are simulated or estimated; no measured data or live connections exist.</li>
              <li>The scheduler is a transparent heuristic, not an industrial optimiser; results are not guaranteed optimal.</li>
              <li>SoH estimates are not diagnoses; coefficients are illustrative and uncalibrated.</li>
              <li>Constant grid carbon intensity ignores hourly variation; lifecycle emissions are excluded.</li>
              <li>Battery wear is shown only as a storage cycle proxy and is not part of scheduling.</li>
            </ul>
          </Panel>
          <Panel title="Provenance and future integration" sub="How real data and a backend will be connected" collapsible="me-prov" defaultOpen={false}>
            <div className="mb-3 flex flex-wrap gap-2"><Badge tone="warn">Simulated</Badge><Badge tone="info">Estimated</Badge><Badge tone="cyan">Forecast</Badge><Badge>Measured — none yet</Badge></div>
            <ol className="list-decimal space-y-2 pl-4 text-sm text-muted">
              <li>Implement the service interfaces in <code>src/services</code> (vehicles, sessions, battery, energy, forecasting, scheduler, faults, datasets, simulation) with Supabase queries; UI components already consume only those interfaces.</li>
              <li>Replace the demo-data module with adapters for fleet telematics and charger (e.g. OCPP) logs, each tagged with dataset and time range.</li>
              <li>Add metered PV, storage and grid data alongside — never silently mixed with — simulated records.</li>
              <li>Calibrate battery-health and forecasting models against observed data; publish error metrics.</li>
              <li>Introduce an optimisation solver behind the same explainability interface.</li>
            </ol>
          </Panel>
        </div>
        <p className="text-sm text-muted">EVOS — Electric Vehicles Operations and Sustainability. <Link to="/" className="font-medium text-[#0d7584] hover:underline">Return to the public website</Link>.</p>
      </div>
    </>
  );
}

