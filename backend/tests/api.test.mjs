import test from "node:test"

import assert from "node:assert/strict"

import { createApp } from "../server.mjs"

let server

let baseUrl

test.before(async () => {
  server = createApp()

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))

  baseUrl = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

test("health reports calculated engine and unconfigured persistence", async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`)

  assert.equal(response.status, 200)

  const body = await response.json()

  assert.equal(body.status, "ok")

  assert.equal(body.persistence, "not-configured")

  assert.equal(body.realtime, "simulated-stream-available")
})

test("realtime endpoint returns explicitly simulated state", async () => {
  const response = await fetch(`${baseUrl}/api/v1/realtime`)

  assert.equal(response.status, 200)

  const body = await response.json()

  assert.equal(body.provenance, "simulated")

  assert.equal(body.status, "simulated")

  assert.match(body.limitation, /no physical telemetry/)

  assert.ok(body.vehicles.length > 0)
})

test("live parameters endpoint returns source statuses and explicit fallback metadata", async () => {
  const response = await fetch(
    `${baseUrl}/api/v1/live/parameters?latitude=28.6&longitude=77.2&date=20240101&pvKWp=100`,
  )

  assert.equal(response.status, 200)

  const body = await response.json()

  assert.ok(Array.isArray(body.sources))

  assert.equal(body.sources.length, 3)

  assert.ok(Object.hasOwn(body.parameters, "solarMult"))

  assert.ok(Object.hasOwn(body.fallback, "tariffINR"))
})

test("fleet, charger, and source status routes are explicit about provenance", async () => {
  const [fleet, chargers, sources] = await Promise.all([
    fetch(`${baseUrl}/api/v1/vehicles`),

    fetch(`${baseUrl}/api/v1/chargers`),

    fetch(`${baseUrl}/api/v1/sources`),
  ])

  assert.equal(fleet.status, 200)

  assert.equal(chargers.status, 200)

  assert.equal(sources.status, 200)

  const fleetBody = await fleet.json()

  const sourceBody = await sources.json()

  assert.equal(fleetBody.provenance, "simulated")

  assert.ok(fleetBody.items.length > 0)

  assert.equal(sourceBody.items[0].status, "unconfigured")
})

test("scheduler route returns a safe calculated plan", async () => {
  const response = await fetch(`${baseUrl}/api/v1/scheduler/plan`, {
    method: "POST",

    headers: { "content-type": "application/json" },

    body: JSON.stringify({
      nowMinutes: 0,

      vehicles: [
        {
          id: "V1",
          vehicleClass: "bus",
          currentSocPct: 20,
          requiredSocPct: 80,
          usableBatteryCapacityKWh: 60,
          maxChargePowerKW: 20,
          departureMinutes: 240,
          priority: "Normal",
        },
      ],

      chargers: [{ id: "C1", ratedPowerKW: 30, compatibleClasses: ["bus"] }],
    }),
  })

  assert.equal(response.status, 200)

  const body = await response.json()

  assert.equal(body.provenance, "calculated")

  assert.equal(body.sessions.length, 1)

  assert.equal(body.sessions[0].powerKW, 20)
})

test("energy route rejects malformed input with common error shape", async () => {
  const response = await fetch(`${baseUrl}/api/v1/energy/dispatch`, {
    method: "POST",

    headers: { "content-type": "application/json" },

    body: JSON.stringify({ chargingDemandKW: "30" }),
  })

  assert.equal(response.status, 400)

  const body = await response.json()

  assert.equal(body.error.code, "INVALID_INPUT")
})

test("scenario route does not mutate live state and analytics handles denominators", async () => {
  const scenario = await fetch(`${baseUrl}/api/v1/scenarios/run`, {
    method: "POST",

    headers: { "content-type": "application/json" },

    body: JSON.stringify({ seed: 42, changes: {} }),
  })

  assert.equal(scenario.status, 200)

  const scenarioBody = await scenario.json()

  assert.equal(scenarioBody.liveStateMutated, false)

  assert.equal(scenarioBody.status, "completed")

  const analytics = await fetch(`${baseUrl}/api/v1/analytics/summary`)

  assert.equal(analytics.status, 200)

  const analyticsBody = await analytics.json()

  assert.equal(analyticsBody.provenance, "calculated")

  assert.ok(analyticsBody.metrics.departureSuccessRate !== undefined)
})
