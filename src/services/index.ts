/**
 * EVOS data-access layer.
 *
 * UI code talks only to these service interfaces. Operational fleet calculations still use
 * the deterministic local model, while live source parameters are fetched through the API
 * boundary below and explicitly applied when the source response is usable.
 */
import {
  simulate,
  compareStrategies,
  forecastSeries,
  deriveAlerts,
  sohTrend,
  CHARGERS,
  type Assumptions,
  type SimResult,
} from "../lib/sim"
import { EXTERNAL_SOURCES } from "../data/catalog"
import type { Provenance } from "../data/contracts"

export const ALGORITHM_VERSION = "evos-deterministic-engine 1.0.0"
export const FORECAST_MODEL_VERSION =
  "profile-baseline 0.1 (not a trained model)"

export type BackendKind = "demo" | "supabase"
export interface BackendStatus {
  kind: BackendKind | "api"
  connected: boolean
  configured: boolean
  message: string
}

export function backendStatus(): BackendStatus {
  const apiUrl = import.meta.env.VITE_BACKEND_URL as string | undefined
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (apiUrl) {
    return {
      kind: "api",
      connected: true,
      configured: true,
      message: `Backend API configured at ${apiUrl}; external source status is reported by the server.`,
    }
  }
  const configured = !!url && !!key
  return {
    kind: "demo",
    connected: false,
    configured,
    message: configured
      ? "Supabase variables are present, but no Supabase adapter is implemented yet. EVOS is using the local demo model."
      : "No backend configured. EVOS is using the local, deterministic demo model.",
  }
}

export interface LiveParameters {
  observedAt: string
  parameters: {
    solarMult: number | null
    tariffINR: number | null
    carbonG: number | null
    tariffProfile?: unknown
    carbonProfile?: unknown
    acnSessionData: unknown
    acnHistoricalBaseline?: {
      recordCount: number
      totalDeliveredKWh: number
      averageSessionEnergyKWh: number | null
      stationCount: number
      period: { from: string; to: string } | null
      identityMapping: string
    } | null
    nasaPowerData: unknown
    pvgisData: unknown
  }
  sources: {
    source: string
    status: string
    provenance: string
    limitation?: string
    fetchedAt?: string
    data?: unknown
    normalized?: unknown
    usable?: boolean
  }[]
  fallback: Record<string, string | null>
}

export async function fetchLiveParameters(
  a: Assumptions,
): Promise<LiveParameters> {
  const base = (import.meta.env
    .VITE_BACKEND_URL as string | undefined)?.replace(/\/$/, "")
  if (!base) throw new NotConnectedError("Live backend")
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  const url = new URL(`${base}/api/v1/live/parameters`)
  url.searchParams.set(
    "latitude",
    String(import.meta.env.VITE_SITE_LATITUDE || 28.6139),
  )
  url.searchParams.set(
    "longitude",
    String(import.meta.env.VITE_SITE_LONGITUDE || 77.209),
  )
  url.searchParams.set("date", date)
  url.searchParams.set("pvKWp", String(a.pvKWp))
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Live backend returned HTTP ${response.status}`)
  return response.json() as Promise<LiveParameters>
}

export class NotConnectedError extends Error {
  constructor(what: string) {
    super(
      `${what} is not connected. Configure a backend adapter to load real data.`,
    )
    this.name = "NotConnectedError"
  }
}

// ---- Service interfaces (stable contract for future adapters) ----
export interface VehicleService {
  list(a: Assumptions): Promise<SimResult["vehicles"]>
}
export interface ChargingSessionService {
  schedule(a: Assumptions): Promise<SimResult["sessions"]>
}
export interface BatteryHealthService {
  trend(vehicleId: string, a: Assumptions): Promise<ReturnType<typeof sohTrend>>
  rulEstimate(id: string): Promise<null>
}
export interface EnergyService {
  flows(a: Assumptions): Promise<SimResult["flows"]>
}
export interface ForecastingService {
  series(
    a: Assumptions,
    kind: "demand" | "pv",
  ): Promise<ReturnType<typeof forecastSeries>>
  validationMetrics(): Promise<null>
}
export interface SchedulerService {
  compare(a: Assumptions): Promise<ReturnType<typeof compareStrategies>>
}
export interface FaultMonitoringService {
  alerts(a: Assumptions): Promise<ReturnType<typeof deriveAlerts>>
}
export interface DatasetService {
  sources(): Promise<
    ((typeof EXTERNAL_SOURCES)[number] & {
      status: "Not connected"
      lastImport: null
      records: null
      period: null
      quality: null
    })[]
  >
}
export interface SimulationService {
  run(a: Assumptions): Promise<SimResult>
}

export interface Backend {
  vehicles: VehicleService
  sessions: ChargingSessionService
  battery: BatteryHealthService
  energy: EnergyService
  forecasting: ForecastingService
  scheduler: SchedulerService
  faults: FaultMonitoringService
  datasets: DatasetService
  simulation: SimulationService
  provenance: Provenance
}

const mockAdapter: Backend = {
  provenance: "simulated",
  vehicles: { list: async (a) => simulate(a).vehicles },
  sessions: { schedule: async (a) => simulate(a).sessions },
  battery: {
    trend: async (id, a) => {
      const v = simulate(a).vehicles.find((x) => x.id === id)
      if (!v) throw new Error(`Vehicle ${id} not found`)
      return sohTrend(v)
    },
    rulEstimate: async () => null, // no validated RUL method yet
  },
  energy: { flows: async (a) => simulate(a).flows },
  forecasting: {
    series: async (a, k) => forecastSeries(simulate(a), k),
    validationMetrics: async () => null,
  },
  scheduler: { compare: async (a) => compareStrategies(a) },
  faults: { alerts: async (a) => deriveAlerts(simulate(a)) },
  datasets: {
    sources: async () =>
      EXTERNAL_SOURCES.map((s) => ({
        ...s,
        status: "Not connected" as const,
        lastImport: null,
        records: null,
        period: null,
        quality: null,
      })),
  },
  simulation: { run: async (a) => simulate(a) },
}

export function getBackend(): Backend {
  // Future: if (backendStatus().configured) return createSupabaseAdapter(...)
  return mockAdapter
}

export const chargerCount = CHARGERS.length
