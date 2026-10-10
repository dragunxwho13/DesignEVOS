/**
 * EVOS data-access layer.
 *
 * UI code talks only to these service interfaces. Today every service is backed by the
 * deterministic local demo model (`mockAdapter`). To connect a backend later, implement the
 * same interfaces (e.g. with Supabase queries) and return them from `getBackend()`.
 * Nothing here performs network requests yet.
 */
import { simulate, compareStrategies, forecastSeries, deriveAlerts, sohTrend, CHARGERS, type Assumptions, type SimResult } from "../lib/sim";
import { EXTERNAL_SOURCES } from "../data/catalog";
import type { Provenance } from "../data/contracts";

export const ALGORITHM_VERSION = "evos-demo-heuristic 0.3.0";
export const FORECAST_MODEL_VERSION = "profile-baseline 0.1 (not a trained model)";

export type BackendKind = "demo" | "supabase";
export interface BackendStatus {
  kind: BackendKind;
  connected: boolean;
  configured: boolean;
  message: string;
}

export function backendStatus(): BackendStatus {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const configured = !!url && !!key;
  return {
    kind: "demo",
    connected: false,
    configured,
    message: configured
      ? "Supabase variables are present, but no Supabase adapter is implemented yet. EVOS is using the local demo model."
      : "No backend configured. EVOS is using the local, deterministic demo model.",
  };
}

export class NotConnectedError extends Error {
  constructor(what: string) {
    super(`${what} is not connected. Configure a backend adapter to load real data.`);
    this.name = "NotConnectedError";
  }
}

// ---- Service interfaces (stable contract for future adapters) ----
export interface VehicleService { list(a: Assumptions): Promise<SimResult["vehicles"]> }
export interface ChargingSessionService { schedule(a: Assumptions): Promise<SimResult["sessions"]> }
export interface BatteryHealthService { trend(vehicleId: string, a: Assumptions): Promise<ReturnType<typeof sohTrend>>; rulEstimate(id: string): Promise<null> }
export interface EnergyService { flows(a: Assumptions): Promise<SimResult["flows"]> }
export interface ForecastingService { series(a: Assumptions, kind: "demand" | "pv"): Promise<ReturnType<typeof forecastSeries>>; validationMetrics(): Promise<null> }
export interface SchedulerService { compare(a: Assumptions): Promise<ReturnType<typeof compareStrategies>> }
export interface FaultMonitoringService { alerts(a: Assumptions): Promise<ReturnType<typeof deriveAlerts>> }
export interface DatasetService { sources(): Promise<(typeof EXTERNAL_SOURCES[number] & { status: "Not connected"; lastImport: null; records: null; period: null; quality: null })[]> }
export interface SimulationService { run(a: Assumptions): Promise<SimResult> }

export interface Backend {
  vehicles: VehicleService;
  sessions: ChargingSessionService;
  battery: BatteryHealthService;
  energy: EnergyService;
  forecasting: ForecastingService;
  scheduler: SchedulerService;
  faults: FaultMonitoringService;
  datasets: DatasetService;
  simulation: SimulationService;
  provenance: Provenance;
}

const mockAdapter: Backend = {
  provenance: "simulated",
  vehicles: { list: async (a) => simulate(a).vehicles },
  sessions: { schedule: async (a) => simulate(a).sessions },
  battery: {
    trend: async (id, a) => {
      const v = simulate(a).vehicles.find((x) => x.id === id);
      if (!v) throw new Error(`Vehicle ${id} not found`);
      return sohTrend(v);
    },
    rulEstimate: async () => null, // no validated RUL method yet
  },
  energy: { flows: async (a) => simulate(a).flows },
  forecasting: { series: async (a, k) => forecastSeries(simulate(a), k), validationMetrics: async () => null },
  scheduler: { compare: async (a) => compareStrategies(a) },
  faults: { alerts: async (a) => deriveAlerts(simulate(a)) },
  datasets: { sources: async () => EXTERNAL_SOURCES.map((s) => ({ ...s, status: "Not connected" as const, lastImport: null, records: null, period: null, quality: null })) },
  simulation: { run: async (a) => simulate(a) },
};

export function getBackend(): Backend {
  // Future: if (backendStatus().configured) return createSupabaseAdapter(...)
  return mockAdapter;
}

export const chargerCount = CHARGERS.length;
