export const ALGORITHM_VERSION = "evos-deterministic-engine 1.0.0"

export const STEP_MINUTES = 15

export const STEP_HOURS = STEP_MINUTES / 60

export const DEFAULT_CONFIG = Object.freeze({
  gridLimitKW: 80,

  storageCapacityKWh: 100,

  storageReservePct: 20,

  storageMaxPowerKW: 50,

  storageChargeEfficiency: 0.95,

  storageDischargeEfficiency: 0.95,

  chargerEfficiency: 0.92,

  lambdaCarbonINRPerKg: 2,

  muWear: 1,

  batteryReplacementCostINR: 900000,

  batteryLifetimeThroughputKWh: 270000,

  sohEndOfLifePct: 80,

  staleTelemetryMinutes: 30,

  fallbackTelemetryMinutes: 15,

  forecastCertainty: 0.5,

  energyBalanceToleranceKWh: 0.01,
})

const CLASS_WEIGHT = Object.freeze({ Critical: 1, Normal: 0.6, Low: 0.3 })

const VALID_PRIORITIES = new Set(Object.keys(CLASS_WEIGHT))

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function assertFinite(name, value) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)

  return value
}

export function validateSoc(name, value) {
  assertFinite(name, value)

  if (value < 0 || value > 100)
    throw new Error(`${name} must be between 0 and 100`)

  return value
}

export function energyNeeded(
  vehicle,
  chargerPowerKW,
  efficiency = DEFAULT_CONFIG.chargerEfficiency,
) {
  validateSoc("currentSocPct", vehicle.currentSocPct)

  validateSoc("requiredSocPct", vehicle.requiredSocPct)

  assertFinite("usableBatteryCapacityKWh", vehicle.usableBatteryCapacityKWh)

  assertFinite("chargerPowerKW", chargerPowerKW)

  if (
    vehicle.usableBatteryCapacityKWh < 0 ||
    chargerPowerKW < 0 ||
    efficiency <= 0 ||
    efficiency > 1
  ) {
    throw new Error("Invalid energy calculation inputs")
  }

  const batteryEnergy = Math.max(
    0,
    ((vehicle.requiredSocPct - vehicle.currentSocPct) / 100) *
      vehicle.usableBatteryCapacityKWh,
  )

  return {
    batteryEnergyKWh: batteryEnergy,

    wallEnergyKWh: batteryEnergy / efficiency,

    minimumChargeTimeHours:
      chargerPowerKW > 0 ? batteryEnergy / chargerPowerKW : null,

    minimumChargeTimeMinutes:
      chargerPowerKW > 0 ? (batteryEnergy / chargerPowerKW) * 60 : null,
  }
}

export function stressScore(input = {}) {
  const highSoc = clamp((Number(input.socPct ?? 50) - 80) / 20, 0, 1)

  const temperature = clamp((Number(input.temperatureC ?? 25) - 25) / 20, 0, 1)

  const cRate = clamp((Number(input.cRate ?? 0.5) - 0.5) / 1.5, 0, 1)

  const poorSoh = clamp((80 - Number(input.sohPct ?? 100)) / 20, 0, 1)

  const maintenance = clamp(Number(input.maintenanceRisk ?? 0), 0, 1)

  return clamp(
    0.25 * highSoc +
      0.25 * temperature +
      0.2 * cRate +
      0.2 * poorSoh +
      0.1 * maintenance,
    0,
    1,
  )
}

export function priorityScore(vehicle, nowMinutes, options = {}) {
  const slackMinutes =
    Number(vehicle.departureMinutes) -
    Number(nowMinutes) -
    Number(options.minimumChargeTimeMinutes ?? 0)

  const U = 1 - clamp(slackMinutes / 240, 0, 1)

  const N = clamp((vehicle.requiredSocPct - vehicle.currentSocPct) / 100, 0, 1)

  const K = CLASS_WEIGHT[vehicle.priority] ?? CLASS_WEIGHT.Normal

  const W = clamp(Number(vehicle.waitingMinutes ?? 0) / 120, 0, 1)

  const S = stressScore(vehicle.stress)

  const total = 0.35 * U + 0.2 * N + 0.2 * K + 0.15 * W - 0.1 * S

  return {
    urgency: U,

    normalizedShortfall: N,

    classWeight: K,

    waitingFactor: W,

    stress: S,

    total,

    slackMinutes,

    atRisk: slackMinutes < 0,
  }
}

export function confidence({
  dataQuality,
  forecastCertainty = DEFAULT_CONFIG.forecastCertainty,
  feasibilityMargin,
}) {
  return clamp(
    0.4 * clamp(dataQuality, 0, 1) +
      0.3 * clamp(forecastCertainty, 0, 1) +
      0.3 * clamp(feasibilityMargin, 0, 1),
    0,
    1,
  )
}

function compatible(vehicle, charger) {
  return (
    charger.available !== false &&
    (!charger.compatibleClasses ||
      charger.compatibleClasses.includes(vehicle.vehicleClass))
  )
}

export function allocateChargers(
  vehicles,
  chargers,
  nowMinutes,
  config = DEFAULT_CONFIG,
) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  const ordered = vehicles

    .filter((v) => v.available !== false)

    .map((vehicle) => {
      const candidates = chargers.filter((charger) =>
        compatible(vehicle, charger),
      )

      const maxPower = candidates.length
        ? Math.max(
            ...candidates.map((c) =>
              Math.min(c.ratedPowerKW, vehicle.maxChargePowerKW),
            ),
          )
        : 0

      const need = energyNeeded(vehicle, maxPower, cfg.chargerEfficiency)

      return {
        vehicle,
        score: priorityScore(vehicle, nowMinutes, {
          minimumChargeTimeMinutes: need.minimumChargeTimeMinutes ?? 0,
        }),
        need,
      }
    })

    .sort(
      (a, b) =>
        Number(b.score.atRisk) - Number(a.score.atRisk) ||
        b.score.total - a.score.total ||
        a.vehicle.departureMinutes - b.vehicle.departureMinutes ||
        a.vehicle.id.localeCompare(b.vehicle.id),
    )

  const occupied = new Set()

  const sessions = []

  const rejected = []

  for (const item of ordered) {
    const options = chargers
      .filter(
        (charger) =>
          compatible(item.vehicle, charger) && !occupied.has(charger.id),
      )

      .map((charger) => {
        const power = Math.min(
          charger.ratedPowerKW,
          item.vehicle.maxChargePowerKW,
        )

        const need = energyNeeded(item.vehicle, power, cfg.chargerEfficiency)

        const duration = need.minimumChargeTimeMinutes ?? 0

        return { charger, power, duration }
      })

      .sort(
        (a, b) =>
          a.duration - b.duration ||
          b.power - a.power ||
          a.charger.id.localeCompare(b.charger.id),
      )

    const selected = options[0]

    if (!selected) {
      rejected.push({
        vehicleId: item.vehicle.id,
        reason: "no compatible free charger",
        score: item.score,
      })

      continue
    }

    occupied.add(selected.charger.id)

    const endMinutes = nowMinutes + selected.duration

    sessions.push({
      vehicleId: item.vehicle.id,

      chargerId: selected.charger.id,

      startMinutes: nowMinutes,

      endMinutes,

      powerKW: selected.power,

      energyKWh: energyNeeded(
        item.vehicle,
        selected.power,
        cfg.chargerEfficiency,
      ).wallEnergyKWh,

      score: item.score,

      atRisk: endMinutes > item.vehicle.departureMinutes,

      constraints: [
        `charger power <= ${selected.charger.ratedPowerKW} kW`,

        `vehicle acceptance <= ${item.vehicle.maxChargePowerKW} kW`,

        `compatible charger ${selected.charger.id}`,
      ],

      explanation: item.score.atRisk
        ? "Negative slack elevated this vehicle while retaining charger and power safety constraints."
        : `Priority score ${item.score.total.toFixed(4)} selected the earliest feasible compatible charger.`,
    })
  }

  return { sessions, rejected }
}

export function dispatchEnergy(
  { chargingDemandKW, baseLoadKW, pvAvailableKW, storage },
  config = DEFAULT_CONFIG,
) {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  for (const [name, value] of Object.entries({
    chargingDemandKW,
    baseLoadKW,
    pvAvailableKW,
  })) {
    assertFinite(name, value)

    if (value < 0) throw new Error(`${name} cannot be negative`)
  }

  const state = {
    capacityKWh: storage.capacityKWh,

    socKWh: storage.socKWh,

    reserveKWh: (storage.capacityKWh * storage.reservePct) / 100,
  }

  if (state.socKWh < state.reserveKWh || state.socKWh > state.capacityKWh)
    throw new Error("Storage SOC is outside reserve/capacity bounds")

  const loadKW = chargingDemandKW + baseLoadKW

  const pvToLoadKW = Math.min(pvAvailableKW, loadKW)

  const surplusKW = Math.max(0, pvAvailableKW - pvToLoadKW)

  const chargeKW = Math.min(
    surplusKW,
    cfg.storageMaxPowerKW,
    (state.capacityKWh - state.socKWh) /
      STEP_HOURS /
      cfg.storageChargeEfficiency,
  )

  state.socKWh += chargeKW * STEP_HOURS * cfg.storageChargeEfficiency

  const remainingLoadKW = loadKW - pvToLoadKW

  const availableDischargeKW = Math.max(
    0,
    ((state.socKWh - state.reserveKWh) * cfg.storageDischargeEfficiency) /
      STEP_HOURS,
  )

  const storageToLoadKW = Math.min(
    remainingLoadKW,
    cfg.storageMaxPowerKW,
    availableDischargeKW,
  )

  state.socKWh -=
    (storageToLoadKW * STEP_HOURS) / cfg.storageDischargeEfficiency

  const gridKW = remainingLoadKW - storageToLoadKW

  const balanceKWh =
    (pvToLoadKW + storageToLoadKW + gridKW - loadKW) * STEP_HOURS

  return {
    pvToLoadKW,
    pvToStorageKW: chargeKW,
    storageToLoadKW,
    gridKW,

    curtailedPVKW: Math.max(0, surplusKW - chargeKW),

    storageSocPct: (state.socKWh / state.capacityKWh) * 100,

    gridLimitExceeded: gridKW > cfg.gridLimitKW + 1e-9,

    energyBalanceErrorKWh: balanceKWh,

    balanced: Math.abs(balanceKWh) <= cfg.energyBalanceToleranceKWh,
  }
}

export function cycleWearPct(
  { dodPct, temperatureC = 25, cRate = 0.5 },
  k = 0.01,
) {
  assertFinite("dodPct", dodPct)

  if (dodPct < 0 || dodPct > 100)
    throw new Error("dodPct must be between 0 and 100")

  const dod = dodPct / 100

  const fDod = Math.pow(dod / 0.8, 1.3)

  const fTemp = temperatureC > 25 ? 1 + 0.03 * (temperatureC - 25) : 1

  const fCrate = cRate > 0.5 ? 1 + 0.2 * (cRate - 0.5) : 1

  return Math.max(0, k * fDod * fTemp * fCrate)
}

export function sohEstimate({
  cycleWearPct: cycle = 0,
  calendarWearPct: calendar = 0,
}) {
  return clamp(100 - Math.max(0, cycle) - Math.max(0, calendar), 0, 100)
}

export function staleTelemetryStatus(
  { observedAt, now, quality = "valid" },
  config = DEFAULT_CONFIG,
) {
  if (quality !== "valid")
    return { status: "invalid", useLastValid: false, fallback: true }

  const ageMinutes = Math.max(
    0,
    (new Date(now).getTime() - new Date(observedAt).getTime()) / 60000,
  )

  if (ageMinutes <= config.staleTelemetryMinutes)
    return {
      status: "current",
      ageMinutes,
      useLastValid: false,
      fallback: false,
    }

  if (
    ageMinutes <=
    config.staleTelemetryMinutes + config.fallbackTelemetryMinutes
  )
    return { status: "stale", ageMinutes, useLastValid: true, fallback: false }

  return {
    status: "unavailable",
    ageMinutes,
    useLastValid: false,
    fallback: true,
  }
}

export function safeFallback(vehicles, chargers, nowMinutes) {
  const safeVehicles = vehicles.filter(
    (v) =>
      v.telemetryStatus !== "invalid" && v.telemetryStatus !== "unavailable",
  )

  const result = allocateChargers(safeVehicles, chargers, nowMinutes)

  return {
    strategy: "fcfs-safe-fallback",

    ...result,

    alert:
      "One or more telemetry records were invalid or unavailable; affected vehicles were excluded from scheduling.",
  }
}

export function sourceEffectiveCost(
  { energyPriceINRPerKWh, carbonIntensityKgPerKWh, batteryWearCostINRPerKWh },
  config = DEFAULT_CONFIG,
) {
  return (
    energyPriceINRPerKWh +
    config.lambdaCarbonINRPerKg * carbonIntensityKgPerKWh +
    config.muWear * batteryWearCostINRPerKWh
  )
}
