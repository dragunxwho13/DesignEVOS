# EVOS backend API

This directory contains the provider-neutral Node.js API used by the React frontend. It has no
database dependency and keeps external credentials server-side.

## Run tests

From the repository root:

```text
node --test backend/tests/*.test.mjs
```

## Run the stateless API

```text
node backend/server.mjs
```

The default local port is `8787` (override with `PORT`). The implemented routes are:

- `GET /api/v1/health`
- `GET /api/v1/realtime`
- `GET /api/v1/stream` (Server-Sent Events, 15-second simulated snapshots)
- `GET /api/v1/live/parameters`
- `GET /api/v1/vehicles`
- `GET /api/v1/chargers`
- `GET /api/v1/sources`
- `POST /api/v1/scheduler/plan`
- `POST /api/v1/energy/dispatch`
- `POST /api/v1/scenarios/run`
- `GET /api/v1/analytics/summary`

`CORS_ORIGINS` may contain a comma-separated allowlist. It defaults to local Vite origins;
wildcard CORS is not enabled.

## Source connectors

- ACN-Data uses `ACN_DATA_API_KEY` server-side and Basic authentication with the token as
  the username and an empty password. The credential is never returned by the API.
- NASA POWER uses the documented temporal point JSON endpoint.
- PVGIS uses the documented v5.3 `seriescalc` JSON endpoint and is labelled modelled/historical,
  not live physical PV telemetry.
- Tariff and grid-carbon values are server-configurable. When they are not configured, the API
  returns explicit fallback metadata rather than presenting assumptions as live source data.

The engine covers the documented energy-need calculation, exact priority score components,
charger uniqueness/power limits, energy dispatch balance, storage reserve, deterministic
battery wear/SOH helpers, confidence, source effective cost, stale telemetry, and safe
fallback scheduling.

The read routes and scenario/analytics routes use clearly labelled illustrative in-memory demo
records. This is a stateless prototype backend, not a persistent fleet database. The frontend is
wired to `/api/v1/live/parameters` and uses validated source metadata when available.

The stream is continuously updating but **not physically real-time**: it is a deterministic
simulation stream. Replace its snapshot producer with validated telemetry ingestion before
describing the application as live.
