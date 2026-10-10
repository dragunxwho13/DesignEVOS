import { useState } from "react";
import { PageHeader } from "./Shell";
import { useStore } from "../lib/store";
import { Link, navigate } from "../lib/router";
import { Panel, Metric, Status, Badge, Segmented, Note, cx, Button, ButtonLink, Empty, Disclosure, InfoTip, ProvBadge, Tween } from "../components/ui";
import { ALGORITHM_VERSION, FORECAST_MODEL_VERSION } from "../services";
import { TimeChart, Donut, Legend, Bars, C } from "../components/charts";
import { ScoreBars } from "./pages1";
import { NOW, STEPS, fmtT, inr, sohTrend, forecastSeries, simulateWeek, DAY_NAMES, tariffAt, compareStrategies, STRATEGIES, CHARGE_EFF } from "../lib/sim";

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
      <PageHeader title="Battery health" sub="Estimated state of health (SoH) — remaining capacity relative to new. Estimates carry uncertainty and are not a diagnosis." right={<div className="flex gap-2"><ProvBadge p="simulated" /><ProvBadge p="calculated" /></div>} />
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
              <dl className="mb-5 grid grid-cols-2 gap-4 rounded-lg bg-soft px-4 py-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-muted">Current SoC</dt><dd className="tnum font-medium">{v.soc}% <span className="text-[11px] text-muted">simulated</span></dd></div>
                <div><dt className="text-xs text-muted">Usable capacity (est.)</dt><dd className="tnum font-medium">{(v.capKWh * v.estSoH / 100).toFixed(1)} kWh</dd></div>
                <div><dt className="flex items-center text-xs text-muted">Remaining useful life<InfoTip label="Remaining useful life">Not shown: no validated RUL method exists yet. It will be enabled after calibration against NASA aging data and fleet telemetry.</InfoTip></dt><dd className="font-medium text-muted">Not implemented</dd></div>
                <div><dt className="text-xs text-muted">Voltage · current · temp.</dt><dd className="font-medium text-muted">No telemetry</dd></div>
              </dl>
              <TimeChart title="SoH trend" summary={`Over 12 months the battery went down to about ${v.estSoH}% of its original capacity.`} unit="%" height={220}
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
            <Panel title="Ageing indicators used" sub="4 inputs · expand for list" collapsible="bh-ind" defaultOpen={false}>
              <ul className="space-y-1.5 text-sm text-muted"><li>Equivalent full cycles</li><li>Calendar age</li><li>Share of DC fast charging</li><li>Data volume → uncertainty width</li></ul>
            </Panel>
          </div>
          <Disclosure id="bh-method" label="View calculation methodology">SoH estimate = 100 − (0.0068 × cycles + 0.085 × months + 2.2 × fast-charge share). Uncertainty widens for high-cycle packs and carts with sparse telemetry. Coefficients are illustrative and uncalibrated. Inputs (cycles, age, DC share) are simulated records.</Disclosure>
          <Disclosure id="bh-calib" label="Calibration status: NASA Li-ion aging data">
            <p><b className="text-ink">Not connected.</b> The NASA PCoE dataset measures individual 18650 cells in a laboratory; it cannot be applied directly to a commercial EV pack. Planned use: fit a cell-level capacity-fade curve, then scale through a pack model (cells in series/parallel, thermal and usage differences) and report the resulting estimates as <i>calibrated simulation</i>, not measurements.</p>
            <p className="mt-2">Import cell data on the <a href="#/app/datasets" className="font-medium text-[#0d7584] underline">Datasets</a> page to preview column mapping.</p>
          </Disclosure>
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
      <PageHeader title="Forecasting" sub="History and forecast for the selected period. This is a demo preview from a profile baseline, not a trained model." right={<div className="flex gap-2"><ProvBadge p="demo" /><ProvBadge p="forecast" /></div>} />
      <Panel title={`${label} · forecast for selected period`} sub="Source: EVOS demo forecaster (daily profile + scheduled sessions + weather factor)" right={
        <div className="flex flex-wrap gap-2">
          <Segmented label="Series" value={kind} onChange={setKind} options={[{ v: "demand", label: "Demand" }, { v: "pv", label: "Solar" }]} />
          <Segmented label="Horizon" value={hz} onChange={setHz} options={[{ v: 24, label: "6 h" }, { v: 48, label: "12 h" }, { v: STEPS - NOW, label: "Rest of day" }]} />
        </div>}>
        <TimeChart title={`${label} forecast`} summary={`Expect about ${energy.toFixed(0)} kWh over the next ${(to - NOW) / 4} hours, busiest at ${fmtT(peak.t)} (${peak.v.toFixed(0)} kW).`}
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
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Disclosure id="fc-model" label="Understand this prediction">
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-4"><dt>Model / version</dt><dd className="text-ink">{FORECAST_MODEL_VERSION}</dd></div>
            <div className="flex justify-between gap-4"><dt>Prediction issued</dt><dd className="tnum text-ink">Demo day {fmtT(NOW)}</dd></div>
            <div className="flex justify-between gap-4"><dt>Inputs</dt><dd className="text-right text-ink">Scheduled sessions, base-load profile, PV curve × weather factor</dd></div>
            <div className="flex justify-between gap-4"><dt>Bounds</dt><dd className="text-right text-ink">Heuristic: ±(5% + 1.8%/h lead time); not a statistical interval</dd></div>
          </dl>
        </Disclosure>
        <Disclosure id="fc-err" label="Forecast error metrics">
          <p><b className="text-ink">Awaiting validation.</b> MAE / RMSE / interval coverage will be shown once forecasts are compared against held-out observed data (e.g. ACN-Data sessions, NASA POWER irradiance). The “observed” history here is itself simulated, so computing error against it would be meaningless.</p>
        </Disclosure>
      </div>
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
  const cmp = compareStrategies(a);
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
          <Bars title="Emissions by day" summary="Shorter teal bars mean less CO₂ — EVOS saves the most on sunny days." unit="kg" height={240} highlight={a.day}
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
      <Panel className="mt-5" title="See additional metrics by scheduling strategy" sub="10 metrics for FCFS, rule-based and EVOS · simulated preview, awaiting experiments" collapsible="sus-cmp" defaultOpen={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Metric</th><th className="pb-2 font-medium">Basis</th>{cmp.map((c) => <th key={c.id} className={cx("pb-2 text-right font-medium", c.id === a.strategy && "text-ink")}>{c.short}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {([
                ["Total energy consumed", "kWh, demand", (x) => `${x.load.toFixed(0)}`],
                ["Solar-derived share", "% of demand", (x) => `${Math.round(x.renewableShare * 100)}%`],
                ["Grid share", "% of demand", (x) => `${Math.round((x.grid / x.load) * 100)}%`],
                ["Estimated emissions", "kg CO₂e", (x) => x.emissionsKg.toFixed(0)],
                ["Energy cost", "₹, grid import", (x) => inr(x.cost)],
                ["Peak grid demand", "kW", (x) => x.peakGrid.toFixed(1)],
                ["Battery-wear cost", "₹, proxy", (x) => inr(x.wearCostINR)],
                ["Charging completion", "% sessions on time", (x) => `${Math.round(x.completionRate * 100)}%`],
                ["Departure-SoC success", "vehicles", (x) => `${x.onTime}/${x.requested}`],
                ["Unserved by departure", "kWh", (x) => x.unservedKWh.toFixed(1)],
              ] as [string, string, (x: typeof sim.totals) => string][]).map(([l, b, f]) => (
                <tr key={l}><td className="py-2.5">{l}</td><td className="py-2.5 text-xs text-muted">{b}</td>{cmp.map((c) => <td key={c.id} className={cx("tnum py-2.5 text-right", c.id === a.strategy && "font-semibold")}><Tween value={f(c.r.totals)} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <Disclosure id="sus-wear" label="How battery-wear cost is estimated" className="mt-4">Proxy = stationary-battery throughput × ₹2.5/kWh + DC-charged energy × ₹0.6/kWh. Illustrative, uncalibrated coefficients; shown only to make the trade-off visible.</Disclosure>
      </Panel>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel title="Assumptions" sub={`${a.carbonG} gCO₂e/kWh · grid-only baseline · INR`} collapsible="sus-ass" defaultOpen={false}>
          <dl className="space-y-2 text-sm">
            {[["Grid carbon intensity", `${a.carbonG} g CO₂e/kWh (illustrative, constant)`], ["PV & storage emissions", "0 at point of use (lifecycle excluded)"], ["Baseline", "All site demand met by grid import"], ["Weather factors", "Fixed per demo day"], ["Currency", "INR, illustrative tariff"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
          <Link to="/app/settings" className="mt-4 inline-block text-sm font-medium text-[#0d7584] hover:underline">Edit assumptions</Link>
        </Panel>
        <div className="space-y-3">
          <Disclosure id="sus-calc" label="View sustainability calculation methodology">Estimated emissions = grid import (kWh) × carbon intensity (g/kWh) ÷ 1000. Baseline = total demand (kWh) × the same intensity. The difference reflects PV and storage use in this simulated scenario only; it is not a measured saving.</Disclosure>
          <Disclosure id="sus-ren" label="How renewable use affects the result">Every kWh served by PV directly or by PV-charged storage displaces a kWh of grid import, reducing estimated emissions by the carbon intensity. Shifting charging into sunny hours raises the solar share; overcast demo days (e.g. Wed, solar ×0.55) lower it.</Disclosure>
          <Disclosure id="sus-src" label="Explore data sources">Grid carbon intensity: constant demo value — Grid Carbon-Intensity dataset not connected. Tariff: illustrative. PV: simulated from configured capacity. See <a href="#/app/datasets" className="font-medium text-[#0d7584] underline">Datasets & Sources</a>.</Disclosure>
        </div>
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
  const marginLabel = s.late ? "Misses departure" : slackH < 1 ? "Tight (< 1 h)" : "Comfortable";
  const costImpact = Array.from({ length: s.end - s.start }, (_, k) => s.powerKW * 0.25 * tariffAt(s.start + k, sim.a)).reduce((m, x) => m + x, 0);
  const gridShare = (() => { const f = sim.flows.slice(s.start, s.end); const g = f.reduce((m, x) => m + x.grid, 0), l = f.reduce((m, x) => m + x.load, 0); return l ? g / l : 0; })();
  const carbonImpact = s.energyKWh * gridShare * sim.a.carbonG / 1000;
  const wearImpact = s.chargerId.startsWith("DC") ? s.energyKWh * 0.6 : 0;
  const decisionId = `DEC-${DAY_NAMES[sim.a.day].toUpperCase()}-${String(s.rank).padStart(2, "0")}-${s.vehicleId}`;
  const override = sim.a.overrides[s.vehicleId];
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
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium tracking-wider text-cyan uppercase">Selected action</span><span className="text-xs text-white/60">Deadline margin: <b className="text-white">{marginLabel}</b></span></div>
            <p className="mt-3 text-xl font-semibold leading-snug">Assign {s.vehicleId} to {s.chargerId}, {fmtT(s.start)}–{fmtT(s.end)} at {s.powerKW} kW ({s.energyKWh} kWh)</p>
            <p className="mt-3 leading-relaxed text-white/70">{s.rationale}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant={reviewed[s.vehicleId] ? "onDark" : "primary"} size="sm" onClick={mark}>{reviewed[s.vehicleId] ? "✓ Reviewed — undo" : "Mark as reviewed"}</Button>
              <ButtonLink to="/app/scenarios" variant="onDark" size="sm">Test alternatives in a scenario</ButtonLink>
            </div>
          </section>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            {[["Cost impact", `${inr(costImpact)}`, "if fully grid-supplied at tariff"], ["Carbon impact", `${carbonImpact.toFixed(1)} kg`, `at ${Math.round(gridShare * 100)}% grid share in window`], ["Wear impact (proxy)", inr(wearImpact), s.chargerId.startsWith("DC") ? "DC fast-charge" : "AC — negligible"], ["Deadline risk", s.late ? "At risk" : "None", `${slackH.toFixed(2)} h slack`]].map(([k, v, h]) => (
              <div key={k} className="bg-white p-4"><div className="text-xs text-muted">{k}</div><div className="tnum mt-1 font-semibold">{v}</div><div className="mt-0.5 text-[11px] text-muted">{h}</div></div>
            ))}
          </div>
          <Panel title="Important inputs">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {[["Current SoC", `${v.soc}%`], ["Required SoC", `${v.requiredSoC}%`], ["Departure", fmtT(v.departure)], ["Battery", `${v.capKWh} kWh`], ["Max accept", `${v.maxKW} kW`], ["Est. SoH", `${v.estSoH}% ± ${v.sohUnc}`], ["Tariff at start", `₹${tariffAt(s.start, sim.a).toFixed(2)}/kWh`], ["Grid limit", `${sim.a.gridLimitKW} kW`], ["Slack after finish", `${slackH.toFixed(2)} h`]].map(([k, val]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="tnum mt-0.5 font-medium">{val}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel title="Hard constraints applied" sub={`${s.constraints.length} checked · all satisfied`} collapsible="ex-cons" defaultOpen={false}><ul className="space-y-2 text-sm">{s.constraints.map((c) => <li key={c} className="flex gap-2"><span className="text-ok">✓</span>{c}</li>)}</ul></Panel>
          <Panel title="Alternatives considered" sub={s.alternatives.length ? `${s.alternatives.length} other charger option(s)` : "No other compatible charger"} collapsible="ex-alt" defaultOpen={false}>
            {s.alternatives.length ? (
              <table className="w-full text-sm"><thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Charger</th><th className="pb-2 font-medium">Window</th><th className="pb-2 font-medium">Why not selected</th></tr></thead>
                <tbody className="divide-y divide-line">{s.alternatives.map((alt) => <tr key={alt.chargerId}><td className="py-2 font-medium">{alt.chargerId}</td><td className="tnum">{fmtT(alt.start)}–{fmtT(alt.end)}</td><td className="text-muted">{alt.note}</td></tr>)}</tbody></table>
            ) : <p className="text-sm text-muted">No other compatible charger was available.</p>}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel collapsible="ex-score" defaultOpen={false} title="Prioritisation factors" sub={sim.a.strategy === "evos" ? `Rank #${s.rank} of ${sim.sessions.length}` : `Score shown for reference — ${STRATEGIES.find((x) => x.id === sim.a.strategy)!.short} orders by ${sim.a.strategy === "fcfs" ? "arrival" : "priority then deadline"}`}><ScoreBars s={s.score} /></Panel>
          <Panel title="Decision record" sub={`${decisionId} · ${ALGORITHM_VERSION}`} collapsible="ex-rec" defaultOpen={false}>
            <dl className="space-y-2 text-sm">
              {[["Decision ID", decisionId], ["Timestamp", `Demo day ${fmtT(NOW)}`], ["Algorithm", `${ALGORITHM_VERSION} · ${STRATEGIES.find((x) => x.id === sim.a.strategy)!.short}`], ["Fallback", s.late ? "Flag for operator; accept lower SoC or reprioritise" : s.delayedByCap ? "Delayed start to respect site cap" : "None needed"], ["Manual override", override ? Object.entries(override).map(([k, v]) => `${k}: ${k === "departureStep" ? fmtT(v as number) : v}`).join(", ") : "None"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="tnum text-right font-medium break-all">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5"><ProvBadge p="simulated" /><Badge>SoC: simulated</Badge><Badge>SoH: estimated</Badge><Badge>PV: forecast</Badge><Badge>Tariff: illustrative</Badge></div>
          </Panel>
          <Disclosure id="ex-lim" label="Limitations of this decision logic">Greedy heuristic: vehicles are placed one at a time in priority order and earlier placements are not revisited, so the result is reasonable but not guaranteed optimal. Battery wear is not part of the score in this version.</Disclosure>
          <Panel title="Decision log" sub={`${sim.sessions.length} decisions · view all`} pad={false} collapsible="ex-log" defaultOpen={false}>
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
