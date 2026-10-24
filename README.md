# EVOS — Electric Vehicles Operations & Sustainability

<p align="center">
  <img src="src/assets/evos-logo.jpg" alt="EVOS logo" width="360" />
</p>

<p align="center">
  <strong>A role-based prototype for EV fleet charging, station operation, energy management, and sustainability analysis.</strong>
</p>

<p align="center">
  <a href="https://github.com/sarfarajmulla-data/DesignEVOS/actions"><img alt="CI" src="https://img.shields.io/badge/CI-local%20validation-informational" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="TypeScript 5.7" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-ESM-339933?logo=node.js&logoColor=white" />
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
</p>

> **Prototype status.** EVOS combines verified external dataset responses with a deterministic operational model. NASA POWER and PVGIS can provide live API-backed solar inputs. ACN-Data provides historical charging-session records when the server-side credential is configured. Fleet operations, charger states, telemetry, scheduler outputs, and energy dispatch remain modelled unless a validated telemetry or control integration is added.

## Contents

1. [Product overview](#product-overview)
2. [User roles](#user-roles)
3. [What is live and what is modelled](#what-is-live-and-what-is-modelled)
4. [Feature map](#feature-map)
5. [Data sources and provenance](#data-sources-and-provenance)
6. [Architecture](#architecture)
7. [Technology stack](#technology-stack)
8. [Quick start](#quick-start)
9. [One-command local deployment](#one-command-local-deployment)
10. [Configuration](#configuration)
11. [Backend API](#backend-api)
12. [Frontend routes](#frontend-routes)
13. [Vehicle registry](#vehicle-registry)
14. [Scheduling and energy model](#scheduling-and-energy-model)
15. [ACN mapping contract](#acn-mapping-contract)
16. [Testing and validation](#testing-and-validation)
17. [Project structure](#project-structure)
18. [Security and secret handling](#security-and-secret-handling)
19. [Known limitations](#known-limitations)
20. [Troubleshooting](#troubleshooting)
21. [Contributing](#contributing)
22. [License](#license)

## Product overview

EVOS is an interactive software prototype for an electric-vehicle depot or charging site. It brings
the following decisions into one workspace:

- vehicle readiness before departure;
- charger allocation and charging-session scheduling;
- site grid limits, solar generation, storage reserve, and energy dispatch;
- tariff and carbon assumptions;
- battery state-of-health estimates and uncertainty;
- explainable scheduler decisions;
- alerts, maintenance scenarios, and what-if analysis;
- dataset provenance and source-quality evidence.

The public website is a product introduction. The `/app/*` workspace is the interactive operations
console. Routing is hash-based, so the application works on static hosting without rewrite rules:

```text
http://localhost:8443/#/app/overview
```

## User roles

### EV fleet manager

Open **EV fleet manager** from the landing page or go to:

```text
/#/app/overview
```

The manager workspace is designed for station operators and fleet teams. It includes:

- readiness and departure risk;
- active charging sessions and queue;
- charger availability and faults;
- schedule strategy comparison;
- solar, storage, grid, cost, and carbon views;
- fleet search, filtering, sorting, add, and remove actions;
- battery health and maintenance indicators;
- scenario and experiment tools;
- dataset status and ACN mapping evidence.

### Driver

Open **Driver view** from the landing page or go to:

```text
/#/app/driver
```

The driver workspace focuses on information needed before and during charging:

- selected vehicle and current SoC;
- target SoC and projected completion;
- charging session, charger, power, and time window;
- departure readiness;
- tariff context;
- available and occupied chargers;
- source context and data-quality limitations.

The driver view is read-only with respect to charger control. It does not start, stop, or remotely
control physical charging equipment.

## What is live and what is modelled

EVOS deliberately labels provenance instead of presenting every number as telemetry.

| Area | Current behavior | Provenance |
|---|---|---|
| ACN-Data | Server fetch of historical charging sessions when `ACN_DATA_API_KEY` exists | `current_api`; historical, not physical real-time |
| NASA POWER | Server fetch of solar/weather point data; historical fallback year can be selected when the requested future date has no observations | `current_api` |
| PVGIS | Server fetch of modelled PV time series; supported historical year fallback is explicit | `modelled_api` |
| Solar multiplier | Derived from usable NASA POWER or PVGIS observations | calculated from source response |
| Tariff | Environment-configured only; otherwise deterministic assumption | configured or simulation fallback |
| Grid carbon | Environment-configured only; otherwise deterministic assumption | configured or simulation fallback |
| Fleet vehicles | Registry combines built-in illustrative vehicles and browser-local custom vehicles | simulated/configured |
| Chargers | Built-in charger configuration and deterministic status model | simulated |
| Vehicle SoC / telemetry | Deterministic operational model | simulated |
| Scheduler | Deterministic, explainable calculation using current registry and assumptions | calculated |
| Energy dispatch | Deterministic solar/storage/grid balancing | calculated |
| Realtime endpoint/SSE | Repeating simulated snapshots | simulated |
| Physical hardware | No MQTT, OCPP, charger actuation, or physical meter integration | unavailable |

The Datasets page contains **ACN-Data mapping evidence**. It only displays ACN as usable when the
backend has actually returned a valid response. It shows status, provenance, fetched time, record
count, delivered energy, station count, and the identity-mapping limitation.

## Feature map

### Operations

- **Overview** — fleet readiness, active sessions, queue, energy mix, cost, and alerts.
- **Fleet** — dynamic vehicle registry, search, filters, sorting, vehicle details, and constraints.
- **Scheduler** — FCFS, rule-based, and EVOS weighted scheduling strategies.
- **Energy** — site load, PV, storage, grid imports, tariff bands, and reserve.
- **System View** — energy-flow schematic across grid, PV, storage, and chargers.

### Analysis

- **Battery Health** — estimated SoH, uncertainty, wear factors, and trends.
- **Forecasts** — profile-based demand and solar forecasts with ranges.
- **Sustainability** — cost, emissions, renewable share, and baseline comparison.
- **Explainability** — priority score components, constraints, alternatives, and rationale.
- **Maintenance & Faults** — controlled data-quality and charger-fault scenarios.

### Planning and governance

- **Scenarios** — isolated what-if runs.
- **Experiments** — strategy comparison under the same assumptions.
- **Alerts** — derived operational alerts and acknowledgement.
- **Datasets & Sources** — external source status, ACN evidence, imports, and contracts.
- **Configuration** — site assumptions, grid limits, PV/storage values, tariffs, and carbon factors.
- **Methodology** — model definitions, formulas, assumptions, and limitations.

## Data sources and provenance

### ACN-Data

The backend calls the ACN-Data API server-side using Basic authentication with the token as the
username and an empty password. The browser never receives the credential.

The normalized ACN baseline includes:

- source record count;
- total delivered energy;
- average session energy;
- station/EVSE count;
- observed source period;
- explicit identity mapping status.

ACN is historical charging-session data. It is not physical real-time charger telemetry. EVOS does
not assign ACN users, stations, or session IDs to `BUS-01`, `VAN-01`, `CRT-01`, or custom vehicles
without a verified identity policy.

### NASA POWER

The backend uses the temporal hourly point endpoint for solar irradiance and temperature. Valid
observations can derive a normalized solar multiplier used by the operational model. If a requested
future date contains only fill values, the backend tries supported prior dates and reports the
effective source date.

### PVGIS

The backend uses the PVGIS v5.3 `seriescalc` JSON endpoint. PVGIS is a modelled/historical solar
estimate, not live PV meter telemetry. If the requested year is unavailable, the backend tries
supported historical years and reports the effective year.

### Removed sources

ElaadNL and Pecan Street are intentionally excluded from the active catalogue and integration plan.

## Architecture

```text
Browser
  ├── Public landing site (/)
  └── React operations workspace (/#/app/*)
       ├── Role views: Manager and Driver
       ├── React context store
       ├── Deterministic scheduling/energy model
       ├── Browser-local vehicle registry
       └── Live parameters client
              │
              ▼
        Node HTTP backend (:8787)
          ├── Deterministic calculation engine
          ├── ACN-Data connector
          ├── NASA POWER connector
          ├── PVGIS connector
          ├── In-memory TTL cache
          └── Explicit provenance/fallback metadata
```

The backend is stateless and dependency-free. It does not currently provide persistent database
storage, authentication, authorization, charger control, or a telemetry broker.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5.7 |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 through `@tailwindcss/vite` |
| Icons | `lucide-react` |
| Charts | Custom SVG components |
| Routing | Hash router with optional View Transitions |
| State | React context + browser `sessionStorage` |
| Backend | Node.js ESM + built-in `http` module |
| External data | ACN-Data, NASA POWER, PVGIS |
| Tests | Node built-in test runner + TypeScript check + Vite build |
| Package manager | pnpm |

## Quick start

### Prerequisites

- Node.js 22 or newer;
- pnpm;
- Git.

### Install

```bash
git clone https://github.com/sarfarajmulla-data/DesignEVOS.git
cd DesignEVOS
pnpm install
```

### Frontend only

```bash
pnpm run dev -- --host 0.0.0.0 --port 8443
```

Open <http://localhost:8443/>.

### Backend only

```bash
node backend/server.mjs
```

The backend listens on <http://localhost:8787/>.

## One-command local deployment

For Windows, use the repository launcher:

```text
run-local.bat
```

It:

1. changes to the repository directory;
2. starts or reuses the backend on port `8787`;
3. starts or reuses Vite on port `8443`;
4. applies local CORS and frontend API settings;
5. waits for both HTTP services;
6. opens the frontend automatically.

Local URLs:

- Website: <http://localhost:8443/>
- Backend health: <http://localhost:8787/api/v1/health>
- Live parameters: <http://localhost:8787/api/v1/live/parameters>

The launcher expects a local ignored file at `backend/.env` for server-only credentials. Copy the
shape from `backend/.env.example`; never commit the real file.

## Configuration

### Frontend `.env.local`

```dotenv
VITE_BACKEND_URL=http://localhost:8787
VITE_SITE_LATITUDE=28.6139
VITE_SITE_LONGITUDE=77.209
```

`VITE_*` values are shipped to the browser. They must contain only public configuration.

### Backend environment

```dotenv
ACN_DATA_API_KEY=replace_me_locally
ACN_DATA_BASE_URL=https://ev.caltech.edu/api/v1
NASA_POWER_BASE_URL=https://power.larc.nasa.gov/api/temporal
PVGIS_BASE_URL=https://re.jrc.ec.europa.eu/api/v5_3
CORS_ORIGINS=http://localhost:8443,http://127.0.0.1:8443
PORT=8787
DEFAULT_TARIFF_INR=
GRID_CARBON_G_PER_KWH=
TARIFF_PROFILE_JSON=
CARBON_PROFILE_JSON=
```

Run the backend with Node's environment-file support:

```bash
node --env-file=backend/.env backend/server.mjs
```

### Optional tariff and carbon profiles

Tariff and carbon inputs are only treated as configured when supplied by the server environment.
Otherwise the API returns explicit fallback metadata and the UI retains the deterministic
assumption. Do not insert undocumented rates or universal carbon factors.

## Backend API

All routes are under `/api/v1`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Runtime and persistence status |
| `GET` | `/realtime` | Explicitly simulated realtime snapshot |
| `GET` | `/stream` | Server-Sent simulated snapshots |
| `GET` | `/live/parameters` | Aggregated ACN, NASA POWER, PVGIS, tariff, carbon, and fallback metadata |
| `GET` | `/vehicles` | Demo vehicle records and provenance |
| `GET` | `/chargers` | Demo charger records and provenance |
| `GET` | `/sources` | Connector/source status |
| `POST` | `/sources/acn/sessions` | Request ACN historical sessions |
| `POST` | `/sources/nasa-power/point` | Request NASA POWER point data |
| `POST` | `/sources/pvgis/series` | Request PVGIS series data |
| `POST` | `/scheduler/plan` | Calculate a charger allocation plan |
| `POST` | `/energy/dispatch` | Calculate energy dispatch |
| `POST` | `/scenarios/run` | Execute an isolated scenario |
| `GET` | `/analytics/summary` | Summarize deterministic operational outputs |

### Live parameters request

```text
GET /api/v1/live/parameters?latitude=28.6139&longitude=77.209&date=20261011&pvKWp=100
```

The response includes:

- `parameters.solarMult`;
- `parameters.acnSessionData`;
- `parameters.acnHistoricalBaseline`;
- `parameters.nasaPowerData`;
- `parameters.pvgisData`;
- `sources[]` with `status`, `provenance`, `usable`, `fetchedAt`, cache, and limitation fields;
- `fallback` metadata for unavailable tariff, carbon, or solar inputs.

### Source status meanings

| Status/provenance | Meaning |
|---|---|
| `connected` | The upstream request returned successfully |
| `usable: true` | The response contains validated usable records |
| `current_api` | Data came from a current API request |
| `modelled_api` | Data came from a modelled source such as PVGIS |
| `unconfigured` | Required server configuration is missing |
| `unavailable` | The request failed or returned no usable data |
| `simulated` | Generated by the deterministic EVOS model |
| `cached` | Served from process-local TTL cache metadata |

## Frontend routes

The frontend uses hash routes:

| Route | View |
|---|---|
| `/#/` | Public landing site |
| `/#/app/overview` | Fleet manager overview |
| `/#/app/fleet` | Fleet registry |
| `/#/app/fleet/:vehicleId` | Vehicle detail |
| `/#/app/driver` | Driver workspace |
| `/#/app/scheduler` | Charging scheduler |
| `/#/app/energy` | Energy manager |
| `/#/app/system` | Site energy schematic |
| `/#/app/battery` | Battery health |
| `/#/app/forecasts` | Forecasts |
| `/#/app/sustainability` | Sustainability analytics |
| `/#/app/explain` | Explainability |
| `/#/app/maintenance` | Maintenance and faults |
| `/#/app/scenarios` | Scenario simulator |
| `/#/app/experiments` | Strategy experiments |
| `/#/app/alerts` | Alerts |
| `/#/app/datasets` | Sources, ACN evidence, and import workflow |
| `/#/app/settings` | Configuration |
| `/#/app/methodology` | Methodology |

## Vehicle registry

The original illustrative fleet is a starting registry, not a hard limit.

The Fleet page supports:

- adding a vehicle ID, class, battery size, maximum charge power, current SoC, target SoC, and departure;
- removing a vehicle from the active registry;
- filtering and sorting the active registry;
- using the updated registry in scheduler calculations;
- persisting the registry changes for the browser session.

The store persists:

```text
customVehicles
removedVehicleIds
```

This is browser-local prototype state. It is not a persistent multi-user fleet database. A future
production implementation should move vehicle CRUD to authenticated backend endpoints with audit
events, validation, ownership, and database persistence.

## Scheduling and energy model

The deterministic engine uses 15-minute steps across a 24-hour operating day.

### Scheduling inputs

- current SoC and target SoC;
- battery capacity;
- arrival and departure windows;
- vehicle class and charger compatibility;
- maximum vehicle and charger power;
- site grid limit;
- solar capacity and multiplier;
- storage capacity, power, and reserve;
- strategy and operator overrides.

### Strategies

1. **FCFS** — first compatible charger in arrival order; grid-limit exceedances are flagged.
2. **Rule-based** — priority and earliest departure within the site cap.
3. **EVOS weighted heuristic** — urgency, deficit, slack, class weight, and operator priority.

### Energy dispatch order

1. solar serves site load;
2. excess solar charges storage;
3. storage discharges subject to reserve and configured power;
4. the grid supplies the remaining deficit;
5. cost, emissions, peak import, renewable share, and unserved energy are calculated.

Every scheduler decision includes a rationale, constraints, selected charger, alternatives, rank,
priority score components, and late/departure-risk state.

## ACN mapping contract

ACN source fields are normalized as historical source records:

| ACN concept | EVOS normalized output |
|---|---|
| Session identifier | historical session identity |
| Station/EVSE identifier | station count and station-level baseline |
| Connection/disconnection timestamps | source period and session duration context |
| Delivered energy | total and average delivered kWh |
| Optional user/vehicle fields | retained in raw source payload where available |

The safe mapping boundary is:

```text
ACN historical sessions → charging-behaviour baseline
EVOS vehicle registry   → operational simulation and planning
```

The application intentionally does **not** perform:

```text
ACN session/user/station ID → BUS-01/VAN-01/CRT-01
```

That assignment would fabricate identity. A legitimate identity mapping policy and identifiers
would be required before joining the two datasets.

## Testing and validation

Run the complete validation set:

```bash
node --test backend/tests/*.test.mjs
pnpm exec tsc --noEmit -p .
pnpm run build
```

The backend test suite covers:

- health and API route behavior;
- malformed request handling;
- scheduler and dispatch calculations;
- scenario isolation;
- source connector authentication boundaries;
- missing ACN credential behavior;
- ACN normalization;
- NASA POWER and PVGIS response validation;
- storage reserve and energy balance;
- priority, charger uniqueness, wear, SoH, confidence, and fallback behavior.

## Project structure

```text
.
├── backend/
│   ├── server.mjs                 # Node HTTP API
│   ├── connectors/sources.mjs     # ACN, NASA POWER, PVGIS connectors
│   ├── core/engine.mjs            # Scheduling, energy, battery, fallback logic
│   ├── core/cache.mjs             # Process-local TTL cache
│   ├── core/demo-data.mjs         # Explicit demo vehicles, chargers, sources
│   ├── tests/                     # API, connector, and engine tests
│   ├── .env.example               # Server configuration template
│   └── README.md                  # Backend-specific notes
├── docs/
│   ├── ALGORITHMS_AND_FORMULAS.md
│   ├── DATA_SOURCES.md
│   ├── DEPLOYMENT.md
│   ├── FULL_STACK_DATA_MAPPING.md
│   └── REPOSITORY_AUDIT.md
├── public/                        # Static public assets
├── src/
│   ├── App.tsx                    # Application shell and titles
│   ├── index.css                  # Tailwind theme and motion system
│   ├── site/Site.tsx              # Public website and role entry points
│   ├── app/AppRoutes.tsx          # Workspace route table
│   ├── app/Shell.tsx              # Manager/driver navigation shell
│   ├── app/driver.tsx             # Driver workspace
│   ├── app/pages1.tsx             # Overview, fleet, scheduler, energy
│   ├── app/pages2.tsx             # Battery, forecasts, sustainability, explainability
│   ├── app/pages3.tsx             # Scenarios, system, alerts, settings, methodology
│   ├── app/pages4.tsx             # Datasets, source evidence, imports, contracts
│   ├── app/pages5.tsx             # Maintenance and experiments
│   ├── components/                # UI, charts, energy schematic, error boundary
│   ├── data/                      # Catalogue and data contracts
│   ├── lib/sim.ts                 # Deterministic simulation
│   ├── lib/store.tsx              # State, live polling, vehicle registry
│   └── services/index.ts           # Backend/live-data boundary
├── run-local.bat                  # Windows one-command launcher
├── .env.example                   # Frontend public configuration template
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vite.config.ts
```

## Security and secret handling

- Never put `ACN_DATA_API_KEY` in `VITE_*`, frontend source, browser storage, Git, screenshots,
  logs, or API responses.
- Keep `backend/.env` local and ignored.
- Rotate any credential that has been pasted into an untrusted channel.
- Restrict `CORS_ORIGINS` to known frontend origins.
- The current prototype has no authentication or authorization; do not expose it publicly with
  production credentials.
- The current API is stateless and has no persistent audit log.
- Do not interpret the simulated SSE stream as physical telemetry.

## Vercel deployment

The current production deployment is available at:

<https://evos-black.vercel.app>

The Vercel deployment includes the Vite frontend and a serverless-compatible backend handler. The
production API is available under the same origin:

```text
https://evos-black.vercel.app/api/v1/health
https://evos-black.vercel.app/api/v1/live/parameters
```

The ACN credential is configured as a Vercel production secret and is never exposed to the browser.
Frontend `VITE_BACKEND_URL` points to the same deployment origin. Redeploy after changing any
production environment variable.

## Known limitations

1. ACN-Data is historical, not physical real-time telemetry.
2. ACN records are not joined to EVOS vehicle identities.
3. Fleet CRUD is browser-session state, not persistent backend state.
4. Fleet, charger, telemetry, scheduler, and energy operations remain modelled/calculated.
5. No OCPP, MQTT, WebSocket telemetry, smart-meter, inverter, or charger-control integration exists.
6. Tariff and grid-carbon values need verified server-side source configuration.
7. Backend cache is process-local and disappears on restart.
8. No user login, role authorization, multi-tenant isolation, or database exists.
9. Browser imports are validated locally and are not persisted.
10. Forecasts and battery health are deterministic estimates, not trained production models.
11. Vercel deployment still has no authentication, authorization, persistent database, or physical
    telemetry/control integration.

## Troubleshooting

### The page says “Backend unavailable”

1. Start the backend:

   ```bash
   node --env-file=backend/.env backend/server.mjs
   ```

2. Check <http://localhost:8787/api/v1/health>.
3. Confirm `VITE_BACKEND_URL=http://localhost:8787`.
4. Restart Vite after changing `.env.local`.

### ACN says “unconfigured”

Confirm that `backend/.env` contains a valid server-side `ACN_DATA_API_KEY`, then restart the
backend. The key must not be placed in `.env.local` or any `VITE_*` variable.

### ACN is connected but the fleet does not change

This is expected. ACN is used as a historical charging-behaviour baseline. It is not assigned to
the operational EVOS vehicle registry without a verified identity mapping.

### NASA POWER shows a different effective date

The requested future date may contain fill values. EVOS can use a supported historical date and
reports the effective date in source metadata instead of silently treating fill values as real.

### PVGIS is modelled rather than live

PVGIS is a solar-performance model/historical source. It is useful for PV estimation and
cross-validation, not for physical inverter telemetry.

## Contributing

1. Create a branch:

   ```bash
   git checkout -b feature/your-change
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Make a focused change following existing component, provenance, and error-handling patterns.
4. Run:

   ```bash
   node --test backend/tests/*.test.mjs
   pnpm exec tsc --noEmit -p .
   pnpm run build
   ```

5. Do not commit `.env`, `.env.local`, credentials, generated logs, or `.idea/`.
6. Document any change to source provenance or simulation semantics.

## License

No license has been selected yet. Until a `LICENSE` file is added, all rights are reserved by
the authors.
