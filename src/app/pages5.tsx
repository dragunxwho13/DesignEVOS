import { useMemo, useState } from "react";
import { Download, Play } from "lucide-react";
import { PageHeader } from "./Shell";
import { useStore } from "../lib/store";
import { Link } from "../lib/router";
import { Panel, Badge, Button, Toggle, Status, cx, ProvBadge, Disclosure, Field, inputCls, Empty, InfoTip, Spinner } from "../components/ui";
import { Bars } from "../components/charts";
import { CHARGERS, FAULTS, STRATEGIES, DAY_NAMES, DAY_SOLAR, simulate, inr, fmtT, NOW, type Assumptions, type Strategy } from "../lib/sim";
import { ALGORITHM_VERSION } from "../services";
import type { SimulationRunRecord } from "../data/contracts";

export function Maintenance() {
  const { sim, a, toggleFault, change, alerts, acked, toggleAck } = useStore();
  const faults = new Set(a.faults);
  const chargerRows = CHARGERS.map((c) => {
    const fault = a.chargerFault && c.id === "AC-4";
    const comm = faults.has("dc2-comm") && c.id === "DC-2";
    const busy = sim.sessions.some((s) => s.chargerId === c.id && s.start <= NOW && s.end > NOW);
    return { c, status: fault ? "Fault" : comm ? "Derated" : busy ? "Charging" : "Available", comm: comm ? "Delayed packets" : fault ? "Unreachable" : "OK" };
  });
  const vehicleRows = sim.vehicles
    .map((v) => {
      const score = Math.round(Math.max(0, Math.min(100, (v.estSoH - 75) * 4)) - (v.dataIssue ? 10 : 0));
      const prio = v.unavailable ? "In maintenance" : score < 45 ? "High" : score < 65 ? "Medium" : "Low";
      const insp = v.dataIssue ? "Check BMS/telematics link and SoC sensor" : v.estSoH < 86 ? "Capacity test at next service" : v.sohUnc > 3 ? "Collect more charge data to narrow estimate" : "Routine";
      return { v, score, prio, insp };
    })
    .sort((x, y) => x.score - y.score);
  const open = alerts.filter((x) => !acked.has(x.id) && (x.category === "Battery" || x.category === "Charging" || x.id.startsWith("fault")));
  return (
    <>
      <PageHeader title="Maintenance & fault monitoring" sub="Health warnings, charger and communication status, data quality and controlled fault-injection experiments. No real hardware or sensors are monitored." right={<ProvBadge p="simulated" />} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Vehicle maintenance priority" sub="Lowest health score first" pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-soft/60 text-left text-xs text-muted"><tr>
                <th className="px-5 py-2.5 font-medium">Vehicle</th>
                <th className="px-3 py-2.5 font-medium"><span className="inline-flex items-center">Health score<InfoTip label="Health score">Calculated: (estimated SoH − 75) × 4, clamped 0–100, minus 10 for an active data-quality issue. A ranking aid, not a fault probability.</InfoTip></span></th>
                <th className="px-3 py-2.5 font-medium">Priority</th><th className="px-3 py-2.5 font-medium">Recommended inspection</th></tr></thead>
              <tbody className="divide-y divide-line">
                {vehicleRows.slice(0, 8).map(({ v, score, prio, insp }) => (
                  <tr key={v.id}>
                    <td className="px-5 py-2.5 font-medium"><Link to={`/app/fleet/${v.id}`} className="hover:underline">{v.id}</Link>{v.dataIssue && <span className="ml-1.5 text-xs text-warn" aria-label="data issue">◆</span>}</td>
                    <td className="tnum px-3 py-2.5">{score}</td>
                    <td className="px-3 py-2.5"><Badge tone={prio === "High" ? "err" : prio === "Medium" ? "warn" : prio === "In maintenance" ? "neutral" : "ok"}>{prio}</Badge></td>
                    <td className="px-3 py-2.5 text-muted">{insp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3"><Disclosure id="mt-prob" label="Why there is no fault probability">Fault probability requires a trained predictive-maintenance model and labelled failure history. Neither exists yet, so EVOS shows a transparent rule-based score instead of an invented probability.</Disclosure></div>
        </Panel>
        <Panel title="Fault-injection experiments" sub="Controlled, simulated faults. Each one changes the shared simulation.">
          <ul className="space-y-4">
            <li className="flex items-start justify-between gap-4">
              <div><label htmlFor="fi-ac4" className="text-sm font-medium">Charger failure · AC-4</label><p className="text-xs text-muted">Ground-fault trip; charger excluded from scheduling.</p></div>
              <Toggle id="fi-ac4" checked={a.chargerFault} onChange={(v) => change({ ...a, chargerFault: v }, v ? "Simulated fault injected: AC-4 failure" : "Simulated fault cleared: AC-4")} label="Charger failure AC-4" />
            </li>
            {FAULTS.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-4">
                <div><label htmlFor={`fi-${f.id}`} className="text-sm font-medium">{f.label} · {f.asset}</label><p className="text-xs text-muted">{f.effect}</p></div>
                <Toggle id={`fi-${f.id}`} checked={faults.has(f.id)} onChange={() => toggleFault(f.id)} label={`${f.label} ${f.asset}`} />
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-soft px-3 py-2 text-xs text-muted">Active: {a.faults.length + (a.chargerFault ? 1 : 0)} injected fault(s). Effects appear in the Scheduler, Fleet, Alerts and System view.</p>
        </Panel>
        <Panel title="Charger & communication status" pad={false}>
          <ul className="divide-y divide-line">
            {chargerRows.map((r) => (
              <li key={r.c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="font-medium">{r.c.id} <span className="font-normal text-muted">· {r.c.type} {r.c.maxKW} kW</span></span>
                <span className="flex items-center gap-2"><span className="text-xs text-muted">comm: {r.comm}</span><Badge tone={r.status === "Fault" ? "err" : r.status === "Derated" ? "warn" : r.status === "Charging" ? "info" : "ok"}>{r.status}</Badge></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Sensor data quality">
          <ul className="space-y-2.5 text-sm">
            {[
              ["Vehicle SoC feed", faults.has("crt05-frozen") || faults.has("van03-invalid") ? `${[faults.has("crt05-frozen") && "CRT-05 frozen", faults.has("van03-invalid") && "VAN-03 invalid (112%)"].filter(Boolean).join(" · ")}` : "No anomalies in simulated feed", faults.has("crt05-frozen") || faults.has("van03-invalid")],
              ["Charger telemetry", faults.has("dc2-comm") ? "DC-2 packets delayed" : "No anomalies in simulated feed", faults.has("dc2-comm")],
              ["PV / meter data", "Not connected — simulated values only", false],
            ].map(([k, v, bad]) => (
              <li key={String(k)} className="flex items-start gap-3"><span aria-hidden className={bad ? "text-warn" : "text-muted"}>{bad ? "◆" : "○"}</span><span><b className="font-medium">{k}</b><span className="block text-xs text-muted">{v}</span></span></li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel className="mt-5" title="Open maintenance & fault warnings" sub="Warnings are not confirmed failures unless marked Critical with a confirmed source" right={<Link to="/app/alerts" className="text-sm font-medium text-[#0d7584] hover:underline">All alerts</Link>}>
        {open.length ? (
          <ul className="divide-y divide-line">
            {open.map((x) => (
              <li key={x.id} className="flex flex-wrap items-start gap-3 py-3">
                <Status s={x.severity} />
                <div className="min-w-48 flex-1"><p className="text-sm font-medium">{x.asset} · {x.title}</p><p className="text-xs text-muted">{fmtT(x.time)} · source: EVOS demo model{x.id.startsWith("fault") ? " (injected)" : ""}</p></div>
                <Button size="sm" variant="secondary" onClick={() => toggleAck(x.id)}>Acknowledge</Button>
              </li>
            ))}
          </ul>
        ) : <Empty title="No open maintenance warnings">Acknowledged items are listed on the Alerts page.</Empty>}
      </Panel>
    </>
  );
}

// ---------------- Experiments ----------------
interface ExpRun extends SimulationRunRecord { name: string; config: Assumptions; strategies: Strategy[]; results?: Record<string, Record<string, number>> }
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8, "0"); };
const TARIFFS = { standard: { label: "Standard ToD (peak ×1.4)", peakMult: 1.4 }, flat: { label: "Flat (no peak)", peakMult: 1 }, highpeak: { label: "High peak (×1.8)", peakMult: 1.8 } } as const;

export function Experiments() {
  const { a } = useStore();
  const [name, setName] = useState("Strategy comparison");
  const [day, setDay] = useState(a.day);
  const [strats, setStrats] = useState<Strategy[]>(["fcfs", "rule", "evos"]);
  const [solar, setSolar] = useState(String(a.solarMult));
  const [tariff, setTariff] = useState<keyof typeof TARIFFS>("standard");
  const [carbon, setCarbon] = useState(String(a.carbonG));
  const [storage, setStorage] = useState(String(a.storageKWh));
  const [faultMode, setFaultMode] = useState<"current" | "none" | "all">("current");
  const [runs, setRuns] = useState<ExpRun[]>(() => { try { return JSON.parse(sessionStorage.getItem("evos-exp") || "[]"); } catch { return []; } });
  const [sel, setSel] = useState<string | null>(runs[0]?.id ?? null);
  const [running, setRunning] = useState(false);
  const save = (r: ExpRun[]) => { setRuns(r); sessionStorage.setItem("evos-exp", JSON.stringify(r.slice(0, 12))); };

  const errs: Record<string, string> = {};
  const ns = Number(solar), nc = Number(carbon), nst = Number(storage);
  if (Number.isNaN(ns) || ns < 0 || ns > 1.5) errs.solar = "0 – 1.5";
  if (Number.isNaN(nc) || nc < 0 || nc > 1500) errs.carbon = "0 – 1500 g/kWh";
  if (Number.isNaN(nst) || nst < 10 || nst > 500) errs.storage = "10 – 500 kWh";
  if (!strats.length) errs.strats = "Select at least one strategy";
  if (!name.trim()) errs.name = "Name the experiment";
  const valid = !Object.keys(errs).length;

  const config: Assumptions = useMemo(() => ({
    ...a, day, solarMult: ns, carbonG: nc, storageKWh: nst, peakMult: TARIFFS[tariff].peakMult,
    faults: faultMode === "none" ? [] : faultMode === "all" ? FAULTS.map((f) => f.id) : a.faults,
    chargerFault: faultMode === "none" ? false : faultMode === "all" ? true : a.chargerFault,
  }), [a, day, ns, nc, nst, tariff, faultMode]);

  const run = () => {
    if (!valid) return;
    const id = `EXP-${Date.now().toString(36).toUpperCase()}`;
    const base: ExpRun = { id, name, configId: `cfg-${hash(JSON.stringify(config))}`, strategy: strats.join("+"), status: "running", startedAt: new Date().toISOString(), algorithmVersion: ALGORITHM_VERSION, datasetVersions: { "evos-demo-model": "0.3.0", external: "none connected" }, config, strategies: strats };
    const list = [base, ...runs];
    save(list); setSel(id); setRunning(true);
    setTimeout(() => {
      try {
        const results: Record<string, Record<string, number>> = {};
        strats.forEach((st) => {
          const t = simulate({ ...config, strategy: st }).totals;
          results[st] = { onTime: t.onTime, requested: t.requested, lateMin: t.lateMinutes, costINR: Math.round(t.cost), emissionsKg: Math.round(t.emissionsKg), solarSharePct: Math.round(t.renewableShare * 100), peakKW: Math.round(t.peakGrid * 10) / 10, wearINR: Math.round(t.wearCostINR), exceedMin: t.exceedSteps * 15 };
        });
        save(list.map((r) => (r.id === id ? { ...r, status: "demo-preview", endedAt: new Date().toISOString(), results } : r)));
      } catch (e) {
        save(list.map((r) => (r.id === id ? { ...r, status: "failed", endedAt: new Date().toISOString(), error: (e as Error).message } : r)));
      }
      setRunning(false);
    }, 30);
  };

  const cur = runs.find((r) => r.id === sel);
  const download = (kind: "json" | "csv") => {
    if (!cur?.results) return;
    const body = kind === "json" ? JSON.stringify({ ...cur, note: "Demo preview from the EVOS demo model; not an experimental result." }, null, 2)
      : ["strategy," + Object.keys(Object.values(cur.results)[0]).join(","), ...Object.entries(cur.results).map(([k, v]) => `${k},${Object.values(v).join(",")}`)].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const el = document.createElement("a"); el.href = url; el.download = `${cur.id}.${kind}`; el.click(); URL.revokeObjectURL(url);
  };
  const statusTone = { configured: "neutral", running: "info", completed: "ok", failed: "err", "demo-preview": "warn" } as const;
  const statusLabel = { configured: "Configured", running: "Running", completed: "Completed", failed: "Failed", "demo-preview": "Demo preview" };

  return (
    <>
      <PageHeader title="Experiments & evaluation" sub="Reproducible experiment set-ups. Runs execute on the local demo model and are recorded as demo previews — a run is only “Completed” when executed by a backend on real data." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Panel title="Configure experiment">
          <div className="space-y-4">
            <Field id="ex-name" label="Experiment name" error={errs.name}><input id="ex-name" className={inputCls} value={name} aria-invalid={!!errs.name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field id="ex-ds" label="Dataset / scenario" help="External datasets are not connected"><select id="ex-ds" className={inputCls}><option>EVOS reference campus (demo model)</option></select></Field>
            <Field id="ex-day" label="Time range"><select id="ex-day" className={inputCls} value={day} onChange={(e) => setDay(Number(e.target.value))}>{DAY_NAMES.map((d, i) => <option key={d} value={i}>Demo day {d} · 00:00–24:00 · weather ×{DAY_SOLAR[i]}</option>)}</select></Field>
            <fieldset>
              <legend className="text-sm font-medium">Scheduler strategies</legend>
              <div className="mt-1.5 space-y-1.5">
                {STRATEGIES.map((s) => (
                  <label key={s.id} className="flex min-h-9 items-center gap-2.5 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-cyan" checked={strats.includes(s.id)} onChange={(e) => setStrats(e.target.checked ? [...strats, s.id] : strats.filter((x) => x !== s.id))} />{s.label}
                  </label>
                ))}
              </div>
              {errs.strats && <p role="alert" className="mt-1 text-xs text-err">{errs.strats}</p>}
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field id="ex-sol" label="Solar multiplier" error={errs.solar}><input id="ex-sol" inputMode="decimal" className={inputCls} value={solar} aria-invalid={!!errs.solar} onChange={(e) => setSolar(e.target.value)} /></Field>
              <Field id="ex-sto" label="Storage (kWh)" error={errs.storage}><input id="ex-sto" inputMode="decimal" className={inputCls} value={storage} aria-invalid={!!errs.storage} onChange={(e) => setStorage(e.target.value)} /></Field>
            </div>
            <Field id="ex-tar" label="Tariff profile"><select id="ex-tar" className={inputCls} value={tariff} onChange={(e) => setTariff(e.target.value as keyof typeof TARIFFS)}>{Object.entries(TARIFFS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
            <Field id="ex-co2" label="Grid-carbon profile (constant, g/kWh)" error={errs.carbon}><input id="ex-co2" inputMode="decimal" className={inputCls} value={carbon} aria-invalid={!!errs.carbon} onChange={(e) => setCarbon(e.target.value)} /></Field>
            <Field id="ex-flt" label="Fault scenario"><select id="ex-flt" className={inputCls} value={faultMode} onChange={(e) => setFaultMode(e.target.value as typeof faultMode)}><option value="current">Current workspace faults</option><option value="none">No faults</option><option value="all">All injectable faults</option></select></Field>
            <Disclosure id="ex-params" label="Fixed algorithm parameters">EVOS weights: urgency 0.45, SoC deficit 0.2, slack 0.2, class 0.15, priority ±0.25. Fleet: current workspace configuration (20 vehicles, {Object.keys(a.overrides).length} override(s)). Config fingerprint: <code>cfg-{hash(JSON.stringify(config))}</code>.</Disclosure>
            <div className="flex flex-wrap gap-2">
              <Button onClick={run} disabled={!valid || running}><Play size={15} />Run demo preview</Button>
              <Button variant="ghost" disabled title="Requires a configured backend and connected datasets">Queue on backend</Button>
            </div>
          </div>
        </Panel>
        <div className="space-y-5 min-w-0">
          <Panel title="Run history" sub="This browser session" pad={false}>
            {runs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-soft/60 text-left text-xs text-muted"><tr><th className="px-5 py-2.5 font-medium">ID</th><th className="px-3 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Strategies</th><th className="px-3 py-2.5 font-medium">Started</th><th className="px-3 py-2.5 font-medium">Status</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {runs.map((r) => (
                      <tr key={r.id} onClick={() => setSel(r.id)} className={cx("cursor-pointer hover:bg-soft", sel === r.id && "bg-soft")}>
                        <td className="px-5 py-2.5"><button className="font-mono text-xs font-medium" onClick={() => setSel(r.id)} aria-pressed={sel === r.id}>{r.id}</button></td>
                        <td className="px-3 py-2.5">{r.name}</td><td className="px-3 py-2.5 text-xs">{r.strategies.map((s) => STRATEGIES.find((x) => x.id === s)!.short).join(", ")}</td>
                        <td className="tnum px-3 py-2.5 text-xs text-muted">{r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : "—"}</td>
                        <td className="px-3 py-2.5"><Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><Empty title="No experiments yet">Configure an experiment and run a demo preview.</Empty></div>}
          </Panel>
          {cur && (
            <Panel title={`${cur.id} · ${cur.name}`} sub={`Config ${cur.configId} · ${cur.algorithmVersion} · datasets: ${Object.entries(cur.datasetVersions).map(([k, v]) => `${k} ${v}`).join(", ")}`}
              right={cur.results && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => download("csv")}><Download size={14} />CSV</Button><Button size="sm" variant="secondary" onClick={() => download("json")}><Download size={14} />JSON</Button></div>}>
              {cur.status === "running" && <Spinner label="Running on local demo model…" />}
              {cur.status === "failed" && <p role="alert" className="text-sm text-err">Run failed: {cur.error}</p>}
              {cur.results && (
                <div key={cur.id} className="fade-in space-y-5">
                  <div className="flex flex-wrap gap-2"><ProvBadge p="demo" /><span className="text-xs text-muted">Started {new Date(cur.startedAt!).toLocaleString()} · ended {new Date(cur.endedAt!).toLocaleString()}</span></div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Metric</th>{Object.keys(cur.results).map((k) => <th key={k} className="pb-2 text-right font-medium">{STRATEGIES.find((x) => x.id === k)!.short}</th>)}</tr></thead>
                      <tbody className="divide-y divide-line">
                        {([["Departure-SoC success", (v) => `${v.onTime}/${v.requested}`], ["Total delay", (v) => `${v.lateMin} min`], ["Energy cost", (v) => inr(v.costINR)], ["Estimated emissions", (v) => `${v.emissionsKg} kg`], ["Solar share", (v) => `${v.solarSharePct}%`], ["Peak grid demand", (v) => `${v.peakKW} kW`], ["Minutes above grid limit", (v) => `${v.exceedMin}`], ["Battery-wear cost (proxy)", (v) => inr(v.wearINR)]] as [string, (v: Record<string, number>) => string][]).map(([l, f]) => (
                          <tr key={l}><td className="py-2 text-muted">{l}</td>{Object.entries(cur.results!).map(([k, v]) => <td key={k} className="tnum py-2 text-right">{f(v)}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Estimated energy cost by strategy (₹)</h3>
                    <Bars title="Cost by strategy" summary={`Charging cost per strategy: ${Object.entries(cur.results).map(([k, v]) => `${k} ₹${v.costINR}`).join(", ")}. Lower is better.`} unit="₹" height={180}
                      data={Object.entries(cur.results).map(([k, v]) => ({ label: STRATEGIES.find((x) => x.id === k)!.short, a: v.costINR }))} />
                  </div>
                  <Disclosure id="ex-cfg" label="Explore input configuration">
                    <pre className="max-h-56 overflow-auto rounded bg-soft p-3 text-[11px] text-ink">{JSON.stringify(cur.config, null, 2)}</pre>
                  </Disclosure>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
