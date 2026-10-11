// EVOS deterministic demo model. All values are illustrative simulation outputs, not measured data.

export const STEP_H = 0.25; // 15-minute timesteps
export const STEPS = 96;
export const NOW = 40; // 10:00 on the demo day
export const PV_KWP = 100;
export const STORAGE_KWH = 100;
export const STORAGE_KW = 50;
export const CHARGE_EFF = 0.92;

export type VClass = "Shuttle bus" | "Utility cart" | "Service van";
export type Readiness = "Ready" | "Charging" | "Scheduled" | "At risk" | "Unavailable" | "Idle";

export interface Assumptions {
  reservePct: number;
  gridLimitKW: number;
  solarMult: number;
  tariffINR: number;
  peakMult: number;
  carbonG: number; // gCO2e per kWh grid import
  requesting: number;
  storageStartPct: number;
  chargerFault: boolean;
  day: number; // 0..6 within the demo week
  strategy: Strategy;
  overrides: Record<string, VehicleOverride>;
  faults: FaultId[];
  pvKWp: number;
  storageKWh: number;
  storageKW: number;
  customVehicles: VehicleSpec[];
  removedVehicleIds: string[];
}

export type Strategy = "fcfs" | "rule" | "evos";
export const STRATEGIES: { id: Strategy; label: string; short: string; desc: string }[] = [
  { id: "fcfs", label: "First-come, first-served", short: "FCFS", desc: "Vehicles charge in arrival order on the first free compatible charger at full power. No site power cap — exceedances are flagged." },
  { id: "rule", label: "Rule-based (earliest deadline)", short: "Rule-based", desc: "High-priority vehicles first, then earliest departure. Earliest-finish charger, within the site power cap." },
  { id: "evos", label: "EVOS weighted heuristic", short: "EVOS", desc: "Weighted score of urgency, SoC deficit, slack, service class and operator priority. Earliest-finish charger, within the site power cap." },
];
export type Priority = "High" | "Normal" | "Low";
export interface VehicleOverride { priority?: Priority; departureStep?: number; requiredSoC?: number }

export type FaultId = "dc2-comm" | "crt05-frozen" | "van03-invalid";
export const FAULTS: { id: FaultId; label: string; asset: string; effect: string }[] = [
  { id: "dc2-comm", label: "Delayed charger telemetry", asset: "DC-2", effect: "Packets delayed; charger derated to 20 kW as a safety fallback." },
  { id: "crt05-frozen", label: "Frozen SoC reading", asset: "CRT-05", effect: "SoC value stops updating; scheduler uses last valid reading and flags data quality." },
  { id: "van03-invalid", label: "Invalid SoC value (112%)", asset: "VAN-03", effect: "Validation rejects the record; vehicle held out of scheduling until checked." },
];

export const DEFAULTS: Assumptions = {
  reservePct: 20,
  gridLimitKW: 80,
  solarMult: 1,
  tariffINR: 8,
  peakMult: 1.4,
  carbonG: 710,
  requesting: 14,
  storageStartPct: 60,
  chargerFault: true,
  day: 0,
  strategy: "evos",
  overrides: {},
  faults: [],
  pvKWp: 100,
  storageKWh: 100,
  storageKW: 50,
  customVehicles: [],
  removedVehicleIds: [],
};

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Illustrative weather factor for each demo day (clear → overcast)
export const DAY_SOLAR = [1, 0.92, 0.55, 0.78, 1.04, 0.86, 0.67];

export interface VehicleSpec {
  id: string;
  cls: VClass;
  capKWh: number;
  maxKW: number;
  dcOnly?: boolean;
  acOnly?: boolean;
  soc: number;
  requiredSoC: number;
  departure: number; // step
  arrival: number; // step the vehicle plugged in / became available
  unavailable?: string;
  cycles: number;
  ageMonths: number;
  fastShare: number; // share of energy from DC
}

const h = (x: number) => Math.round(x * 4);

const RAW: [string, VClass, number, number, number, number, number][] = [
  // id, class, soc, required, departureH, cycles, ageMonths
  ["BUS-01", "Shuttle bus", 34, 90, 12.5, 820, 30],
  ["BUS-02", "Shuttle bus", 52, 90, 16, 640, 24],
  ["BUS-03", "Shuttle bus", 28, 85, 17.5, 1110, 41],
  ["BUS-04", "Shuttle bus", 61, 90, 19, 380, 14],
  ["BUS-05", "Shuttle bus", 45, 85, 13, 930, 33],
  ["BUS-06", "Shuttle bus", 88, 85, 18, 210, 8],
  ["VAN-01", "Service van", 38, 85, 12, 560, 22],
  ["VAN-02", "Service van", 55, 85, 16.5, 700, 27],
  ["VAN-03", "Service van", 70, 85, 21, 300, 12],
  ["VAN-04", "Service van", 25, 80, 18.5, 980, 38],
  ["CRT-01", "Utility cart", 40, 80, 12, 1300, 36],
  ["CRT-02", "Utility cart", 22, 80, 13.5, 1540, 44],
  ["CRT-03", "Utility cart", 65, 80, 15, 900, 26],
  ["CRT-04", "Utility cart", 90, 80, 12.5, 420, 12],
  ["CRT-05", "Utility cart", 35, 80, 16, 1120, 32],
  ["CRT-06", "Utility cart", 55, 80, 17, 760, 20],
  ["CRT-07", "Utility cart", 18, 80, 14.5, 1680, 48],
  ["CRT-08", "Utility cart", 72, 80, 19.5, 610, 18],
  ["CRT-09", "Utility cart", 48, 80, 20, 1420, 40],
  ["CRT-10", "Utility cart", 30, 80, 18, 980, 28],
];

export const VEHICLES: VehicleSpec[] = RAW.map(([id, cls, soc, req, dep, cycles, age], i) => ({
  id,
  cls,
  soc,
  requiredSoC: req,
  departure: h(dep),
  arrival: h(6 + ((i * 37) % 40) / 10),
  cycles,
  ageMonths: age,
  capKWh: cls === "Shuttle bus" ? 120 : cls === "Service van" ? 60 : 12,
  maxKW: cls === "Shuttle bus" ? 60 : cls === "Service van" ? 30 : 3.3,
  dcOnly: cls === "Shuttle bus",
  acOnly: cls === "Utility cart",
  fastShare: cls === "Shuttle bus" ? 0.9 : cls === "Service van" ? 0.35 + (i % 3) * 0.1 : 0,
  unavailable: id === "CRT-09" ? "Scheduled maintenance (brake inspection)" : undefined,
}));

export interface Charger {
  id: string;
  type: "DC" | "AC";
  maxKW: number;
  connector: string;
  compat: VClass[];
}
export const CHARGERS: Charger[] = [
  { id: "DC-1", type: "DC", maxKW: 30, connector: "CCS2", compat: ["Shuttle bus", "Service van"] },
  { id: "DC-2", type: "DC", maxKW: 30, connector: "CCS2", compat: ["Shuttle bus", "Service van"] },
  { id: "AC-1", type: "AC", maxKW: 7.4, connector: "Type 2", compat: ["Service van", "Utility cart"] },
  { id: "AC-2", type: "AC", maxKW: 7.4, connector: "Type 2", compat: ["Service van", "Utility cart"] },
  { id: "AC-3", type: "AC", maxKW: 7.4, connector: "Type 2", compat: ["Service van", "Utility cart"] },
  { id: "AC-4", type: "AC", maxKW: 7.4, connector: "Type 2", compat: ["Service van", "Utility cart"] },
];

export const fmtT = (step: number) => {
  const s = Math.max(0, Math.min(STEPS, Math.round(step)));
  const hh = Math.floor(s / 4);
  const mm = (s % 4) * 15;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export const isPeak = (t: number) => t >= 68 && t < 88; // 17:00–22:00
export const isOffPeak = (t: number) => t < 24; // 00:00–06:00
export const tariffAt = (t: number, a: Assumptions) =>
  a.tariffINR * (isPeak(t) ? a.peakMult : isOffPeak(t) ? 0.75 : 1);

export function pvAt(t: number, mult: number, kwp = PV_KWP) {
  const hr = t / 4 + 0.125;
  if (hr < 6 || hr > 18.5) return 0;
  const shape = Math.sin((Math.PI * (hr - 6)) / 12.5);
  return Math.min(kwp, kwp * 0.74 * mult * Math.pow(Math.max(0, shape), 1.3));
}
export function baseLoadAt(t: number) {
  const hr = t / 4;
  return 9 + (hr >= 7 && hr < 20 ? 7 : 0) + (hr >= 9 && hr < 17 ? 3 : 0);
}
// Simulated pre-"now" charging history (overnight cart and van charging)
function historyCharging(t: number) {
  if (t >= NOW) return 0;
  if (t < 24) return 26 - t * 0.25;
  return 12 - (t - 24) * 0.5;
}

export interface ScoreBreakdown {
  urgency: number;
  deficit: number;
  slack: number;
  classWeight: number;
  priority: number;
  total: number;
}
export interface Alternative {
  chargerId: string;
  start: number;
  end: number;
  note: string;
}
export interface Session {
  vehicleId: string;
  chargerId: string;
  start: number;
  end: number;
  powerKW: number;
  energyKWh: number;
  priority: number;
  rank: number;
  late: boolean;
  delayedByCap: boolean;
  score: ScoreBreakdown;
  alternatives: Alternative[];
  constraints: string[];
  rationale: string;
}

export interface VehicleState extends VehicleSpec {
  readiness: Readiness;
  session?: Session;
  projectedSoC: number;
  estSoH: number;
  sohUnc: number;
  sohFlag?: string;
  note: string;
  priority: Priority;
  dataIssue?: string;
  energyRequiredKWh: number;
}

export interface StepFlow {
  t: number;
  pv: number;
  pvToLoad: number;
  pvToStorage: number;
  pvExport: number;
  storageToLoad: number;
  grid: number;
  charging: number;
  base: number;
  load: number;
  storageSoC: number; // %
  exceed: number;
  cap: number;
}

export interface SimResult {
  a: Assumptions;
  vehicles: VehicleState[];
  sessions: Session[];
  flows: StepFlow[];
  totals: {
    load: number;
    charging: number;
    pv: number;
    pvToLoad: number;
    storageToLoad: number;
    grid: number;
    pvExport: number;
    cost: number;
    baselineCost: number;
    emissionsKg: number;
    baselineKg: number;
    renewableShare: number;
    peakGrid: number;
    exceedSteps: number;
    onTime: number;
    requested: number;
    atRisk: number;
    storageCycles: number;
    minStorage: number;
    lateMinutes: number;
    unservedKWh: number;
    wearCostINR: number;
    completionRate: number;
  };
}

function sohFor(v: VehicleSpec) {
  const fade = v.cycles * 0.0068 + v.ageMonths * 0.085 + v.fastShare * 2.2;
  const soh = Math.round((100 - fade) * 10) / 10;
  const unc = Math.round((1.2 + (v.cycles > 1000 ? 1.4 : 0.6) + (v.cls === "Utility cart" ? 0.8 : 0)) * 10) / 10;
  return { soh, unc };
}

export function sohTrend(v: VehicleSpec) {
  // 12 monthly estimates ending at current estimate
  const { soh, unc } = sohFor(v);
  const perMonth = (100 - soh) / Math.max(v.ageMonths, 1);
  return Array.from({ length: 12 }, (_, i) => {
    const back = 11 - i;
    const val = Math.min(100, soh + perMonth * back * (1 + back * 0.01));
    return { m: i, value: Math.round(val * 10) / 10, lo: val - unc * (0.6 + i * 0.04), hi: Math.min(100, val + unc * (0.6 + i * 0.04)) };
  });
}

// Deterministic → safe to memoise. Small LRU keyed by the full assumption set.
const SIM_CACHE = new Map<string, SimResult>();
export function simulate(a: Assumptions): SimResult {
  const key = JSON.stringify(a);
  const hit = SIM_CACHE.get(key);
  if (hit) { SIM_CACHE.delete(key); SIM_CACHE.set(key, hit); return hit; }
  const r = simulateUncached(a);
  SIM_CACHE.set(key, r);
  if (SIM_CACHE.size > 40) SIM_CACHE.delete(SIM_CACHE.keys().next().value!);
  return r;
}

function simulateUncached(a: Assumptions): SimResult {
  const solarMult = a.solarMult * DAY_SOLAR[a.day];
  const PVK = a.pvKWp ?? PV_KWP, SKWH = a.storageKWh ?? STORAGE_KWH, SKW = a.storageKW ?? STORAGE_KW;
  const pv = Array.from({ length: STEPS }, (_, t) => pvAt(t, solarMult, PVK));
  const faults = new Set(a.faults ?? []);
  const strategy: Strategy = a.strategy ?? "evos";
  const ov = a.overrides ?? {};
  const registry = [...VEHICLES, ...(a.customVehicles ?? [])].filter(
    (v, index, all) =>
      !(a.removedVehicleIds ?? []).includes(v.id) &&
      all.findIndex((candidate) => candidate.id === v.id) === index,
  );
  const FLEET: (VehicleSpec & { priority: Priority; dataIssue?: string })[] = registry.map((v) => {
    const o = ov[v.id] ?? {};
    let dataIssue: string | undefined;
    let unavailable = v.unavailable;
    if (faults.has("crt05-frozen") && v.id === "CRT-05") dataIssue = "Frozen SoC reading (injected) — last valid value used";
    if (faults.has("van03-invalid") && v.id === "VAN-03") { dataIssue = "Invalid SoC 112% rejected by validation (injected)"; unavailable = "Held: invalid SoC record awaiting check"; }
    return { ...v, unavailable, departure: o.departureStep ?? v.departure, requiredSoC: o.requiredSoC ?? v.requiredSoC, priority: o.priority ?? "Normal", dataIssue };
  });
  const chargers = CHARGERS.filter((c) => !(a.chargerFault && c.id === "AC-4")).map((c) =>
    faults.has("dc2-comm") && c.id === "DC-2" ? { ...c, maxKW: 20 } : c);
  const useCap = strategy !== "fcfs";
  const free: Record<string, number> = Object.fromEntries(chargers.map((c) => [c.id, NOW]));
  const load = new Array(STEPS).fill(0);
  const cap = (t: number) => a.gridLimitKW + pv[t] + SKW * 0.5 - baseLoadAt(t);

  const needing = FLEET.filter((v) => !v.unavailable && v.soc < v.requiredSoC);
  const requested = needing.slice(0, Math.max(0, Math.min(a.requesting, needing.length)));

  const scored = requested.map((v) => {
    const energy = ((v.requiredSoC - v.soc) / 100) * v.capKWh / CHARGE_EFF;
    const bestKW = Math.min(v.maxKW, v.acOnly ? 7.4 : 30);
    const hoursNeeded = energy / bestKW;
    const hoursLeft = Math.max(0.25, (v.departure - NOW) * STEP_H);
    const urgency = Math.min(1, hoursNeeded / hoursLeft);
    const deficit = (v.requiredSoC - v.soc) / 100;
    const slack = Math.max(0, 1 - (hoursLeft - hoursNeeded) / 8);
    const classWeight = v.cls === "Shuttle bus" ? 1 : v.cls === "Service van" ? 0.7 : 0.4;
    const prio = v.priority === "High" ? 0.25 : v.priority === "Low" ? -0.25 : 0;
    const total = Math.max(0, 0.45 * urgency + 0.2 * deficit + 0.2 * slack + 0.15 * classWeight + prio);
    return { v, energy, score: { urgency, deficit, slack, classWeight, priority: prio, total } };
  });
  const pr = (p: Priority) => (p === "High" ? 0 : p === "Normal" ? 1 : 2);
  if (strategy === "fcfs") scored.sort((x, y) => x.v.arrival - y.v.arrival || x.v.id.localeCompare(y.v.id));
  else if (strategy === "rule") scored.sort((x, y) => pr(x.v.priority) - pr(y.v.priority) || x.v.departure - y.v.departure);
  else scored.sort((x, y) => y.score.total - x.score.total || x.v.departure - y.v.departure);

  const sessions: Session[] = [];
  scored.forEach(({ v, energy, score }, idx) => {
    const options = chargers
      .filter((c) => c.compat.includes(v.cls))
      .map((c) => {
        const p = Math.min(c.maxKW, v.maxKW);
        const dur = Math.ceil(energy / (p * STEP_H));
        let s = free[c.id];
        let delayed = false;
        while (s + dur <= STEPS) {
          let ok = true;
          if (useCap) for (let t = s; t < s + dur; t++) if (load[t] + p > cap(t)) { ok = false; break; }
          if (ok) break;
          s++;
          delayed = true;
        }
        return { c, p, s, e: Math.min(STEPS, s + dur), delayed };
      })
      .sort((x, y) => (strategy === "fcfs" ? x.s - y.s || y.p - x.p : x.e - y.e || y.p - x.p));
    const best = options[0];
    if (!best) return;
    for (let t = best.s; t < best.e; t++) load[t] += best.p;
    free[best.c.id] = best.e;
    const late = best.e > v.departure;
    const constraints = [
      `${best.c.id} max ${best.c.maxKW} kW; vehicle accepts ≤ ${v.maxKW} kW → ${best.p} kW`,
      `Connector ${best.c.connector} compatible with ${v.cls.toLowerCase()}`,
      `Departure ${fmtT(v.departure)} requires ${v.requiredSoC}% SoC`,
      useCap ? `Site charging cap respects ${a.gridLimitKW} kW grid import limit plus PV and storage support` : "FCFS applies no site power cap; grid exceedances are flagged, not prevented",
    ];
    if (v.priority !== "Normal") constraints.push(`Operator priority override: ${v.priority}`);
    if (faults.has("dc2-comm") && best.c.id === "DC-2") constraints.push("DC-2 derated to 20 kW: delayed telemetry fallback (injected fault)");
    if (v.dataIssue) constraints.push(v.dataIssue);
    if (a.chargerFault && v.cls !== "Shuttle bus") constraints.push("AC-4 excluded: simulated fault");
    const rationale = strategy === "fcfs"
      ? `Position #${idx + 1} in arrival order (arrived ${fmtT(v.arrival)}). Placed on the first free compatible charger (${best.c.id}) at full power${late ? "; finishes after departure" : ""}.`
      : strategy === "rule"
      ? `Position #${idx + 1}: ${v.priority} priority, departure ${fmtT(v.departure)} (earliest-deadline rule). ${best.c.id} gives the earliest completion (${fmtT(best.e)})${late ? ", still after departure" : ""}.`
      : late
      ? `Highest-scoring free slot still finishes after departure; flagged as at risk so an operator can reprioritise or accept a lower SoC.`
      : `Ranked #${idx + 1} by urgency (energy needed vs time to departure). ${best.c.id} gives the earliest completion (${fmtT(best.e)}) before the ${fmtT(v.departure)} departure${best.delayed ? ", after a short delay to stay within the site power cap" : ""}.`;
    sessions.push({
      vehicleId: v.id,
      chargerId: best.c.id,
      start: best.s,
      end: best.e,
      powerKW: best.p,
      energyKWh: Math.round(best.p * (best.e - best.s) * STEP_H * 10) / 10,
      priority: Math.round(score.total * 100),
      rank: idx + 1,
      late,
      delayedByCap: best.delayed,
      score,
      constraints,
      rationale,
      alternatives: options.slice(1, 3).map((o) => ({
        chargerId: o.c.id,
        start: o.s,
        end: o.e,
        note: o.e > v.departure ? "Would miss departure" : `Finishes ${((o.e - best.e) * 15)} min later at ${o.p} kW`,
      })),
    });
  });

  // Energy dispatch
  const flows: StepFlow[] = [];
  let soc = (a.storageStartPct / 100) * SKWH;
  const reserve = (a.reservePct / 100) * SKWH;
  let minStorage = 100;
  let throughput = 0;
  for (let t = 0; t < STEPS; t++) {
    const charging = load[t] + historyCharging(t);
    const base = baseLoadAt(t);
    const L = charging + base;
    const pvToLoad = Math.min(pv[t], L);
    let surplus = pv[t] - pvToLoad;
    const pvToStorage = Math.min(surplus, SKW, (SKWH - soc) / STEP_H / 0.95);
    soc += pvToStorage * STEP_H * 0.95;
    surplus -= pvToStorage;
    const deficit = L - pvToLoad;
    let dis = 0;
    const avail = Math.max(0, (soc - reserve) / STEP_H);
    if (isPeak(t)) dis = Math.min(deficit, SKW, avail);
    else if (deficit > a.gridLimitKW) dis = Math.min(deficit - a.gridLimitKW, SKW, avail);
    soc -= dis * STEP_H;
    throughput += (dis + pvToStorage) * STEP_H;
    const grid = deficit - dis;
    const pct = (soc / SKWH) * 100;
    minStorage = Math.min(minStorage, pct);
    flows.push({
      t, pv: pv[t], pvToLoad, pvToStorage, pvExport: surplus, storageToLoad: dis, grid,
      charging, base, load: L, storageSoC: pct, exceed: Math.max(0, grid - a.gridLimitKW), cap: cap(t) + baseLoadAt(t),
    });
  }

  const sum = (f: (s: StepFlow) => number) => flows.reduce((acc, s) => acc + f(s) * STEP_H, 0);
  const cost = flows.reduce((acc, s) => acc + s.grid * STEP_H * tariffAt(s.t, a), 0);
  const baselineCost = flows.reduce((acc, s) => acc + s.load * STEP_H * tariffAt(s.t, a), 0);
  const tLoad = sum((s) => s.load);
  const gridE = sum((s) => s.grid);
  const pvToLoadE = sum((s) => s.pvToLoad);
  const stoE = sum((s) => s.storageToLoad);

  const sessByV = Object.fromEntries(sessions.map((s) => [s.vehicleId, s]));
  const vehicles: VehicleState[] = FLEET.map((v) => {
    const s = sessByV[v.id];
    const { soh, unc } = sohFor(v);
    let readiness: Readiness;
    let note: string;
    let projected = v.soc;
    if (v.unavailable) { readiness = "Unavailable"; note = v.unavailable; }
    else if (v.soc >= v.requiredSoC) { readiness = "Ready"; note = "Meets departure target"; }
    else if (s) {
      projected = Math.min(100, v.soc + (s.energyKWh * CHARGE_EFF / v.capKWh) * 100);
      if (s.late) { readiness = "At risk"; note = `Charging completes ${fmtT(s.end)}, after ${fmtT(v.departure)} departure`; }
      else if (s.start <= NOW) { readiness = "Charging"; note = `On ${s.chargerId} until ${fmtT(s.end)}`; }
      else { readiness = "Scheduled"; note = `${s.chargerId} from ${fmtT(s.start)}`; }
    } else { readiness = "Idle"; note = "Below target; not requesting charge in this scenario"; }
    const sohFlag = soh < 86 ? "Below 86% estimated SoH — review at next service" : unc > 3 ? "High estimate uncertainty — more data needed" : undefined;
    const energyRequiredKWh = Math.max(0, ((v.requiredSoC - v.soc) / 100) * v.capKWh / CHARGE_EFF);
    return { ...v, readiness, session: s, projectedSoC: Math.round(projected), estSoH: soh, sohUnc: unc, sohFlag, note, energyRequiredKWh };
  });

  const onTime = sessions.filter((s) => !s.late).length;
  return {
    a, vehicles, sessions, flows,
    totals: {
      load: tLoad, charging: sum((s) => s.charging), pv: sum((s) => s.pv), pvToLoad: pvToLoadE, storageToLoad: stoE,
      grid: gridE, pvExport: sum((s) => s.pvExport), cost, baselineCost,
      emissionsKg: (gridE * a.carbonG) / 1000, baselineKg: (tLoad * a.carbonG) / 1000,
      renewableShare: tLoad ? (pvToLoadE + stoE) / tLoad : 0,
      peakGrid: Math.max(...flows.map((f) => f.grid)),
      exceedSteps: flows.filter((f) => f.exceed > 0.01).length,
      onTime, requested: sessions.length, atRisk: sessions.length - onTime,
      storageCycles: throughput / (2 * SKWH), minStorage,
      lateMinutes: sessions.reduce((m, x) => m + Math.max(0, x.end - (FLEET.find((v) => v.id === x.vehicleId)!.departure)) * 15, 0),
      unservedKWh: sessions.reduce((m, x) => {
        const v = FLEET.find((y) => y.id === x.vehicleId)!;
        const by = Math.max(0, Math.min(x.end, v.departure) - x.start);
        return m + Math.max(0, x.energyKWh - x.powerKW * by * STEP_H);
      }, 0),
      wearCostINR: throughput * WEAR_INR_PER_KWH + sessions.reduce((m, x) => m + (x.chargerId.startsWith("DC") ? x.energyKWh * DC_WEAR_INR_PER_KWH : 0), 0),
      completionRate: sessions.length ? onTime / sessions.length : 1,
    },
  };
}

/** Illustrative degradation-cost coefficients (₹ per kWh throughput). Uncalibrated. */
export const WEAR_INR_PER_KWH = 2.5;
export const DC_WEAR_INR_PER_KWH = 0.6;

export function compareStrategies(a: Assumptions) {
  return STRATEGIES.map((st) => ({ ...st, r: simulate({ ...a, strategy: st.id }) }));
}

export function simulateWeek(a: Assumptions) {
  return DAY_SOLAR.map((_, d) => ({ day: d, r: simulate({ ...a, day: d }) }));
}

// Forecast series (deterministic): observed values exist only before NOW.
export function forecastSeries(r: SimResult, kind: "demand" | "pv") {
  return r.flows.map((f) => {
    const base = kind === "demand" ? f.load : f.pv;
    const ahead = Math.max(0, f.t - NOW) / 4;
    const wobble = 1 + 0.07 * Math.sin(f.t * 1.7) + 0.04 * Math.cos(f.t * 0.6);
    const spread = base * (0.05 + 0.018 * ahead) + (kind === "pv" && base > 0 ? 2 : 0.5);
    return {
      t: f.t,
      observed: f.t < NOW ? Math.max(0, base * wobble) : undefined,
      forecast: f.t >= NOW - 1 ? base : undefined,
      lo: f.t >= NOW - 1 ? Math.max(0, base - spread) : undefined,
      hi: f.t >= NOW - 1 ? (kind === "pv" ? Math.min(r.a.pvKWp ?? PV_KWP, base + spread) : base + spread) : undefined,
    };
  });
}

export type Severity = "Critical" | "Warning" | "Info";
export interface AlertItem {
  id: string;
  severity: Severity;
  time: number;
  asset: string;
  title: string;
  detail: string;
  category: "Fleet" | "Charging" | "Energy" | "Battery";
}

export function deriveAlerts(r: SimResult): AlertItem[] {
  const out: AlertItem[] = [];
  if (r.a.chargerFault)
    out.push({ id: "chg-ac4", severity: "Critical", time: 31, asset: "AC-4", title: "Charger fault (simulated)", detail: "AC-4 reports a ground-fault trip in the fault scenario. It is excluded from scheduling; cart demand is shared across AC-1 to AC-3.", category: "Charging" });
  r.vehicles.filter((v) => v.readiness === "At risk").forEach((v) =>
    out.push({ id: `risk-${v.id}`, severity: "Critical", time: NOW, asset: v.id, title: "May miss departure target", detail: `${v.note}. Projected ${v.projectedSoC}% vs ${v.requiredSoC}% required.`, category: "Fleet" }));
  const ex = r.flows.find((f) => f.exceed > 0.01);
  if (ex) out.push({ id: "grid-exceed", severity: "Warning", time: ex.t, asset: "Grid connection", title: "Grid import above limit", detail: `Import reaches ${r.totals.peakGrid.toFixed(1)} kW against a ${r.a.gridLimitKW} kW limit for ${r.totals.exceedSteps * 15} min. Flagged rather than hidden.`, category: "Energy" });
  const res = r.flows.find((f) => f.t > NOW && f.storageSoC <= r.a.reservePct + 0.5);
  if (res) out.push({ id: "sto-reserve", severity: "Warning", time: res.t, asset: "Stationary battery", title: "Storage at reserve floor", detail: `Storage reaches the ${r.a.reservePct}% reserve at ${fmtT(res.t)}; remaining demand falls back to grid import.`, category: "Energy" });
  r.vehicles.filter((v) => v.sohFlag).forEach((v) =>
    out.push({ id: `soh-${v.id}`, severity: v.estSoH < 86 ? "Warning" : "Info", time: 26, asset: v.id, title: v.estSoH < 86 ? "Maintenance flag: estimated SoH" : "Battery estimate uncertain", detail: `Estimated SoH ${v.estSoH}% ± ${v.sohUnc}. ${v.sohFlag}. This is an estimate, not a diagnosis.`, category: "Battery" }));
  const fl = new Set(r.a.faults ?? []);
  FAULTS.filter((f) => fl.has(f.id)).forEach((f) =>
    out.push({ id: `fault-${f.id}`, severity: "Warning", time: NOW - 2, asset: f.asset, title: `${f.label} (injected)`, detail: `${f.effect} This is a simulated fault-injection experiment, not a hardware event.`, category: f.asset.startsWith("DC") ? "Charging" : "Fleet" }));
  const unav = r.vehicles.find((v) => v.readiness === "Unavailable");
  if (unav) out.push({ id: `unav-${unav.id}`, severity: "Info", time: 28, asset: unav.id, title: "Vehicle unavailable", detail: unav.note, category: "Fleet" });
  out.push({ id: "pv-peak", severity: "Info", time: 50, asset: "Rooftop PV", title: "Solar surplus window", detail: `Forecast PV exceeds site demand around midday; surplus charges storage first, then is exported/curtailed (${r.totals.pvExport.toFixed(0)} kWh).`, category: "Energy" });
  return out.sort((x, y) => ["Critical", "Warning", "Info"].indexOf(x.severity) - ["Critical", "Warning", "Info"].indexOf(y.severity) || y.time - x.time);
}

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const kwh = (n: number) => `${n.toFixed(n >= 100 ? 0 : 1)} kWh`;
