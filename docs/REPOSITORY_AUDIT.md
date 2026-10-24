# EVOS repository audit

Audit date: 2026-10-11  
Repository: `DesignEVOS`  
Scope of this phase: read-only inspection followed by provider-neutral backend implementation. No frontend files were changed.

## Executive summary

EVOS is currently a React 19 + TypeScript + Vite 8 single-page demo. The application is a deterministic, in-browser simulation. React context state and `src/lib/sim.ts` are the authoritative runtime; no browser request reaches a backend. A Supabase Edge Function scaffold exists, but it only exposes a generic health route and a KV helper and is not connected to the UI. There is no domain schema, migration, persistent simulation state, external-source adapter, API contract implementation, backend test suite, or deployment configuration for a backend.

The existing frontend is healthy enough to preserve: `pnpm exec tsc --noEmit -p .` and `pnpm run build` both passed on the audit date. Backend work can be added behind the existing service boundary, but wiring it into `src/services/index.ts` would be a frontend-file change and therefore requires explicit approval.

## Current stack and run commands

| Area | Evidence | Current state |
|---|---|---|
| UI | `src/main.tsx`, `src/App.tsx`, `src/app/*` | React 19 + TypeScript |
| Build | `package.json`, `vite.config.ts` | Vite 8, Tailwind CSS 4, Figma Make plugins |
| Routing | `src/lib/router.tsx`, `src/app/AppRoutes.tsx` | Hash-based client routing |
| State | `src/lib/store.tsx` | React context; sessionStorage only |
| Simulation | `src/lib/sim.ts` | Deterministic 96-slot, 15-minute demo model |
| Data access | `src/services/index.ts` | Demo adapter only; future interfaces |
| Server scaffold | `supabase/functions/server/index.tsx` | Deno/Hono health route only |
| Database | `supabase/functions/server/kv_store.tsx` | Generic Supabase KV table helper; no EVOS schema/migrations |
| External data | `src/data/catalog.ts`, `src/lib/importer.ts` | Catalogue and browser-only preview importer; no network adapters |
| Tests | `backend/tests/*.test.mjs` | Node built-in tests for engine and API |
| Deployment | `vite.config.ts`, README | Static Vite build is deployable in principle; backend deployment is unverified |

Local commands documented by the repository:

```text
pnpm install
pnpm dev
pnpm exec tsc --noEmit -p .
pnpm run build
pnpm preview
pnpm format
```

Observed audit results:

| Check | Result |
|---|---|
| TypeScript | Passed (`tsc` exit 0) |
| Production build | Passed (`vite build` exit 0) |
| Backend tests | Passed: 10 tests with Node built-in test runner |
| Cloud deployment | Not run; no deployment evidence in the repository |

## Current architecture and data flow

```text
Browser
  └─ Vite static bundle
      ├─ hash router → React pages
      ├─ StoreProvider → assumptions, overrides, faults, acknowledgements
      ├─ simulate(assumptions) → vehicles, sessions, 15-minute flows, totals, alerts
      ├─ local service interfaces → mockAdapter → same deterministic simulation
      └─ browser importer → parse/map/validate preview only

Supabase scaffold (currently disconnected)
  └─ Deno Hono /make-server-980ab5fb/health
      └─ generic kv_store_980ab5fb table helper
```

The frontend reads `simulate(a)` directly in most pages. `Fleet` is the clearest service-boundary consumer: it calls `getBackend().vehicles.list(a)`, but `getBackend()` always returns `mockAdapter`. The same pattern exists for sessions, energy, forecasting, scheduler, faults, datasets, and simulation services.

## Existing frontend routes

The route table in `src/app/AppRoutes.tsx` currently exposes:

`/app/overview`, `/app/fleet`, `/app/fleet/:vehicleId`, `/app/scheduler`, `/app/energy`, `/app/battery`, `/app/forecasts`, `/app/sustainability`, `/app/explain`, `/app/maintenance`, `/app/scenarios`, `/app/experiments`, `/app/system`, `/app/alerts`, `/app/datasets`, `/app/settings`, and `/app/methodology`.

The public landing site is `/`. The complete component-to-service mapping is in `FULL_STACK_DATA_MAPPING.md`.

## Existing implementation coverage

### Implemented in the browser demo

- 20 illustrative vehicles, six chargers, PV, stationary storage, grid tariff and carbon assumptions.
- 15-minute, 96-slot deterministic simulation.
- Three displayed strategies: FCFS, earliest-deadline rules, and an EVOS-labelled weighted heuristic.
- Charger compatibility filtering and unique charger allocation within a simulation run.
- Simulated charger fault, frozen SoC, and invalid SoC fault scenarios.
- Solar → storage/grid energy dispatch and illustrative cost/emissions totals.
- Scenario comparison, strategy comparison, alerts, source catalogue, and browser file parsing/validation.
- Provenance labels and explicit “simulated/demo/not connected” language in many views.

### Missing or incomplete backend capabilities

- The frontend now consumes `GET /api/v1/live/parameters` when `VITE_BACKEND_URL` is configured; the backend also exposes health, fleet/charger/source status, scheduler planning, energy dispatch, scenarios, analytics, and realtime routes.
- No persistent EVOS domain database or migrations.
- No transaction boundary for simulation runs, scheduler decisions, energy ledgers, alerts, imports, or audit events.
- No server-side validation, pagination, common error schema, CORS allowlist, rate limiting, or admin protection.
- No real ACN-Data, NASA POWER, PVGIS, NASA battery-file, tariff, or CEA carbon adapter.
- No server-side cache/fetch/import status registry.
- No reproducible persisted scenario runs or baseline result records.
- No telemetry ingestion, stale-data policy, last-valid-value window, quarantine, or duplicate/out-of-order handling on the server.
- No deterministic decision audit record or operator override record in storage.
- No confidence calculation matching the master prompt.
- No documented RUL implementation; the UI correctly displays it as not implemented.
- No persistence/import/scenario acceptance suite yet; the provider-neutral engine/API suite is implemented.
- No verified Vercel backend runtime configuration.

## Formula and algorithm discrepancies

The current browser simulator is explicitly illustrative and does not yet implement the authoritative master formulas exactly:

| Requirement | Current code | Audit finding |
|---|---|---|
| Energy need | `src/lib/sim.ts` divides by `CHARGE_EFF` | Uses a wall-side energy convention, but the boundary is not formalized as required |
| Normalized shortfall `N` | Current `deficit` field | Similar concept, but the documented score is not used exactly |
| Urgency `U` | `hoursNeeded / hoursLeft` | Differs from `1 - clamp(slack_minutes / 240, 0, 1)` |
| Class weight `K` | Bus 1, van 0.7, cart 0.4 | Differs from Critical 1.0, Normal 0.6, Low 0.3 |
| Waiting factor `W` | Not represented in the current score | Missing |
| Stress score `S` | Not represented in the current score | Missing |
| Priority formula | `0.45/0.20/0.20/0.15` plus an operator offset | Must be replaced or versioned in backend implementation |
| Negative slack | Late sessions are flagged | Must explicitly elevate scheduling urgency while retaining physical constraints |
| SOH | cycles, age, fast-share heuristic | Differs from the documented DoD/temperature/C-rate/calendar wear model |
| Confidence | Not calculated | Missing |
| Sustainability denominators | Some UI calculations divide directly | Backend must return `null` for zero denominators |
| FCFS | Deliberately ignores site cap and flags exceedance | This is the existing demo behavior; the required baseline must be defined explicitly and tested |

These discrepancies are not silently changed in this audit. The backend design must use a versioned, documented algorithm implementation and preserve the demo path until an approved integration decision is made.

## Data sources and provenance

The current catalogue contains ACN-Data, NASA POWER, PVGIS, NASA battery data, and placeholder tariff/carbon entries. ElaadNL and Pecan Street are excluded from the active catalogue.

Current access status:

| Source | Current repository status | Required treatment |
|---|---|---|
| ACN-Data | Catalogue only; no credential or connector | Server-side adapter; unconfigured without a private environment value |
| NASA POWER | Catalogue/import hints only | Verify official variables, units, time coverage, then server adapter |
| PVGIS | Server connector | Uses the verified v5.3 `seriescalc` request/response |
| NASA Li-ion | Browser sample/import preview only | Server/offline file import after actual files/schema are supplied |
| Indian tariffs | Placeholder source with no URL/data | Select and verify official material; no invented rates |
| Indian grid carbon | Placeholder source with no URL/data | Select and verify official CEA material/methodology |
| ElaadNL/Pecan Street | Removed from frontend catalogue | Excluded from the active integration surface |

NASA POWER and PVGIS now return live API-backed source responses through the backend when the
requested period is available. ACN remains unconfigured until `ACN_DATA_API_KEY` is supplied.
The sample files in `src/data/catalog.ts` are visibly labelled sample/demo content and are not
real source observations.

## Database and persistence audit

The only database-related code is the generated Supabase KV helper for `kv_store_980ab5fb`. It uses `SUPABASE_SERVICE_ROLE_KEY` server-side, which is appropriate for the helper boundary, but the surrounding server has no authentication/authorization and currently enables wildcard CORS. No SQL migration directory, schema versioning, foreign keys for EVOS entities, indexes, import deduplication keys, or transaction workflow exists.

The repository includes a Supabase project ID and masked public key in `utils/supabase/info.tsx`, but no evidence that a deployed project, schema, or environment is available to this task. A persistent Supabase/Postgres implementation is therefore a material infrastructure decision and should be confirmed before creating migrations that assume a live project.

## Security and reliability findings

- `.env.example` currently contains only browser-safe `VITE_SUPABASE_*` placeholders.
- No server-side ACN secret variable exists.
- The scaffold uses `origin: "*"` and logs every request through Hono logger; this is unsuitable for a credentialed production API and may expose request details.
- The health route does not expose secrets, but there are no domain routes or admin boundaries to assess.
- The browser importer does not persist files and is safer than pretending an upload succeeded; it is not a backend import workflow.
- Optional source absence currently leaves the demo running, which is consistent with the prompt, but status is client-generated rather than server-reported.
- No dependency vulnerability or lockfile audit was run as part of this repository audit.

## Vercel compatibility

The current static Vite frontend builds successfully and should be compatible with a Vercel static deployment when configured with the repository’s build command and `dist` output. This is not a verified cloud deployment.

The Supabase Deno Edge Function is not a Vercel function. Moving it to Vercel would be an architecture change, and a persistent simulation loop would not fit serverless execution. The smallest credible design is stateless, step-triggered simulation APIs backed by Supabase/Postgres, with external data fetches performed on request or through an external scheduled mechanism. This requires confirmation of the existing Supabase project/database availability before implementation.

## Requirement-to-implementation checklist

Status meanings: `implemented` means evidenced in current code; `partial` means some demo behavior exists; `blocked` means a decision, credential, source, or approval is required; `missing` means no implementation was found.

| Master requirement | Status | Current evidence / next implementation |
|---|---|---|
| Preserve existing frontend | implemented | No frontend files changed in audit; keep `src/` unchanged unless approved |
| Repository audit and mapping | implemented | This file and `FULL_STACK_DATA_MAPPING.md` |
| Deterministic no-ML scope | partial | Demo baseline exists; backend must remove ML-shaped fields/claims |
| Fleet and trip domain model | partial | In-memory vehicle specs; no persisted trips |
| Charger compatibility and allocation | partial | `src/lib/sim.ts`; needs authoritative backend engine/tests |
| Exact master priority score | missing | Implement versioned backend pure functions and unit tests |
| Energy source manager and ledger | partial | Demo solar/storage/grid flow; needs exact accounting and persistence |
| Battery SOC integration | partial | Approximate simulation only; implement documented validated function |
| SOH/wear/maintenance | partial | Demo heuristic; implement documented semi-empirical model and flags |
| Confidence/data quality/fallback | missing | Add explicit quality, freshness, confidence, fallback and alert records |
| Telemetry validation/fault injection | partial | Client-only three faults; add server contracts and reproducible scenarios |
| What-if isolation | partial | Client copies assumptions; persist scenario metadata/results without mutating live state |
| B1/B2/EVOS comparison | partial | `compareStrategies`; align definitions and equal-input evaluation |
| Sustainability KPIs | partial | Several demo totals; add null-safe authoritative API metrics |
| Explainability/audit | partial | Session rationale in memory; persist complete decision records |
| Six source categories | missing | Add verified connectors/import boundaries; no fabricated data |
| Removed ElaadNL/Pecan Street | blocked | Current catalogue contains them; frontend edit needs permission |
| Persistent schema/migrations | missing | Confirm Supabase/database decision, then add additive migrations |
| Stable backend API | partial | `backend/server.mjs` exposes health, fleet/charger/source status, scheduler-plan, energy-dispatch, scenario, and summary routes; persistence and frontend adapter remain |
| Frontend integration | partial | `src/lib/store.tsx`, `src/services/index.ts`, and `src/app/Shell.tsx` consume live source parameters/status; broader page-level API replacement remains |
| Secret handling | partial | `.env.example` has public placeholders; add server env docs after backend design |
| CORS/admin/rate limits | missing | Replace wildcard CORS and protect import/reset/admin routes |
| Vercel deployment | partial | Static build passes; backend hosting strategy unverified |
| Automated tests | partial | 12 Node tests cover engine, API, scenario isolation, and provenance behavior; adapters/persistence remain |
| Documentation deliverables | partial | Audit and mapping created; formulas/data/deployment docs still pending implementation |

## Phased implementation plan and acceptance criteria

1. **Design freeze:** confirm Supabase project/database availability, whether Supabase Edge Functions remain the backend runtime, and whether frontend service wiring may be changed. Acceptance: approved route prefix, persistence strategy, and environment-variable list.
2. **Core deterministic engine:** add typed backend pure functions for energy need, exact score, charger allocation, source dispatch, SOC/SOH/wear, confidence, and safe fallback. Acceptance: unit tests cover the formula and safety cases in the master prompt.
3. **Persistence and APIs:** add additive schema/migrations, provenance/source registry, scenario/decision/audit records, validation, errors, CORS allowlist, and step-triggered APIs. Acceptance: local API/edge tests pass without optional credentials.
4. **Source adapters/imports:** implement only verified official request formats and an offline NASA/tariff/carbon import boundary. Acceptance: success, malformed response, timeout, missing credential, provenance, and unavailable-source tests.
5. **Analytics/scenarios:** persist isolated scenario runs and equal-input B1/B2/EVOS comparisons. Acceptance: all eight required scenarios execute reproducibly and produce measured outputs without hardcoded improvements.
6. **Integration/deployment:** only after permission, wire the existing service interface to API responses without redesigning the UI. Acceptance: frontend build remains green; API fields and provenance match mapping.

## Decisions requiring user confirmation before backend implementation

1. May the backend use the existing Supabase project/scaffold as the persistence and Edge Function target, or should it remain a provider-neutral local backend until database access is confirmed?
2. May `src/services/index.ts` be edited later to connect the existing UI to backend endpoints? No visual/design changes are proposed.
3. May `src/data/catalog.ts` be edited later to remove ElaadNL and Pecan Street from the active catalogue, as required by the updated scope?
4. Which official Indian tariff document/utility/region and which CEA carbon-factor version should be used when the user supplies or selects the source? No values will be invented.

Until these are answered, safe backend-only work can be limited to provider-neutral pure engine modules and tests; persistence and frontend integration would remain blocked.

## Traceability to the original report

| Original report requirement | Current scope treatment | Code/module or document | Status | Evidence/test | Limitation |
|---|---|---|---|---|---|
| Layered architecture/data flow | Preserve as pragmatic modules | `src/lib/sim.ts`, `src/services/index.ts` | partial | Build passes | No server data flow |
| Fleet and charging | Deterministic demo | `src/lib/sim.ts`, fleet/scheduler pages | partial | Type-check/build | In-memory only |
| Energy/storage | Deterministic demo | `src/lib/sim.ts`, energy/system pages | partial | Build | Formula boundary not formalized |
| Battery/maintenance | Transparent demo estimate | `sohFor`, `sohTrend`, pages2/pages5 | partial | Build | Not master wear model |
| Telemetry/fault simulation | Client fault toggles | `src/lib/sim.ts`, maintenance page | partial | Manual UI path only | No ingestion/persistence tests |
| Sustainability | Derived demo metrics | `SimResult.totals`, sustainability page | partial | Build | Zero-denominator/API contract gaps |
| Explainability/confidence | Rationale exists; confidence absent | `Session.rationale`, contracts | partial | No automated tests | No persisted audit/confidence |
| What-if simulation | Client-only copied assumptions | scenarios page, `simulate` | partial | Build | No persisted isolated run |
| Database | Supabase KV scaffold only | `supabase/functions/server/kv_store.tsx` | missing | No migrations | Domain schema/provider decision pending |
| API/UI mapping | Service interfaces plus standalone API | `src/services/index.ts`, `backend/server.mjs`, mapping doc | partial | 10 API/engine tests | Frontend remains on demo adapter |
| Data sources | Catalogue/import preview | `src/data/catalog.ts`, importer | partial | Browser build | No verified connectors |
| Baselines/evaluation | Strategy comparison exists | `compareStrategies` | partial | Build | Definitions differ from authoritative spec |
| Deployment | Static Vite build | `vite.config.ts` | partial | `pnpm run build` | Cloud deployment not verified |
| Multidisciplinary interfaces | Types/catalogue suggest boundaries | `src/data/contracts.ts` | documented only | Source inspection | No backend module ownership yet |
