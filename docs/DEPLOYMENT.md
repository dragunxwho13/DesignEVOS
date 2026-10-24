# EVOS deployment

## Current verified state

EVOS consists of a Vite frontend and a stateless Node.js ESM backend.

```text
Frontend: http://localhost:8443
Backend:  http://localhost:8787
```

Build and test from the repository root:

```text
pnpm install
node --test backend/tests/*.test.mjs
pnpm exec tsc --noEmit -p .
pnpm run build
```

The backend exposes health, source, live-parameter, scheduling, energy, scenario, analytics,
realtime, and SSE routes. It does not persist fleet changes, runs, or telemetry.

Set the public frontend variables `VITE_BACKEND_URL`, `VITE_SITE_LATITUDE`, and
`VITE_SITE_LONGITUDE` as needed. Set `ACN_DATA_API_KEY` only in the backend environment.

## One-command Windows deployment

Run `run-local.bat` from the repository root. It starts or reuses the backend and frontend,
waits for readiness, and opens the website.

The launcher uses:

```text
node --env-file=backend/.env backend/server.mjs
pnpm run dev -- --host 0.0.0.0 --port 8443
```

Create `backend/.env` from `backend/.env.example`. The file is ignored by Git and must never be
committed.

## Manual startup

Backend:

```text
node --env-file=backend/.env backend/server.mjs
```

Frontend, in a second terminal:

```text
pnpm run dev -- --host 0.0.0.0 --port 8443
```

Check readiness:

```text
http://localhost:8787/api/v1/health
http://localhost:8787/api/v1/live/parameters
http://localhost:8443/
```

## Environment variables

### Frontend

```dotenv
VITE_BACKEND_URL=http://localhost:8787
VITE_SITE_LATITUDE=28.6139
VITE_SITE_LONGITUDE=77.209
```

These values are public and are bundled into the browser.

### Backend

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

Tariff and grid-carbon values are explicit server configuration. If they are absent, the API
reports deterministic fallback metadata instead of presenting the fallback as live data.

## Hosted deployment considerations

The current Vercel deployment is available at:

```text
https://evos-black.vercel.app
```

The frontend and backend are deployed together. The backend is exposed through the same-origin
API routes:

```text
https://evos-black.vercel.app/api/v1/health
https://evos-black.vercel.app/api/v1/live/parameters
```

The backend is a serverless-compatible stateless prototype and is not a production telemetry,
control, or multi-tenant platform.

A production deployment needs:

1. a selected backend runtime and secret manager;
2. authenticated persistent fleet and user storage;
3. origin allowlisting and request validation;
4. observability, rate limiting, and audit logging;
5. validated telemetry ingestion before claiming real-time operations;
6. a separate OCPP/MQTT/charger-control boundary if physical control is required.

The repository contains a Supabase Edge Function scaffold, but the Node backend is the currently
implemented runtime. Do not assume a persistent process, broker, WebSocket server, or background
loop can run inside a standard Vercel function.

## Deployment checklist

- [ ] Keep ACN credentials server-side.
- [ ] Configure `CORS_ORIGINS` for the deployed frontend origin.
- [ ] Set `VITE_BACKEND_URL` to the deployed backend origin.
- [ ] Verify `/api/v1/health`.
- [ ] Verify `/api/v1/live/parameters` and source provenance.
- [ ] Run backend tests, TypeScript validation, and the production build.
- [ ] Confirm that the UI still labels historical, modelled, calculated, and simulated data.

## Current production verification

- [x] Frontend returns HTTP 200.
- [x] Backend health returns HTTP 200.
- [x] ACN returns `connected`, `current_api`, and `usable: true`.
- [x] ACN normalization returns 25 historical records in the configured deployment.
