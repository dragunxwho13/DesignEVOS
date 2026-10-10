import { useState } from "react";
import { PageHeader } from "./Shell";
import { useStore } from "../lib/store";
import { Link, navigate } from "../lib/router";
import { Panel, Metric, Status, Badge, Segmented, Note, cx, Button, ButtonLink, Empty } from "../components/ui";
import { TimeChart, Donut, Legend, Bars, C } from "../components/charts";
import { ScoreBars } from "./pages1";
import { NOW, STEPS, fmtT, inr, sohTrend, forecastSeries, simulateWeek, DAY_NAMES, tariffAt } from "../lib/sim";

export function Battery() {
  const { sim } = useStore();
  const sorted = sim.vehicles.slice().sort((a, b) => a.estSoH - b.estSoH);
  const [id, setId] = useState(sorted[0].id);
  const v = sim.vehicles.find((x) => x.id === id)!;
  const trend = sohTrend(v);
  const flagged = sim.vehicles.filter((x) => x.sohFlag);
  const avg = sim.vehicles.reduce((a, x) => a + x.estSoH, 0) / sim.vehicles.length;
  return (
    <>
      <PageHeader title="Battery health" sub="Estimated state of health (SoH) — remaining capacity relative to new. Estimates come from a simple heuristic and carry uncertainty; they are not a diagnosis." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <Panel title="Fleet estimates" sub="Sorted lowest first · select a vehicle" pad={false}>
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
            {sorted.map((x) => (
              <li key={x.id}>
                <button onClick={() => setId(x.id)} aria-pressed={id === x.id} className={cx("flex w-full items-center gap-4 px-5 py-3 text-left transition-colors duration-150", id === x.id ? "bg-soft" : "hover:bg-soft/60")}>
                  <span className="w-16 text-sm font-medium">{x.id}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-line">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${((x.estSoH - 70) / 30) * 100}%`, background: x.estSoH < 86 ? C.warn : C.teal }} />
                  </span>
                  <span className="tnum w-24 text-right text-sm">{x.estSoH}% <span className="text-xs text-muted">±{x.sohUnc}</span></span>
                  <span className="w-4 text-center text-warn" aria-label={x.sohFlag ? "flagged" : undefined}>{x.sohFlag ? "◆" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Bar scale 70–100%. ◆ maintenance or uncertainty flag.</p>
        </Panel>
        <div className="space-y-5">
          <Panel title={`${v.id} · estimated SoH`} sub={v.cls} right={<Link to={`/app/fleet/${v.id}`} className="text-sm font-medium text-[#0d7584] hover:underline">Vehicle detail</Link>}>
            <div key={v.id} className="fade-in">
              <div className="mb-5 grid grid-cols-2 gap-6 sm:grid-cols-4">
                <Metric label="Estimated SoH" value={`${v.estSoH}%`} hint={`± ${v.sohUnc} pts (est. range)`} tone={v.estSoH < 86 ? "warn" : undefined} />
                <Metric label="Equivalent cycles" value={v.cycles} />
                <Metric label="Age" value={v.ageMonths} unit="months" />
                <Metric label="Fast-charge share" value={`${Math.round(v.fastShare * 100)}%`} hint="of energy via DC" />
              </div>
              <TimeChart title="SoH trend" summary={`Estimated SoH fell to ${v.estSoH}% over 12 months.`} unit="%" height={220}
                xLabels={trend.map((p) => `M-${11 - p.m}`)} band={{ lo: trend.map((p) => p.lo), hi: trend.map((p) => p.hi), color: C.teal, label: "Uncertainty band" }}
                refLines={[{ y: 86, label: "Review threshold 86%", color: C.warn }]} yMax={100}
                series={[{ key: "s", label: "Estimated SoH (monthly)", color: C.teal, kind: "line", values: trend.map((p) => p.value) }]} />
              {v.sohFlag ? <p className="mt-3 rounded-lg bg-[#f8eedd] px-4 py-3 text-sm text-[#8a5f1f]">◆ {v.sohFlag}.</p> : <p className="mt-3 text-sm text-muted">No maintenance flag for this vehicle.</p>}
            </div>
          </Panel>
          <div className="grid gap-5 sm:grid-cols-2">
            <Panel title="Fleet summary">
              <div className="grid grid-cols-2 gap-5"><Metric label="Average est. SoH" value={`${avg.toFixed(1)}%`} /><Metric label="Flagged" value={flagged.length} hint="of 20 vehicles" tone={flagged.length ? "warn" : undefined} /></div>
            </Panel>
            <Panel title="Ageing indicators">
              <ul className="space-y-1.5 text-sm text-muted"><li>Equivalent full cycles</li><li>Calendar age</li><li>Share of DC fast charging</li><li>Data volume → uncertainty width</li></ul>
            </Panel>
          </div>
          <Note title="Method and limitations">SoH estimate = 100 − (0.0068 × cycles + 0.085 × months + 2.2 × fast-charge share). Uncertainty widens for high-cycle packs and carts with sparse telemetry. Illustrative coefficients; a real deployment would calibrate against capacity tests. Provenance: estimated from simulated records.</Note>
        </div>
      </div>
    </>
  );
}

export function Forecasts() {
  const { sim } = useStore();
  const [hz, setHz] = useState<number>(24);
  const [kind, setKind] = useState<"demand" | "pv">("demand");
  const pts = forecastSeries(sim, kind);
  const from = Math.max(0, NOW - 16);
  const to = Math.min(STEPS, NOW + hz);
  const view = pts.slice(from, to);
  const ahead = pts.slice(NOW, to);
  const energy = ahead.reduce((a, p) => a + (p.forecast ?? 0) * 0.25, 0);
  const peak = ahead.reduce((m, p) => ((p.forecast ?? 0) > m.v ? { v: p.forecast ?? 0, t: p.t } : m), { v: 0, t: NOW });
  const label = kind === "demand" ? "Site demand" : "PV output";
  return (
    <>
      <PageHeader title="Forecasting" sub="History (simulated observations) and forecast for the selected period. Forecasts are expectations with uncertainty bounds — not guarantees." />
      <Panel title={`${label} · forecast for selected period`} sub="Source: EVOS demo forecaster (daily profile + scheduled sessions + weather factor)" right={
        <div className="flex flex-wrap gap-2">
          <Segmented label="Series" value={kind} onChange={setKind} options={[{ v: "demand", label: "Demand" }, { v: "pv", label: "Solar" }]} />
          <Segmented label="Horizon" value={hz} onChange={setHz} options={[{ v: 24, label: "6 h" }, { v: 48, label: "12 h" }, { v: STEPS - NOW, label: "Rest of day" }]} />
        </div>}>
        <TimeChart title={`${label} forecast`} summary={`Forecast ${energy.toFixed(0)} kWh over the next ${(to - NOW) / 4} hours, peak ${peak.v.toFixed(0)} kW at ${fmtT(peak.t)}.`}
          unit="kW" height={300} xLabels={view.map((p) => fmtT(p.t))} marker={{ x: NOW - from, label: "Now" }}
          band={{ lo: view.map((p) => p.lo), hi: view.map((p) => p.hi), color: C.cyan, label: "Forecast bounds (≈80%)" }}
          series={[
            { key: "o", label: "Observed (simulated history)", color: C.ink, kind: "line", values: view.map((p) => p.observed) },
            { key: "f", label: "Forecast", color: C.cyan, kind: "dashed", values: view.map((p) => p.forecast) },
          ]} />
        <div className="mt-5 grid grid-cols-2 gap-6 border-t border-line pt-5 sm:grid-cols-4">
          <Metric label="Forecast energy" value={energy.toFixed(0)} unit="kWh" hint={`${fmtT(NOW)}–${fmtT(to)}`} />
          <Metric label="Forecast peak" value={peak.v.toFixed(0)} unit="kW" hint={`at ${fmtT(peak.t)}`} />
          <Metric label="Bound width at horizon" value={`± ${(((ahead.at(-1)?.hi ?? 0) - (ahead.at(-1)?.lo ?? 0)) / 2).toFixed(1)}`} unit="kW" hint="widens with lead time" />
          <Metric label="Units" value="kW" hint="power, 15-min average" />
        </div>
      </Panel>
      <div className="mt-5"><Note>History is drawn solid and forecast dashed with a shaded range. In this demo the “observed” series is itself simulated with deterministic variation; no real meter data is connected.</Note></div>
    </>
  );
}

export function Sustainability() {
  const { sim, a } = useStore();
  const [period, setPeriod] = useState<"day" | "week">("day");
  const week = simulateWeek(a);
  const t = period === "day" ? sim.totals : week.reduce((acc, d) => ({
    pvToLoad: acc.pvToLoad + d.r.totals.pvToLoad, storageToLoad: acc.storageToLoad + d.r.totals.storageToLoad, grid: acc.grid + d.r.totals.grid,
    emissionsKg: acc.emissionsKg + d.r.totals.emissionsKg, baselineKg: acc.baselineKg + d.r.totals.baselineKg, load: acc.load + d.r.totals.load, cost: acc.cost + d.r.totals.cost, baselineCost: acc.baselineCost + d.r.totals.baselineCost,
  }), { pvToLoad: 0, storageToLoad: 0, grid: 0, emissionsKg: 0, baselineKg: 0, load: 0, cost: 0, baselineCost: 0 });
  const share = (t.pvToLoad + t.storageToLoad) / t.load;
  const diff = t.baselineKg - t.emissionsKg;
  return (
    <>
      <PageHeader title="Sustainability" sub="Energy mix and estimated emissions compared with a stated baseline. Results depend on the assumptions below." right={<Segmented label="Period" value={period} onChange={setPeriod} options={[{ v: "day", label: `Demo day (${DAY_NAMES[a.day]})` }, { v: "week", label: "Demo week" }]} />} />
      <Panel className="mb-5">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric large label="Estimated emissions" value={t.emissionsKg.toFixed(0)} unit="kg CO₂e" hint={period === "day" ? "demo day" : "7 demo days"} />
          <Metric large label="Grid-only baseline" value={t.baselineKg.toFixed(0)} unit="kg CO₂e" hint="same demand, all from grid" />
          <Metric large label="Difference vs baseline" value={diff.toFixed(0)} unit="kg CO₂e" hint={`${((diff / t.baselineKg) * 100).toFixed(0)}% lower in this scenario (estimate)`} tone="ok" />
          <Metric large label="Solar-derived share" value={`${Math.round(share * 100)}%`} hint="PV direct + PV-charged storage" />
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Estimated emissions by day" sub="kg CO₂e · grey = grid-only baseline, teal = EVOS scenario. Highlighted = selected demo day.">
          <Bars title="Emissions by day" summary="Scenario emissions are lower than baseline on sunnier days." unit="kg" height={240} highlight={a.day}
            data={week.map((d) => ({ label: DAY_NAMES[d.day], a: d.r.totals.emissionsKg, b: d.r.totals.baselineKg }))} />
        </Panel>
        <Panel title="Energy mix" sub={`${t.load.toFixed(0)} kWh total demand`}>
          <div className="flex flex-wrap items-center gap-6">
            <Donut label="Energy mix" parts={[{ label: "PV", value: t.pvToLoad, color: C.teal }, { label: "Storage", value: t.storageToLoad, color: C.storage }, { label: "Grid", value: t.grid, color: C.grid }]}
              center={<><span className="tnum text-2xl font-semibold">{Math.round(share * 100)}%</span><span className="text-[10px] text-muted">solar-derived</span></>} />
            <Legend items={[{ label: "PV direct", color: C.teal, value: `${t.pvToLoad.toFixed(0)} kWh` }, { label: "Storage", color: C.storage, value: `${t.storageToLoad.toFixed(0)} kWh` }, { label: "Grid import", color: C.grid, value: `${t.grid.toFixed(0)} kWh` }]} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Metric label="Estimated cost" value={inr(t.cost)} />
            <Metric label="Grid-only cost" value={inr(t.baselineCost)} />
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Assumptions">
          <dl className="space-y-2 text-sm">
            {[["Grid carbon intensity", `${a.carbonG} g CO₂e/kWh (illustrative, constant)`], ["PV & storage emissions", "0 at point of use (lifecycle excluded)"], ["Baseline", "All site demand met by grid import"], ["Weather factors", "Fixed per demo day"], ["Currency", "INR, illustrative tariff"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
          <Link to="/app/settings" className="mt-4 inline-block text-sm font-medium text-[#0d7584] hover:underline">Edit assumptions</Link>
        </Panel>
        <Note>Estimated emissions = grid import (kWh) × carbon intensity (g/kWh) ÷ 1000. Baseline = total demand (kWh) × the same intensity. The difference reflects PV and storage use in this simulated scenario only; it is not a measured saving.</Note>
      </div>
    </>
  );
}

export function Explain({ id }: { id?: string }) {
  const { sim, toast } = useStore();
  const [reviewed, setReviewed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(sessionStorage.getItem("evos-rev") || "{}"); } catch { return {}; } });
  const sid = id && sim.sessions.find((s) => s.vehicleId === id) ? id : sim.sessions[0]?.vehicleId;
  const s = sim.sessions.find((x) => x.vehicleId === sid);
  if (!s) return (<><PageHeader title="Explainability" sub="No charging decisions in this scenario." /><Empty title="No decisions to explain">Increase vehicles requesting charge in <Link to="/app/settings" className="underline">Settings</Link>.</Empty></>);
  const v = sim.vehicles.find((x) => x.id === s.vehicleId)!;
  const slackH = ((v.departure - s.end) / 4);
  const confidence = s.late ? "Low" : slackH < 1 ? "Moderate" : "High";
  const mark = () => {
    const n = { ...reviewed, [s.vehicleId]: !reviewed[s.vehicleId] };
    setReviewed(n); sessionStorage.setItem("evos-rev", JSON.stringify(n));
    toast(n[s.vehicleId] ? `Decision for ${s.vehicleId} marked as reviewed` : `Review mark removed for ${s.vehicleId}`);
  };
  return (
    <>
      <PageHeader title="Explainability" sub="Why a recommendation was made: inputs, constraints, score, alternatives and limitations." right={
        <div><label htmlFor="ex-sel" className="sr-only">Decision</label>
          <select id="ex-sel" value={s.vehicleId} onChange={(e) => navigate(`/app/explain/${e.target.value}`)} className="h-10 rounded-lg border border-line bg-white px-3 text-sm">
            {sim.sessions.map((x) => <option key={x.vehicleId} value={x.vehicleId}>#{x.rank} · {x.vehicleId} → {x.chargerId}</option>)}
          </select></div>} />
      <div key={s.vehicleId} className="fade-in grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl bg-deep p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium tracking-wider text-cyan uppercase">Selected action</span><span className="text-xs text-white/60">Confidence: <b className="text-white">{confidence}</b></span></div>
            <p className="mt-3 text-xl font-semibold leading-snug">Assign {s.vehicleId} to {s.chargerId}, {fmtT(s.start)}–{fmtT(s.end)} at {s.powerKW} kW ({s.energyKWh} kWh)</p>
            <p className="mt-3 leading-relaxed text-white/70">{s.rationale}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant={reviewed[s.vehicleId] ? "onDark" : "primary"} size="sm" onClick={mark}>{reviewed[s.vehicleId] ? "✓ Reviewed — undo" : "Mark as reviewed"}</Button>
              <ButtonLink to="/app/scenarios" variant="onDark" size="sm">Test alternatives in a scenario</ButtonLink>
            </div>
          </section>
          <Panel title="Important inputs">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[["Current SoC", `${v.soc}%`], ["Required SoC", `${v.requiredSoC}%`], ["Departure", fmtT(v.departure)], ["Battery", `${v.capKWh} kWh`], ["Max accept", `${v.maxKW} kW`], ["Est. SoH", `${v.estSoH}% ± ${v.sohUnc}`], ["Tariff at start", `₹${tariffAt(s.start, sim.a).toFixed(2)}/kWh`], ["Grid limit", `${sim.a.gridLimitKW} kW`], ["Slack after finish", `${slackH.toFixed(2)} h`]].map(([k, val]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="tnum mt-0.5 font-medium">{val}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel title="Hard constraints applied"><ul className="space-y-2 text-sm">{s.constraints.map((c) => <li key={c} className="flex gap-2"><span className="text-ok">✓</span>{c}</li>)}</ul></Panel>
          <Panel title="Alternatives considered">
            {s.alternatives.length ? (
              <table className="w-full text-sm"><thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Charger</th><th className="pb-2 font-medium">Window</th><th className="pb-2 font-medium">Why not selected</th></tr></thead>
                <tbody className="divide-y divide-line">{s.alternatives.map((alt) => <tr key={alt.chargerId}><td className="py-2 font-medium">{alt.chargerId}</td><td className="tnum">{fmtT(alt.start)}–{fmtT(alt.end)}</td><td className="text-muted">{alt.note}</td></tr>)}</tbody></table>
            ) : <p className="text-sm text-muted">No other compatible charger was available.</p>}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Prioritisation factors" sub={`Rank #${s.rank} of ${sim.sessions.length}`}><ScoreBars s={s.score} /></Panel>
          <Panel title="Data status"><div className="flex flex-wrap gap-2"><Badge tone="warn">SoC: simulated</Badge><Badge tone="info">SoH: estimated</Badge><Badge tone="cyan">PV: forecast</Badge><Badge>Tariff: illustrative</Badge></div></Panel>
          <Note title="Limitations">Greedy heuristic: vehicles are placed one at a time in priority order and earlier placements are not revisited, so the result is reasonable but not guaranteed optimal. Battery wear is not part of the score in this version.</Note>
          <Panel title="Decision log" pad={false}>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {sim.sessions.map((x) => (
                <li key={x.vehicleId}><Link to={`/app/explain/${x.vehicleId}`} className={cx("flex items-center justify-between px-5 py-2.5 text-sm hover:bg-soft", x.vehicleId === s.vehicleId && "bg-soft")}>
                  <span><span className="tnum text-xs text-muted">{fmtT(NOW)} · </span>{x.vehicleId} → {x.chargerId}</span>
                  <span className="flex items-center gap-2">{reviewed[x.vehicleId] && <span className="text-xs text-ok">✓</span>}{x.late ? <Status s="At risk" /> : <span className="tnum text-xs text-muted">{x.priority}</span>}</span>
                </Link></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
