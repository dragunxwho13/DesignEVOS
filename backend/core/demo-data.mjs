export const DEMO_VEHICLES = Object.freeze([
  {
    id: "BUS-01",
    vehicleClass: "Shuttle bus",
    usableBatteryCapacityKWh: 120,
    maxChargePowerKW: 30,
    currentSocPct: 34,
    requiredSocPct: 90,
    departureMinutes: 750,
    priority: "Critical",
    waitingMinutes: 45,
  },

  {
    id: "BUS-02",
    vehicleClass: "Shuttle bus",
    usableBatteryCapacityKWh: 120,
    maxChargePowerKW: 30,
    currentSocPct: 52,
    requiredSocPct: 90,
    departureMinutes: 960,
    priority: "Normal",
    waitingMinutes: 30,
  },

  {
    id: "BUS-03",
    vehicleClass: "Shuttle bus",
    usableBatteryCapacityKWh: 120,
    maxChargePowerKW: 30,
    currentSocPct: 28,
    requiredSocPct: 85,
    departureMinutes: 1050,
    priority: "Critical",
    waitingMinutes: 60,
  },

  {
    id: "VAN-01",
    vehicleClass: "Service van",
    usableBatteryCapacityKWh: 60,
    maxChargePowerKW: 30,
    currentSocPct: 38,
    requiredSocPct: 85,
    departureMinutes: 720,
    priority: "Normal",
    waitingMinutes: 20,
  },

  {
    id: "VAN-02",
    vehicleClass: "Service van",
    usableBatteryCapacityKWh: 60,
    maxChargePowerKW: 30,
    currentSocPct: 55,
    requiredSocPct: 85,
    departureMinutes: 990,
    priority: "Low",
    waitingMinutes: 15,
  },

  {
    id: "CRT-01",
    vehicleClass: "Utility cart",
    usableBatteryCapacityKWh: 12,
    maxChargePowerKW: 3.3,
    currentSocPct: 40,
    requiredSocPct: 80,
    departureMinutes: 720,
    priority: "Normal",
    waitingMinutes: 30,
  },

  {
    id: "CRT-02",
    vehicleClass: "Utility cart",
    usableBatteryCapacityKWh: 12,
    maxChargePowerKW: 3.3,
    currentSocPct: 22,
    requiredSocPct: 80,
    departureMinutes: 810,
    priority: "Normal",
    waitingMinutes: 50,
  },
])

export const DEMO_CHARGERS = Object.freeze([
  {
    id: "DC-1",
    type: "DC",
    ratedPowerKW: 30,
    compatibleClasses: ["Shuttle bus", "Service van"],
    available: true,
  },

  {
    id: "DC-2",
    type: "DC",
    ratedPowerKW: 30,
    compatibleClasses: ["Shuttle bus", "Service van"],
    available: true,
  },

  {
    id: "AC-1",
    type: "AC",
    ratedPowerKW: 7.4,
    compatibleClasses: ["Service van", "Utility cart"],
    available: true,
  },

  {
    id: "AC-2",
    type: "AC",
    ratedPowerKW: 7.4,
    compatibleClasses: ["Service van", "Utility cart"],
    available: true,
  },
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
