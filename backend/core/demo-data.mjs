// Mirrors the frontend registry in src/lib/sim.ts (RAW, VEHICLES, CHARGERS) so the API and the
// browser model describe the same 20 vehicles and 6 chargers. Keep both files in sync.
const NOW_MINUTES = 600 // 10:00 on the demo day, matching NOW = 40 steps in sim.ts

const RAW = [
  // id, class, soc, required, departureH, cycles, ageMonths
  ["BUS-01", "Shuttle bus", 34, 90, 12.5, 820, 30],
  ["BUS-02", "Shuttle bus", 52, 90, 16, 640, 24],
  ["BUS-03", "Shuttle bus", 28, 85, 17.5, 1110, 41],
  ["BUS-04", "Shuttle bus", 61, 90, 19, 380, 14],
  ["BUS-05", "Shuttle bus", 45, 85, 13, 930, 33],
  ["BUS-06", "Shuttle bus", 88, 85, 18, 210, 8],
  ["VAN-01", "Service van", 38, 85, 12, 560, 22],
  ["VAN-02", "Service van", 55, 85, 16.5, 700, 27],
  ["VAN-03", "Service van", 70, 85, 21, 300, 12],
  ["VAN-04", "Service van", 25, 80, 18.5, 980, 38],
  ["CRT-01", "Utility cart", 40, 80, 12, 1300, 36],
  ["CRT-02", "Utility cart", 22, 80, 13.5, 1540, 44],
  ["CRT-03", "Utility cart", 65, 80, 15, 900, 26],
  ["CRT-04", "Utility cart", 90, 80, 12.5, 420, 12],
  ["CRT-05", "Utility cart", 35, 80, 16, 1120, 32],
  ["CRT-06", "Utility cart", 55, 80, 17, 760, 20],
  ["CRT-07", "Utility cart", 18, 80, 14.5, 1680, 48],
  ["CRT-08", "Utility cart", 72, 80, 19.5, 610, 18],
  ["CRT-09", "Utility cart", 48, 80, 20, 1420, 40],
  ["CRT-10", "Utility cart", 30, 80, 18, 980, 28],
]

const step = (hours) => Math.round(hours * 4) * 15

export const DEMO_VEHICLES = Object.freeze(
  RAW.map(([id, vehicleClass, soc, required, departureH, cycles, ageMonths], i) => {
    const arrivalMinutes = step(6 + ((i * 37) % 40) / 10)
    const unavailableReason = id === "CRT-09" ? "Scheduled maintenance (brake inspection)" : undefined
    return {
      id,
      vehicleClass,
      usableBatteryCapacityKWh: vehicleClass === "Shuttle bus" ? 120 : vehicleClass === "Service van" ? 60 : 12,
      maxChargePowerKW: vehicleClass === "Shuttle bus" ? 60 : vehicleClass === "Service van" ? 30 : 3.3,
      currentSocPct: soc,
      requiredSocPct: required,
      departureMinutes: step(departureH),
      arrivalMinutes,
      priority: "Normal",
      waitingMinutes: Math.max(0, NOW_MINUTES - arrivalMinutes),
      cycles,
      ageMonths,
      ...(unavailableReason ? { available: false, unavailableReason } : {}),
    }
  }),
)

const charger = (id, type, ratedPowerKW, connector, compatibleClasses) => ({
  id,
  type,
  ratedPowerKW,
  connector,
  compatibleClasses,
  available: true,
})

export const DEMO_CHARGERS = Object.freeze([
  charger("DC-1", "DC", 30, "CCS2", ["Shuttle bus", "Service van"]),
  charger("DC-2", "DC", 30, "CCS2", ["Shuttle bus", "Service van"]),
  charger("AC-1", "AC", 7.4, "Type 2", ["Service van", "Utility cart"]),
  charger("AC-2", "AC", 7.4, "Type 2", ["Service van", "Utility cart"]),
  charger("AC-3", "AC", 7.4, "Type 2", ["Service van", "Utility cart"]),
  charger("AC-4", "AC", 7.4, "Type 2", ["Service van", "Utility cart"]),
])

export const DEMO_SOURCES = Object.freeze([
  {
    id: "acn",
    name: "ACN-Data",
    status: "unconfigured",
    provenance: "unavailable",
    limitation: "Credential and access method have not been configured.",
  },

  {
    id: "nasa-power",
    name: "NASA POWER",
    status: "unavailable",
    provenance: "unavailable",
    limitation: "Connector is not implemented in this build.",
  },

  {
    id: "pvgis",
    name: "PVGIS",
    status: "unavailable",
    provenance: "unavailable",
    limitation: "Connector is not implemented in this build.",
  },

  {
    id: "nasa-battery",
    name: "NASA Li-ion aging files",
    status: "unavailable",
    provenance: "unavailable",
    limitation: "No user-supplied file has been imported.",
  },

  {
    id: "tariff",
    name: "Indian electricity tariff",
    status: "unavailable",
    provenance: "unavailable",
    limitation: "Official utility/region document has not been selected.",
  },

  {
    id: "carbon",
    name: "Indian grid carbon intensity",
    status: "unavailable",
    provenance: "unavailable",
    limitation: "Official factor version/geography has not been selected.",
  },
])
