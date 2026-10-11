import type { EntitySpec, Provenance } from "./contracts";

export type Priority = "Essential" | "Recommended" | "Optional" | "Supplementary" | "Required";
export interface ExternalSource {
  id: string;
  name: string;
  use: string;
  category: "Charging" | "Battery" | "Solar & weather" | "Energy" | "Tariff" | "Grid carbon";
  priority: Priority;
  priorityNote?: string;
  docsUrl: string;
  attribution: string;
  access: string;
}

/** External datasets currently supported by the EVOS source registry. */
export const EXTERNAL_SOURCES: ExternalSource[] = [
  { id: "acn", name: "ACN-Data — Open EV Charging Dataset", use: "Real charging behaviour and scheduler validation", category: "Charging", priority: "Essential", docsUrl: "https://ev.caltech.edu/dataset", attribution: "Caltech Adaptive Charging Network", access: "Free API token required" },
  { id: "nasa-battery", name: "NASA Li-ion Battery Aging Dataset", use: "Battery-health and degradation calibration", category: "Battery", priority: "Essential", docsUrl: "https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/", attribution: "NASA Ames Prognostics Center of Excellence", access: "Public download" },
  { id: "nasa-power", name: "NASA POWER Solar and Meteorological Data", use: "Weather and solar inputs for campus PV simulation", category: "Solar & weather", priority: "Essential", docsUrl: "https://power.larc.nasa.gov/", attribution: "NASA Langley Research Center POWER Project", access: "Public API" },
  { id: "pvgis", name: "PVGIS Solar Radiation and PV Performance", use: "Solar-model cross-validation", category: "Solar & weather", priority: "Supplementary", priorityNote: "Alternative or supplementary", docsUrl: "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en", attribution: "European Commission JRC", access: "Public API" },
  { id: "tariff", name: "Electricity Tariff Data", use: "Electricity-price and peak/off-peak modelling", category: "Tariff", priority: "Required", priorityNote: "For real-tariff analysis", docsUrl: "", attribution: "Local utility tariff order (to be selected)", access: "Source to be selected" },
  { id: "carbon", name: "Grid Carbon-Intensity Data", use: "Carbon-aware charging and emissions calculations", category: "Grid carbon", priority: "Required", priorityNote: "For real-data carbon analysis", docsUrl: "", attribution: "Regional grid operator or published factor (to be selected)", access: "Source to be selected" },
];

/** Canonical target fields per import category. Imports map their own columns onto these. */
export const CANONICAL: Record<string, { field: string; label: string; type: "string" | "number" | "timestamp"; unit?: string; required: boolean }[]> = {
  Charging: [
    { field: "sessionId", label: "Session ID", type: "string", required: true },
    { field: "chargerId", label: "Station / charger ID", type: "string", required: true },
    { field: "vehicleId", label: "Vehicle ID", type: "string", required: false },
    { field: "connectionAt", label: "Connection time", type: "timestamp", required: true },
    { field: "disconnectionAt", label: "Disconnection time", type: "timestamp", required: true },
    { field: "energyDeliveredKWh", label: "Energy delivered", type: "number", unit: "kWh", required: true },
    { field: "powerKW", label: "Charging power", type: "number", unit: "kW", required: false },
    { field: "durationH", label: "Charging duration", type: "number", unit: "h", required: false },
    { field: "requestedKWh", label: "Charging request / target", type: "number", unit: "kWh", required: false },
  ],
  Battery: [
    { field: "batteryId", label: "Battery / cell ID", type: "string", required: true },
    { field: "cycle", label: "Cycle count", type: "number", required: true },
    { field: "voltageV", label: "Voltage", type: "number", unit: "V", required: false },
    { field: "currentA", label: "Current", type: "number", unit: "A", required: false },
    { field: "temperatureC", label: "Temperature", type: "number", unit: "°C", required: false },
    { field: "capacityAh", label: "Measured capacity", type: "number", unit: "Ah", required: true },
    { field: "referenceCapacityAh", label: "Reference capacity", type: "number", unit: "Ah", required: false },
    { field: "socPct", label: "State of charge", type: "number", unit: "%", required: false },
    { field: "sohPct", label: "State of health", type: "number", unit: "%", required: false },
    { field: "testAt", label: "Test timestamp", type: "timestamp", required: false },
  ],
  "Solar & weather": [
    { field: "at", label: "Timestamp", type: "timestamp", required: true },
    { field: "irradianceWm2", label: "Solar irradiance", type: "number", unit: "W/m²", required: true },
    { field: "ambientC", label: "Ambient temperature", type: "number", unit: "°C", required: false },
    { field: "moduleC", label: "Module temperature", type: "number", unit: "°C", required: false },
    { field: "windMs", label: "Wind speed", type: "number", unit: "m/s", required: false },
    { field: "pvKW", label: "PV output", type: "number", unit: "kW", required: false },
  ],
  Tariff: [
    { field: "at", label: "Timestamp / effective period", type: "timestamp", required: true },
    { field: "price", label: "Electricity price", type: "number", unit: "per kWh", required: true },
    { field: "currency", label: "Currency", type: "string", required: true },
    { field: "category", label: "Tariff category", type: "string", required: false },
    { field: "period", label: "Peak / off-peak period", type: "string", required: false },
  ],
  "Grid carbon": [
    { field: "at", label: "Timestamp", type: "timestamp", required: true },
    { field: "intensity", label: "Carbon intensity", type: "number", unit: "gCO₂e/kWh", required: true },
    { field: "unit", label: "Unit", type: "string", required: false },
    { field: "region", label: "Geographic region", type: "string", required: false },
    { field: "source", label: "Source", type: "string", required: false },
  ],
};

/** Clearly labelled sample files so the import flow can be demonstrated without real data. */
export const SAMPLE_FILES: { name: string; category: string; content: string }[] = [
  { name: "SAMPLE_charging_sessions.csv", category: "Charging", content:
`sessionID,stationID,userID,connectionTime,disconnectTime,kWhDelivered,doneChargingTime
S-0001,CA-301,U-17,2024-03-04T07:58:00+05:30,2024-03-04T11:20:00+05:30,18.4,2024-03-04T10:41:00+05:30
S-0002,CA-302,,2024-03-04T08:12:00+05:30,2024-03-04T16:05:00+05:30,9.7,2024-03-04T09:55:00+05:30
S-0003,CA-303,U-02,2024-03-04T08:40:00+05:30,2024-03-04T12:00:00+05:30,,2024-03-04T11:10:00+05:30
S-0004,CA-301,U-09,2024-03-04T11:31:00+05:30,2024-03-04T10:02:00+05:30,22.1,
S-0005,CA-305,U-11,2024-03-04T12:05:00+05:30,2024-03-04T17:45:00+05:30,31.6,2024-03-04T15:20:00+05:30
S-0006,CA-306,U-04,not-a-date,2024-03-04T18:10:00+05:30,12.0,` },
  { name: "SAMPLE_battery_cycles.json", category: "Battery", content: JSON.stringify([
    { battery_id: "B0005", cycle: 1, capacity: 1.856, voltage_measured: 4.19, current_measured: -2.01, temperature_measured: 24.3 },
    { battery_id: "B0005", cycle: 50, capacity: 1.752, voltage_measured: 4.19, current_measured: -2.0, temperature_measured: 25.1 },
    { battery_id: "B0005", cycle: 100, capacity: 1.611, voltage_measured: 4.18, current_measured: -2.0, temperature_measured: 26.0 },
    { battery_id: "B0005", cycle: 150, capacity: null, voltage_measured: 4.18, current_measured: -2.0, temperature_measured: 26.4 },
    { battery_id: "B0005", cycle: 168, capacity: 1.325, voltage_measured: 4.17, current_measured: -1.99, temperature_measured: 27.2 },
  ], null, 2) },
  { name: "SAMPLE_solar_hourly.csv", category: "Solar & weather", content:
`YEAR,MO,DY,HR,ALLSKY_SFC_SW_DWN,T2M,WS2M
2024,3,4,6,12.5,21.3,1.8
2024,3,4,9,512.0,26.8,2.1
2024,3,4,12,884.2,31.4,2.6
2024,3,4,15,603.7,32.0,3.0
2024,3,4,18,-999,28.1,2.2` },
];

export const INTERNAL_DATASETS: (EntitySpec & { relation?: string })[] = [
  { id: "fleet", name: "EV Fleet Master", description: "One row per vehicle.", classification: "simulated", fields: [
    { name: "vehicleId", type: "string", required: true, kind: "identifier" }, { name: "vehicleClass", type: "enum", required: true, kind: "config", rule: "Shuttle bus | Service van | Utility cart" },
    { name: "batteryCapacityKWh", type: "number", unit: "kWh", required: true, kind: "config", rule: "> 0" }, { name: "maxChargePowerKW", type: "number", unit: "kW", required: true, kind: "config" },
    { name: "chargeEfficiencyPct", type: "number", unit: "%", required: true, kind: "config", rule: "0–100" }, { name: "priorityClass", type: "enum", required: true, kind: "config" }, { name: "initialSocPct", type: "number", unit: "%", required: true, kind: "simulated", rule: "0–100" }] },
  { id: "trips", name: "Vehicle Trip and Route", description: "Planned trips and energy assumptions.", classification: "not-connected", fields: [
    { name: "tripId", type: "string", required: true, kind: "identifier" }, { name: "vehicleId", type: "string", required: true, kind: "identifier", ref: "fleet.vehicleId" }, { name: "departAt", type: "timestamp", required: true, kind: "config" },
    { name: "routeDistanceKm", type: "number", unit: "km", required: true, kind: "config" }, { name: "consumptionKWhPerKm", type: "number", unit: "kWh/km", required: true, kind: "config" }, { name: "requiredDepartureSocPct", type: "number", unit: "%", required: true, kind: "derived" }] },
  { id: "arrivals", name: "EV Arrival and Departure", description: "Plug-in windows and requested energy.", classification: "simulated", fields: [
    { name: "vehicleId", type: "string", required: true, kind: "identifier", ref: "fleet.vehicleId" }, { name: "arrivalAt", type: "timestamp", required: true, kind: "simulated" }, { name: "expectedDepartureAt", type: "timestamp", required: true, kind: "simulated" },
    { name: "requestedEnergyKWh", type: "number", unit: "kWh", required: true, kind: "derived" }, { name: "availableHours", type: "number", unit: "h", required: true, kind: "derived" }, { name: "urgency", type: "number", required: true, kind: "derived", rule: "0–1" }] },
  { id: "chargers", name: "Charger Configuration", description: "Charger ratings and status.", classification: "simulated", fields: [
    { name: "chargerId", type: "string", required: true, kind: "identifier" }, { name: "type", type: "enum", required: true, kind: "config", rule: "AC | DC" }, { name: "ratedPowerKW", type: "number", unit: "kW", required: true, kind: "config" },
    { name: "connector", type: "string", required: true, kind: "config" }, { name: "status", type: "enum", required: true, kind: "simulated" }] },
  { id: "pv", name: "Solar PV Generation", description: "Irradiance and PV output per timestep.", classification: "simulated", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "irradianceWm2", type: "number", unit: "W/m²", required: false, kind: "measured" }, { name: "ambientC", type: "number", unit: "°C", required: false, kind: "measured" }, { name: "pvKW", type: "number", unit: "kW", required: true, kind: "simulated", rule: "0 ≤ pvKW ≤ capacity" }] },
  { id: "storage", name: "Stationary Battery", description: "Storage state per timestep.", classification: "simulated", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "socPct", type: "number", unit: "%", required: true, kind: "simulated", rule: "reserve ≤ soc ≤ 100" }, { name: "chargeKW", type: "number", unit: "kW", required: true, kind: "simulated" }, { name: "dischargeKW", type: "number", unit: "kW", required: true, kind: "simulated" }] },
  { id: "grid", name: "Grid and Tariff", description: "Import limit and tariff per period.", classification: "demo", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "importLimitKW", type: "number", unit: "kW", required: true, kind: "config" }, { name: "priceINRperKWh", type: "number", unit: "INR/kWh", required: true, kind: "config" }, { name: "period", type: "enum", required: true, kind: "config", rule: "off-peak | standard | peak" }] },
  { id: "carbon", name: "Grid Carbon Intensity", description: "Carbon intensity of grid imports.", classification: "demo", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "intensityG", type: "number", unit: "gCO₂e/kWh", required: true, kind: "config" }, { name: "region", type: "string", required: false, kind: "config" }] },
  { id: "battery-health", name: "Battery Health", description: "Per-vehicle health indicators.", classification: "simulated", fields: [
    { name: "vehicleId", type: "string", required: true, kind: "identifier", ref: "fleet.vehicleId" }, { name: "sohPct", type: "number", unit: "%", required: true, kind: "derived" }, { name: "cycleCount", type: "integer", required: true, kind: "simulated" },
    { name: "depthOfDischargePct", type: "number", unit: "%", required: false, kind: "simulated" }, { name: "temperatureStress", type: "number", required: false, kind: "derived" }, { name: "degradationCostINR", type: "number", unit: "INR", required: false, kind: "derived" }] },
  { id: "maintenance", name: "Predictive Maintenance", description: "Health score and warning level.", classification: "simulated", fields: [
    { name: "assetId", type: "string", required: true, kind: "identifier" }, { name: "healthScore", type: "number", required: true, kind: "derived", rule: "0–100" }, { name: "faultProbability", type: "number", required: false, kind: "predicted", rule: "Not implemented — requires trained model" }, { name: "maintenancePriority", type: "enum", required: true, kind: "derived" }] },
  { id: "faults", name: "Fault Injection", description: "Controlled simulated faults.", classification: "simulated", fields: [
    { name: "faultId", type: "string", required: true, kind: "identifier" }, { name: "assetId", type: "string", required: true, kind: "identifier" }, { name: "type", type: "enum", required: true, kind: "config", rule: "delayed packets | frozen reading | noise | invalid SoC | charger/comm failure" }, { name: "active", type: "boolean", required: true, kind: "config" }] },
  { id: "preferences", name: "Driver Preference", description: "Departure needs and overrides.", classification: "simulated", fields: [
    { name: "vehicleId", type: "string", required: true, kind: "identifier", ref: "fleet.vehicleId" }, { name: "minDepartureSocPct", type: "number", unit: "%", required: true, kind: "config" }, { name: "preferredDepartureAt", type: "timestamp", required: true, kind: "config" }, { name: "priority", type: "enum", required: true, kind: "config" }] },
  { id: "forecast", name: "Forecasting", description: "History, predictions and intervals.", classification: "demo", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "series", type: "enum", required: true, kind: "config", rule: "demand | pv | grid" }, { name: "observed", type: "number", unit: "kW", required: false, kind: "measured" }, { name: "predicted", type: "number", unit: "kW", required: false, kind: "predicted" }, { name: "lower", type: "number", unit: "kW", required: false, kind: "predicted" }, { name: "upper", type: "number", unit: "kW", required: false, kind: "predicted" }, { name: "modelVersion", type: "string", required: true, kind: "config" }] },
  { id: "decisions", name: "Scheduler Decision", description: "Charging assignments.", classification: "simulated", fields: [
    { name: "decisionId", type: "string", required: true, kind: "identifier" }, { name: "vehicleId", type: "string", required: true, kind: "identifier", ref: "fleet.vehicleId" }, { name: "chargerId", type: "string", required: true, kind: "identifier", ref: "chargers.chargerId" }, { name: "startAt", type: "timestamp", required: true, kind: "derived" }, { name: "endAt", type: "timestamp", required: true, kind: "derived" }, { name: "powerKW", type: "number", unit: "kW", required: true, kind: "derived" }, { name: "deadlineRisk", type: "boolean", required: true, kind: "derived" }] },
  { id: "source-selection", name: "Energy-Source Selection", description: "Per-step source contributions.", classification: "simulated", fields: [
    { name: "at", type: "timestamp", required: true, kind: "identifier" }, { name: "pvKW", type: "number", unit: "kW", required: true, kind: "derived" }, { name: "storageKW", type: "number", unit: "kW", required: true, kind: "derived" }, { name: "gridKW", type: "number", unit: "kW", required: true, kind: "derived" }, { name: "costINR", type: "number", unit: "INR", required: true, kind: "derived" }, { name: "carbonKg", type: "number", unit: "kg CO₂e", required: true, kind: "derived" }] },
  { id: "audit", name: "Audit and Explainability", description: "Decision reasons and overrides.", classification: "simulated", fields: [
    { name: "decisionId", type: "string", required: true, kind: "identifier", ref: "decisions.decisionId" }, { name: "reason", type: "string", required: true, kind: "derived" }, { name: "constraints", type: "string", required: true, kind: "derived" }, { name: "fallback", type: "string", required: false, kind: "derived" }, { name: "override", type: "string", required: false, kind: "config" }, { name: "at", type: "timestamp", required: true, kind: "derived" }] },
  { id: "evaluation", name: "Evaluation Results", description: "Metrics per experiment run.", classification: "simulated", fields: [
    { name: "runId", type: "string", required: true, kind: "identifier" }, { name: "costINR", type: "number", unit: "INR", required: true, kind: "derived" }, { name: "delayMin", type: "number", unit: "min", required: true, kind: "derived" }, { name: "departureSuccessPct", type: "number", unit: "%", required: true, kind: "derived" }, { name: "solarSharePct", type: "number", unit: "%", required: true, kind: "derived" }, { name: "emissionsKg", type: "number", unit: "kg CO₂e", required: true, kind: "derived" }, { name: "peakKW", type: "number", unit: "kW", required: true, kind: "derived" }] },
];

export const classificationOf = (id: string): Provenance => INTERNAL_DATASETS.find((d) => d.id === id)?.classification ?? "demo";
