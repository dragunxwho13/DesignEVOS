import test from "node:test"

import assert from "node:assert/strict"

import {
  fetchAcnSessions,
  fetchNasaPowerPoint,
  fetchPvgisSeries,
  normalizeAcnSessions,
} from "../connectors/sources.mjs"

function mockFetch(expected, payload) {
  return async (url, init) => {
    assert.equal(url.toString().startsWith(expected), true)

    assert.equal(init.headers?.Authorization?.startsWith("Basic "), true)

    return { ok: true, json: async () => payload }
  }
}

test("ACN connector uses server-side Basic auth and never requires browser variables", async () => {
  const result = await fetchAcnSessions({
    token: "test-only-token",

    fetchImpl: mockFetch("https://ev.caltech.edu/api/v1/sessions/caltech", {
      _items: [],
    }),
  })

  assert.equal(result.status, "connected")

  assert.equal(result.source, "ACN-Data")
})

test("ACN connector reports missing credential without making a request", async () => {
  const result = await fetchAcnSessions({ token: "" })

  assert.equal(result.status, "unconfigured")

  assert.match(result.limitation, /ACN_DATA_API_KEY/)
})

test("ACN historical records normalize into baseline metrics without EVOS identity fabrication", () => {
  const result = normalizeAcnSessions([
    {
      sessionID: "S1",
      stationID: "CA-1",
      connectionTime: "2024-01-01T10:00:00Z",
      disconnectTime: "2024-01-01T11:00:00Z",
      kWhDelivered: 12,
    },

    {
      sessionID: "S2",
      stationID: "CA-2",
      connectionTime: "2024-01-02T10:00:00Z",
      disconnectTime: "2024-01-02T11:00:00Z",
      kWhDelivered: 8,
    },
  ])

  assert.equal(result.recordCount, 2)

  assert.equal(result.totalDeliveredKWh, 20)

  assert.equal(result.stationCount, 2)

  assert.equal(result.identityMapping, "none")
})

test("NASA POWER and PVGIS connectors validate documented response boundaries", async () => {
  const nasa = await fetchNasaPowerPoint({
    latitude: 28.6,
    longitude: 77.2,
    start: "20240101",
    end: "20240101",

    fetchImpl: async (url) => {
      assert.match(url.toString(), /temporal\/hourly\/point/)

      return {
        ok: true,
        json: async () => ({ properties: { parameter: { T2M: {} } } }),
      }
    },
  })

  assert.equal(nasa.status, "connected")

  const pvgis = await fetchPvgisSeries({
    latitude: 28.6,
    longitude: 77.2,
    peakPowerKW: 100,
    startYear: 2023,
    endYear: 2023,

    fetchImpl: async (url) => {
      assert.match(url.toString(), /\/api\/v5_3\/seriescalc/)

      return { ok: true, json: async () => ({ outputs: { hourly: [] } }) }
    },
  })

  assert.equal(pvgis.status, "connected")
})
