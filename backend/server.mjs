import http from "node:http"

import {
  allocateChargers,
  dispatchEnergy,
  ALGORITHM_VERSION,
} from "./core/engine.mjs"

import {
  DEMO_CHARGERS,
  DEMO_SOURCES,
  DEMO_VEHICLES,
} from "./core/demo-data.mjs"

import {
  fetchAcnSessions,
  fetchNasaPowerPoint,
  fetchPvgisSeries,
} from "./connectors/sources.mjs"

function realtimeSnapshot() {
  const now = new Date()

  const elapsedMinutes = now.getUTCMinutes()

  return {
    observedAt: now.toISOString(),

    simulationClockMinutes: elapsedMinutes,

    provenance: "simulated",

    status: "simulated",

    vehicles: DEMO_VEHICLES.map((vehicle, index) => ({
      ...vehicle,

      currentSocPct: Math.min(
        vehicle.requiredSocPct,
        vehicle.currentSocPct + ((elapsedMinutes + index * 3) % 15) / 100,
      ),

      telemetryQuality: "simulated",
    })),

    chargers: DEMO_CHARGERS.map((charger, index) => ({
      ...charger,

      status:
        index === elapsedMinutes % DEMO_CHARGERS.length
          ? "Charging"
          : "Available",
    })),

    limitation:
      "This stream is a deterministic simulation; no physical telemetry or charger control is connected.",
  }
}

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "")
}

function previousYearDate(date, years) {
  const year = Number(String(date).slice(0, 4)) - years
  return `${year}${String(date).slice(4)}`
}

function normalizeSolarMultiplier(nasaResult, pvgisResult) {
  const parameter = nasaResult?.data?.properties?.parameter?.ALLSKY_SFC_SW_DWN

  const values =
    parameter && typeof parameter === "object"
      ? Object.values(parameter).filter(
          (value) => Number.isFinite(Number(value)) && Number(value) >= 0,
        )
      : []

  if (values.length)
    return Math.min(1.5, Math.max(0, Math.max(...values.map(Number)) / 1000))

  const hourly = pvgisResult?.data?.outputs?.hourly

  if (Array.isArray(hourly) && hourly.length) {
    const pvValues = hourly
      .map((point) => Number(point.P ?? point.PV ?? point.power))
      .filter((value) => Number.isFinite(value) && value >= 0)

    if (pvValues.length)
      return Math.min(1.5, Math.max(0, Math.max(...pvValues) / 100))
  }

  return null
}

function configuredNumber(name) {
  const value = Number(process.env[name])

  return Number.isFinite(value) ? value : null
}

function configuredProfile(name) {
  try {
    const value = process.env[name]

    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

async function fetchLiveParameters(query) {
  const latitude = Number(query.get("latitude"))

  const longitude = Number(query.get("longitude"))

  const date = query.get("date") || currentUtcDate()

  const pvKWp = Number(query.get("pvKWp") || 100)

  const base = { latitude, longitude, date, pvKWp }

  const results = await Promise.allSettled([
    fetchAcnSessions({
      site: query.get("acnSite") || "caltech",
      start: query.get("acnStart"),
      end: query.get("acnEnd"),
    }),

    fetchNasaPowerPoint({ latitude, longitude, start: date, end: date }),

    fetchPvgisSeries({
      latitude,
      longitude,
      peakPowerKW: pvKWp,
      startYear: Number(date.slice(0, 4)),
      endYear: Number(date.slice(0, 4)),
    }),
  ])

  const [acnSettled, nasaSettled, pvgisSettled] = results

  const normalize = (settled, source) =>
    settled.status === "fulfilled"
      ? settled.value
      : {
          source,
          status: "unavailable",
          provenance: "unavailable",
          data: null,
          limitation:
            settled.reason instanceof Error
              ? settled.reason.message
              : "Source request failed",
        }

  const acn = normalize(acnSettled, "ACN-Data")

  let nasaPower = normalize(nasaSettled, "NASA POWER")
  if (nasaPower.status === "connected" && nasaPower.usable === false) {
    for (const yearsBack of [1, 2, 3, 4, 5]) {
      const fallbackDate = previousYearDate(date, yearsBack)
      try {
        const fallback = await fetchNasaPowerPoint({
          latitude,
          longitude,
          start: fallbackDate,
          end: fallbackDate,
        })
        if (fallback.usable) {
          nasaPower = {
            ...fallback,
            requestedDate: date,
            effectiveDate: fallbackDate,
            limitation: `The requested NASA POWER date had no usable observations; mapped the real dataset response for ${fallbackDate}.`,
          }
          break
        }
      } catch {
        // Continue to the next historical date; the final source state remains explicit.
      }
    }
  }

  const pvgis = normalize(pvgisSettled, "PVGIS")
  let pvgisResult = pvgis
  if (pvgisResult.status === "unavailable") {
    for (const year of [2024, 2023, 2022, 2021]) {
      try {
        const fallback = await fetchPvgisSeries({
          latitude,
          longitude,
          peakPowerKW: pvKWp,
          startYear: year,
          endYear: year,
        })
        if (fallback.usable) {
          pvgisResult = {
            ...fallback,
            requestedYear: Number(date.slice(0, 4)),
            effectiveYear: year,
            limitation: `The requested PVGIS year was unavailable; mapped the real PVGIS model response for ${year}.`,
          }
          break
        }
      } catch {
        // Continue through known historical years.
      }
    }
  }

  const solarMult = normalizeSolarMultiplier(nasaPower, pvgisResult)

  const tariffINR = configuredNumber("DEFAULT_TARIFF_INR")

  const carbonG = configuredNumber("GRID_CARBON_G_PER_KWH")

  return {
    observedAt: new Date().toISOString(),

    parameters: {
      solarMult,

      tariffINR,

      carbonG,

      tariffProfile: configuredProfile("TARIFF_PROFILE_JSON"),

      carbonProfile: configuredProfile("CARBON_PROFILE_JSON"),

      acnSessionData: acn.data,

      acnHistoricalBaseline: acn.normalized ?? null,

      nasaPowerData: nasaPower.data,

      pvgisData: pvgisResult.data,
    },

    sources: [acn, nasaPower, pvgisResult],

    fallback: {
      solarMult: solarMult === null ? "simulated-existing-assumption" : null,

      tariffINR: tariffINR === null ? "simulated-existing-assumption" : null,

      carbonG: carbonG === null ? "simulated-existing-assumption" : null,
    },

    request: base,
  }
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:8443")

    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function sendJson(res, status, body, origin) {
  res.statusCode = status

  res.setHeader("Content-Type", "application/json; charset=utf-8")

  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.has(origin) ? origin : [...allowedOrigins][0],
  )

  res.setHeader("Vary", "Origin")

  res.end(JSON.stringify(body))
}

function errorBody(code, message) {
  return { error: { code, message } }
}

async function readJson(req) {
  let text = ""

  for await (const chunk of req) {
    text += chunk

    if (text.length > 1_000_000) throw new Error("Request body is too large")
  }

  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    throw new Error("Request body must be valid JSON")
  }
}

export async function handleRequest(req, res) {
    const origin = req.headers.origin || ""

    if (req.method === "OPTIONS") {
      res.statusCode = 204

      res.setHeader(
        "Access-Control-Allow-Origin",
        allowedOrigins.has(origin) ? origin : [...allowedOrigins][0],
      )

      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

      res.setHeader("Access-Control-Allow-Headers", "Content-Type")

      res.end()

      return
    }

    try {
      const url = new URL(req.url || "/", "http://localhost")

      if (req.method === "GET" && url.pathname === "/api/v1/health") {
        sendJson(
          res,
          200,
          {
            status: "ok",
            algorithmVersion: ALGORITHM_VERSION,
            persistence: "not-configured",
            realtime: "simulated-stream-available",
          },
          origin,
        )

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/realtime") {
        sendJson(res, 200, realtimeSnapshot(), origin)

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/live/parameters") {
        const result = await fetchLiveParameters(url.searchParams)

        sendJson(res, 200, result, origin)

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/stream") {
        res.statusCode = 200

        res.setHeader("Content-Type", "text/event-stream; charset=utf-8")

        res.setHeader("Cache-Control", "no-cache, no-transform")

        res.setHeader("Connection", "keep-alive")

        res.setHeader(
          "Access-Control-Allow-Origin",
          allowedOrigins.has(origin) ? origin : [...allowedOrigins][0],
        )

        res.setHeader("Vary", "Origin")

        const write = () =>
          res.write(
            `event: snapshot\ndata: ${JSON.stringify(realtimeSnapshot())}\n\n`,
          )

        write()

        const timer = setInterval(write, 15000)

        req.on("close", () => clearInterval(timer))

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/vehicles") {
        sendJson(
          res,
          200,
          {
            items: DEMO_VEHICLES,
            total: DEMO_VEHICLES.length,
            provenance: "simulated",
            status: "simulated",
          },
          origin,
        )

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/chargers") {
        sendJson(
          res,
          200,
          {
            items: DEMO_CHARGERS,
            total: DEMO_CHARGERS.length,
            provenance: "simulated",
            status: "simulated",
          },
          origin,
        )

        return
      }

      if (req.method === "GET" && url.pathname === "/api/v1/sources") {
        sendJson(
          res,
          200,
          {
            items: DEMO_SOURCES,
            provenance: "source-status",
            status: "unavailable",
          },
          origin,
        )

        return
      }

      if (
        req.method === "POST" &&
        url.pathname === "/api/v1/sources/acn/sessions"
      ) {
        const result = await fetchAcnSessions(await readJson(req))

        sendJson(
          res,
          result.status === "unconfigured" ? 503 : 200,
          result,
          origin,
        )

        return
      }

      if (
        req.method === "POST" &&
        url.pathname === "/api/v1/sources/nasa-power/point"
      ) {
        sendJson(
          res,
          200,
          await fetchNasaPowerPoint(await readJson(req)),
          origin,
        )

        return
      }

      if (
        req.method === "POST" &&
        url.pathname === "/api/v1/sources/pvgis/series"
      ) {
        sendJson(res, 200, await fetchPvgisSeries(await readJson(req)), origin)

        return
      }

      if (req.method === "POST" && url.pathname === "/api/v1/scheduler/plan") {
        const body = await readJson(req)

        if (!Array.isArray(body.vehicles) || !Array.isArray(body.chargers)) {
          sendJson(
            res,
            400,
            errorBody(
              "INVALID_INPUT",
              "vehicles and chargers arrays are required",
            ),
            origin,
          )

          return
        }

        const result = allocateChargers(
          body.vehicles,
          body.chargers,
          Number(body.nowMinutes ?? 0),
          body.config,
        )

        sendJson(
          res,
          200,
          {
            algorithmVersion: ALGORITHM_VERSION,
            provenance: "calculated",
            ...result,
          },
          origin,
        )

        return
      }

      if (req.method === "POST" && url.pathname === "/api/v1/energy/dispatch") {
        const body = await readJson(req)

        if (
          !body.storage ||
          [body.chargingDemandKW, body.baseLoadKW, body.pvAvailableKW].some(
            (value) => typeof value !== "number",
          )
        ) {
          sendJson(
            res,
            400,
            errorBody(
              "INVALID_INPUT",
              "chargingDemandKW, baseLoadKW, pvAvailableKW and storage are required",
            ),
            origin,
          )

          return
        }

        sendJson(
          res,
          200,
          {
            algorithmVersion: ALGORITHM_VERSION,
            provenance: "calculated",
            ...dispatchEnergy(body, body.config),
          },
          origin,
        )

        return
      }

      if (req.method === "POST" && url.pathname === "/api/v1/scenarios/run") {
        const body = await readJson(req)

        const changes =
          body.changes && typeof body.changes === "object" ? body.changes : {}

        const vehicles = Array.isArray(changes.vehicles)
          ? changes.vehicles
          : DEMO_VEHICLES

        const chargers = Array.isArray(changes.chargers)
          ? changes.chargers
          : DEMO_CHARGERS

        const plan = allocateChargers(
          vehicles,
          chargers,
          Number(body.nowMinutes ?? 600),
          body.config,
        )

        sendJson(
          res,
          200,
          {
            scenarioId: `scenario-${Date.now()}`,

            strategy: "EVOS deterministic priority",

            seed: body.seed ?? null,

            inputs: { changes, initialState: "demo snapshot" },

            result: plan,

            liveStateMutated: false,

            provenance: "simulated",

            status: "completed",
          },
          origin,
        )

        return
      }

      if (
        req.method === "GET" &&
        url.pathname === "/api/v1/analytics/summary"
      ) {
        const plan = allocateChargers(DEMO_VEHICLES, DEMO_CHARGERS, 600)

        const requested = DEMO_VEHICLES.length

        const completed = plan.sessions.filter(
          (session) => !session.atRisk,
        ).length

        sendJson(
          res,
          200,
          {
            provenance: "calculated",

            status: "simulated",

            metrics: {
              requestedDepartures: requested,

              scheduledSessions: plan.sessions.length,

              departureSuccessRate: requested ? completed / requested : null,

              chargerUtilization: DEMO_CHARGERS.length
                ? plan.sessions.length / DEMO_CHARGERS.length
                : null,

              atRiskSessions: plan.sessions.filter((session) => session.atRisk)
                .length,

              rejectedVehicles: plan.rejected.length,
            },

            limitations: [
              "This summary uses illustrative in-memory demo inputs; no live or imported records are included.",
            ],
          },
          origin,
        )

        return
      }

      sendJson(res, 404, errorBody("NOT_FOUND", "Route not found"), origin)
    } catch (error) {
      sendJson(
        res,
        400,
        errorBody(
          "REQUEST_FAILED",
          error instanceof Error ? error.message : "Request failed",
        ),
        origin,
      )
    }
}

export function createApp() {
  return http.createServer(handleRequest)
}

if (
  process.argv[1] &&
  new URL(import.meta.url).pathname.endsWith(
    process.argv[1].replaceAll("\\", "/"),
  )
) {
  const port = Number(process.env.PORT || 8787)

  createApp().listen(port, "127.0.0.1", () => {
    console.log(`EVOS backend listening on http://127.0.0.1:${port}`)
  })
}
