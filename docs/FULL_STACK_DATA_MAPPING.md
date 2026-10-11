# EVOS full-stack data mapping

Audit date: 2026-10-11  
This mapping describes the current frontend contracts and the backend boundary required to integrate them. The frontend now polls the configured backend live-parameters route every 60 seconds and applies a verified solar multiplier to the existing deterministic simulation. Unavailable fields remain on explicitly labelled simulation fallback.

## Role views and editable vehicle registry

The app now exposes a **Manager** workspace for station operations and a **Driver** workspace
at `/app/driver`. The driver view surfaces the selected vehicle's SoC, target, departure,
active/scheduled session, compatible chargers, rate context, and readiness checks.

Fleet records are not capped at the original illustrative count. The Fleet page can add and
remove vehicles from a browser-local registry. `customVehicles` and `removedVehicleIds` are
stored in session storage and passed into scheduler calculations. This registry is intentionally
separate from ACN historical identities; no ACN session is assigned to an EVOS vehicle without a
verified identity mapping.

## Contract conventions

- Canonical units in the existing contracts: kW for power, kWh for energy, percent 0–100 for SoC/SoH, INR for currency, gCO2e/kWh for grid carbon, and ISO-8601 timestamps with explicit timezone.
- Current demo time is a simulated day with 96 15-minute slots. It is not wall-clock telemetry.
- Current provenance is mostly `simulated`, `calculated`, `forecast`, `demo`, or `not-connected`; no backend currently returns source freshness or import records.
- Proposed APIs should return numeric values or `null`, never `"N/A"` in numeric fields, and should include provenance/status metadata.
- Proposed error shape: `{ error: { code: string, message: string, details?: unknown, requestId?: string } }`.

## Current page/component mapping

| Frontend page/component | Current data source/mock | Current request | Proposed backend route/service | Response fields/types | Persistence/computation | Provenance/status | Contract test |
|---|---|---|---|---|---|---|---|
| `Overview` (`src/app/pages1.tsx`) | `useStore().sim`, `alerts` | Store refreshes `/api/v1/live/parameters`; simulation consumes returned solar multiplier | `GET /api/v1/live/parameters?latitude=&longitude=&date=&pvKWp=` | source statuses, normalized solar multiplier, raw source payloads, fallback metadata | live source payloads plus deterministic simulation | current API/modelled/simulated fallback | backend API test; frontend build |
| `Fleet` | `getBackend().vehicles.list(a)` → mock adapter | No network | `GET /api/v1/vehicles` | `VehicleState[]`, pagination, provenance | vehicles + latest telemetry + scheduler result | source status per vehicle | proposed |
| `VehicleDetail` | `useStore().sim`, `sohTrend` | None | `GET /api/v1/vehicles/:id` | vehicle, session, SoC series, SoH trend, flags | vehicle, session, battery snapshots | simulated/imported/calculated | proposed |
| `Scheduler` | `simulate(a)`, `compareStrategies(a)` | None | Current: `POST /api/v1/scheduler/plan`; future: run persistence routes | decisions, assignments, score breakdown, constraints, alternatives, confidence | current route is stateless; persistence future | calculated + algorithm version | API test current; persistence proposed |
| `Energy` / `SystemView` | `SimResult.flows` | None | Current: `POST /api/v1/energy/dispatch`; future: flow history route | source dispatch, storage state, balance error | current route is stateless; ledger future | calculated; source history future | API test current; persistence proposed |
| `Battery` | `sohFor`, `sohTrend` | None | `GET /api/v1/vehicles/:id/battery` | SoC/SoH, wear factors, uncertainty, maintenance flags, RUL nullable | battery snapshots/wear estimates | estimate disclaimer; RUL `null` if insufficient | proposed |
| `Forecasts` | `forecastSeries` profile baseline | None | `GET /api/v1/estimates?kind=demand|pv&runId=` | observed nullable, estimate nullable, lower/upper nullable, method/version | deterministic planning estimate | `modelled`/`simulated`, not ML | proposed |
| `Sustainability` | `SimResult.totals`, `simulateWeek` | None | `GET /api/v1/analytics/sustainability?runId=` | cost, grid kWh, solar share, emissions, peak, utilization, departure success | KPI aggregation from ledger | calculated; null-safe denominators | proposed |
| `Explain` | sessions/rationales from local sim | None | `GET /api/v1/decisions?runId=&vehicleId=` | reason, components, selected source, constraints, alternatives, fallback, override | scheduler decisions/audit events | algorithm/data references | proposed |
| `Maintenance` / `Alerts` | `deriveAlerts(sim)` | None | `GET /api/v1/alerts`, `GET /api/v1/maintenance/indicators` | severity, asset, trigger rule, evidence, status, timestamps | alerts, maintenance indicators | simulated/imported/calculated | proposed |
| `Scenarios` | local `simulate({...a,...draft})` | None | `POST /api/v1/scenarios/runs` | scenario metadata, seed, baseline/result metrics, changed inputs | isolated scenario snapshot/result | simulated; never mutates live state | proposed |
| `Experiments` | local `simulate` for each strategy | None | `POST /api/v1/evaluations` | B1/B2/EVOS metrics under same initial state | evaluation/scenario records | measured simulation outputs | proposed |
| `Datasets` | `EXTERNAL_SOURCES`, browser importer | Source status remains catalogue-driven; live status is available from `/api/v1/live/parameters` | `GET /api/v1/sources`, `GET /api/v1/live/parameters` | source registry/status, source payload status, fallback metadata | source connector results; imports remain browser-only | connected/current_api/modelled/unconfigured/unavailable/simulated | backend connector/API tests |
| `Settings` | sessionStorage assumptions | None | `GET/PUT /api/v1/configuration` | validated editable assumptions and version | configuration record | config/source references | proposed |
| `Methodology` | static UI copy | None | No API required initially | N/A | documentation | N/A | documentation check |

## Existing service interfaces

`src/services/index.ts` defines these future interfaces:

- `VehicleService.list(a)`
- `ChargingSessionService.schedule(a)`
- `BatteryHealthService.trend(vehicleId, a)` and `rulEstimate(id)`
- `EnergyService.flows(a)`
- `ForecastingService.series(a, kind)` and `validationMetrics()`
- `SchedulerService.compare(a)`
- `FaultMonitoringService.alerts(a)`
- `DatasetService.sources()`
- `SimulationService.run(a)`

Most service methods still resolve through `mockAdapter`, but the store now calls the backend live-parameters route when `VITE_BACKEND_URL` is configured. This integration changes simulation solar input only; fleet/session/analytics pages still use the existing deterministic model until their response contracts are fully normalized.

## Proposed backend domain mapping

| Logical entity | Current in-memory representation | Proposed persistence | Required constraints/indexes |
|---|---|---|---|
| Vehicle | `VehicleSpec`, `VehicleState` | `vehicles` | stable ID, valid class, capacity/power/SOC bounds |
| Charger | `CHARGERS` | `chargers` | unique ID, type/rating, compatibility |
| Trip/departure | vehicle arrival/departure/target fields | `trip_requests` | vehicle FK, timezone-aware departure, status |
| Telemetry | fault flags only | `telemetry_readings` | asset/time index, quality, source, duplicate key |
| Charging session | `Session` | `charging_sessions` | unique assignment intervals, vehicle/charger FKs |
| Battery snapshot | `sohFor`/trend output | `battery_snapshots`, `battery_wear_events` | SoC/SoH bounds, source/provenance |
| Stationary battery | `StepFlow.storageSoC` | `stationary_storage`, `storage_state_history` | reserve/capacity/power bounds |
| Solar | `pvAt` output | `solar_observations` | source/effective/fetched timestamps, units |
| Tariff | `tariffAt` | `tariff_records` | region/category/effective period |
| Grid carbon | `Assumptions.carbonG` | `grid_carbon_records` | factor type, geography, effective date |
| Energy allocation | `StepFlow` | `energy_source_allocations` | nonnegative source power and balance tolerance |
| Scheduler decision | `Session.score`, rationale | `scheduler_decisions` | algorithm version, explanation, constraints |
| Alert | `AlertItem` | `alerts` | severity, asset, trigger, acknowledgement |
| Maintenance | `sohFlag` | `maintenance_indicators` | rule/evidence/severity/timestamp |
| Scenario | local `draft` and result | `scenario_runs`, `scenario_results` | immutable initial snapshot, seed/config |
| Source registry | `EXTERNAL_SOURCES` | `data_sources`, `source_fetch_logs` | status, provenance, safe error |
| Override/audit | session-local `overrides` | `operator_overrides`, `audit_events` | actor if available, before/after/reason |
| Simulation run | `SimResult` | `simulation_runs` | status, algorithm version, config snapshot |

## Request/response and state rules

1. Store real timestamps in UTC with source timezone/effective-period metadata. Keep simulated slot time separate from wall-clock timestamps.
2. Every normalized external value carries source/category, external ID where available, observed/effective time, fetched/imported time, unit, status, version/reference, validation state, and transformation notes.
3. `POST /api/v1/scheduler/runs`, `POST /api/v1/scenarios/runs`, and `POST /api/v1/evaluations` should be stateless request-triggered operations from the runtime perspective: persist a run, compute bounded work, persist results, return the run ID/result. Do not depend on a process that stays alive.
4. Sensitive imports, reset operations, and configuration writes require authentication/authorization if the selected provider supports it. No fake authentication should be added solely to make a checklist green.
5. Source status values should be machine-readable: `connected`, `cached`, `imported`, `stale`, `unconfigured`, `unavailable`, or `simulated`.

## Frontend preservation boundary

The operational calculations remain explicitly deterministic where no validated telemetry exists,
but live source parameters are fetched through `src/services/index.ts`. Role views and the local
vehicle registry are frontend state features; they do not claim physical charger control or
verified ACN-to-vehicle identity mapping.

## Mapping acceptance criteria

- Every backend response used by a future adapter has explicit field types, units, timestamps, and provenance.
- Numeric chart values are numbers or `null`, not display strings.
- Missing credentials produce `unconfigured`/`unavailable` status while the demo remains runnable.
- A scenario never mutates the live/default state.
- Scheduler decisions include score components, source mix, hard-constraint results, explanation, confidence/data-quality state, fallback state, and algorithm version.
- API contract tests cover successful, empty, stale, malformed, and error responses for each integrated service.
