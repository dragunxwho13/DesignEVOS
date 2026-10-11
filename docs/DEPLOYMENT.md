# EVOS deployment status

## Current verified state

The existing frontend is a static Vite application:

```text
pnpm install
pnpm run build
```

The build completed successfully during the repository audit and writes `dist/`. A cloud
deployment was not performed, so no Vercel deployment is claimed.

The new `backend/` engine is dependency-free Node ESM and can be verified with:

```text
node --test backend/tests/*.test.mjs
```

The backend also exposes a stateless local HTTP API:

```text
node backend/server.mjs
```

Current route surface: `GET /api/v1/health`, `GET /api/v1/vehicles`, `GET /api/v1/chargers`,
`GET /api/v1/sources`, `POST /api/v1/scheduler/plan`, `POST /api/v1/energy/dispatch`,
`POST /api/v1/scenarios/run`, `GET /api/v1/analytics/summary`, `GET /api/v1/realtime`, and
`GET /api/v1/stream`, plus `GET /api/v1/live/parameters`. It does not yet persist
runs or require environment variables. Demo read/scenario data is explicitly labelled simulated.

Set the public frontend variable `VITE_BACKEND_URL` to the backend origin. Set
`VITE_SITE_LATITUDE` and `VITE_SITE_LONGITUDE` to the actual site location. Set the secret
`ACN_DATA_API_KEY` only in the backend environment; never set it in frontend/Vite variables.

## Pending backend deployment decision

The repository contains a Supabase Deno Edge Function scaffold, not a Vercel backend. A
persistent simulation process, broker, WebSocket server, or background loop must not be assumed
to run inside a standard Vercel function. The compatible target architecture is a stateless,
step-triggered API backed by a persistent database, but the database/provider decision is still
pending.

No `vercel.json` was added because the current frontend already builds without one and the
backend runtime has not been selected.

## Future environment variables

None are required by the provider-neutral engine. When adapters are implemented, document only
variables actually read by server code. Candidate names require verification before use:

- `ACN_DATA_API_KEY` — secret, server-side only, if the official ACN access method confirms it.
- Existing Supabase server variables — secret values must remain server-side.
- `CORS_ORIGINS` or `FRONTEND_ORIGIN` — non-secret deployment configuration.
- `APP_ENV` and `LOG_LEVEL` — non-secret runtime configuration.

Set secrets in the backend host’s server environment and Vercel project environment settings
only after the runtime is selected. Never use `VITE_*` or `NEXT_PUBLIC_*` for private values.

## Remaining deployment checks

1. Confirm whether Supabase Edge Functions remain the backend runtime.
2. Confirm database/project access and migration workflow.
3. Add stateless API routes and contract tests.
4. Configure an origin allowlist instead of wildcard CORS.
5. Run the backend test suite and frontend build together.
6. Deploy a preview, inspect logs, and verify health/readiness and source-status routes.
