import test from "node:test"

import assert from "node:assert/strict"

import {
  allocateChargers,
  confidence,
  cycleWearPct,
  dispatchEnergy,
  energyNeeded,
  priorityScore,
  safeFallback,
  sohEstimate,
  sourceEffectiveCost,
  staleTelemetryStatus,
} from "../core/engine.mjs"

test("energy need is zero when target SOC is already met", () => {
  const result = energyNeeded(
    { currentSocPct: 80, requiredSocPct: 70, usableBatteryCapacityKWh: 60 },
    30,
  )

  assert.equal(result.batteryEnergyKWh, 0)

  assert.equal(result.minimumChargeTimeMinutes, 0)
})

test("zero charge power is infeasible without division by zero", () => {
  const result = energyNeeded(
    { currentSocPct: 20, requiredSocPct: 80, usableBatteryCapacityKWh: 60 },
    0,
  )

  assert.equal(result.minimumChargeTimeMinutes, null)
})

test("priority formula uses exact class weights and bounded factors", () => {
  const score = priorityScore(
    {
      currentSocPct: 20,

      requiredSocPct: 80,

      departureMinutes: 60,

      priority: "Critical",

      waitingMinutes: 240,

      stress: {
        socPct: 50,
        temperatureC: 25,
        cRate: 0.5,
        sohPct: 100,
        maintenanceRisk: 0,
      },
    },
    120,
    { minimumChargeTimeMinutes: 0 },
  )

  assert.equal(score.classWeight, 1)

  assert.equal(score.waitingFactor, 1)

  assert.equal(score.atRisk, true)

  assert.ok(score.urgency >= 0 && score.urgency <= 1)

  assert.ok(score.total <= 1 && score.total >= -0.1)
})

test("charger allocation is unique and respects charger and vehicle power", () => {
  const result = allocateChargers(
    [
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

      {
        id: "V2",
        vehicleClass: "bus",
        currentSocPct: 20,
        requiredSocPct: 80,
        usableBatteryCapacityKWh: 60,
        maxChargePowerKW: 50,
        departureMinutes: 240,
        priority: "Normal",
      },
    ],
    [{ id: "C1", ratedPowerKW: 30, compatibleClasses: ["bus"] }],
    0,
  )

  assert.equal(result.sessions.length, 1)

  assert.equal(result.sessions[0].powerKW, 20)

  assert.equal(result.rejected.length, 1)
})

test("energy dispatch stays balanced and above storage reserve", () => {
  const result = dispatchEnergy({
    chargingDemandKW: 30,

    baseLoadKW: 10,

    pvAvailableKW: 20,

    storage: { capacityKWh: 100, socKWh: 50, reservePct: 20 },
  })

  assert.equal(result.balanced, true)

  assert.ok(result.storageSocPct >= 20)

  assert.equal(result.gridLimitExceeded, false)
})

test("wear, SOH, confidence and source cost are deterministic", () => {
  const wear = cycleWearPct({ dodPct: 80, temperatureC: 35, cRate: 1 })

  assert.ok(wear > 0)

  assert.equal(
    sohEstimate({ cycleWearPct: wear, calendarWearPct: 1 }),
    100 - wear - 1,
  )

  assert.equal(
    confidence({ dataQuality: 1, forecastCertainty: 1, feasibilityMargin: 1 }),
    1,
  )

  assert.equal(
    sourceEffectiveCost({
      energyPriceINRPerKWh: 8,
      carbonIntensityKgPerKWh: 0.7,
      batteryWearCostINRPerKWh: 3,
    }),
    12.4,
  )
})

test("invalid and stale telemetry trigger the documented fallback path", () => {
  const now = "2026-10-11T12:00:00Z"

  assert.equal(
    staleTelemetryStatus({ observedAt: "2026-10-11T11:50:00Z", now }).status,
    "current",
  )

  assert.equal(
    staleTelemetryStatus({ observedAt: "2026-10-11T11:20:00Z", now }).status,
    "stale",
  )

  assert.equal(
    staleTelemetryStatus({ observedAt: "2026-10-11T10:00:00Z", now }).fallback,
    true,
  )

  const fallback = safeFallback(
    [
      {
        id: "V1",
        telemetryStatus: "current",
        vehicleClass: "bus",
        currentSocPct: 20,
        requiredSocPct: 80,
        usableBatteryCapacityKWh: 60,
        maxChargePowerKW: 20,
        departureMinutes: 240,
        priority: "Normal",
      },

      {
        id: "V2",
        telemetryStatus: "invalid",
        vehicleClass: "bus",
        currentSocPct: 20,
        requiredSocPct: 80,
        usableBatteryCapacityKWh: 60,
        maxChargePowerKW: 20,
        departureMinutes: 240,
        priority: "Normal",
      },
    ],
    [{ id: "C1", ratedPowerKW: 30, compatibleClasses: ["bus"] }],
    0,
  )

  assert.equal(fallback.sessions.length, 1)

  assert.match(fallback.alert, /invalid or unavailable/)
})
