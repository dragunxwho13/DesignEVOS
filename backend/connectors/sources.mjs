const DEFAULT_NASA_POWER_BASE_URL = "https://power.larc.nasa.gov/api/temporal"

const DEFAULT_PVGIS_BASE_URL = "https://re.jrc.ec.europa.eu/api/v5_3"

const DEFAULT_ACN_BASE_URL = "https://ev.caltech.edu/api/v1"

import { cached } from "../core/cache.mjs"

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required`)

  return value
}

async function fetchJson(url, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(15000),
  })

  if (!response.ok)
    throw new Error(`Source request failed with HTTP ${response.status}`)

  return response.json()
}

function sourceResult(source, status, data, extra = {}) {
  return {
    source,
    status,
    provenance: status === "connected" ? "current_api" : "unavailable",
    data,
    usable: data !== null && data !== undefined,
    ...extra,
  }
}

export function normalizeAcnSessions(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?._items)
      ? data._items
      : Array.isArray(data?.items)
        ? data.items
        : []

  const energy = rows
    .map((row) =>
      Number(row.kWhDelivered ?? row.energyDeliveredKWh ?? row.energy ?? 0),
    )
    .filter((value) => Number.isFinite(value) && value >= 0)

  const stations = new Set(
    rows
      .map((row) => row.stationID ?? row.stationId ?? row.chargerId)
      .filter(Boolean),
  )

  const times = rows
    .flatMap((row) => [
      row.connectionTime ?? row.connectionAt,
      row.disconnectTime ?? row.disconnectionAt,
    ])
    .map((value) => Date.parse(String(value)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)

  return {
    recordCount: rows.length,

    totalDeliveredKWh: energy.reduce((sum, value) => sum + value, 0),

    averageSessionEnergyKWh: energy.length
      ? energy.reduce((sum, value) => sum + value, 0) / energy.length
      : null,

    stationCount: stations.size,

    period: times.length
      ? {
          from: new Date(times[0]).toISOString(),
          to: new Date(times.at(-1)).toISOString(),
        }
      : null,

    identityMapping: "none",

    limitation:
      "Historical ACN identifiers are retained; records are not assigned to EVOS vehicle IDs.",
  }
}

export async function fetchAcnSessions({
  site = "caltech",

  start,

  end,

  token = process.env.ACN_DATA_API_KEY,

  baseUrl = process.env.ACN_DATA_BASE_URL || DEFAULT_ACN_BASE_URL,

  fetchImpl = fetch,
} = {}) {
  if (!token)
    return sourceResult("ACN-Data", "unconfigured", null, {
      limitation: "ACN_DATA_API_KEY is not configured server-side.",
    })

  const url = new URL(
    `${baseUrl.replace(/\/$/, "")}/sessions/${encodeURIComponent(site)}`,
  )

  if (start) url.searchParams.set("where", `connectionTime>=\\"${start}\\"`)

  if (end)
    url.searchParams.set(
      "where",
      `${
        url.searchParams.get("where")
          ? `${url.searchParams.get("where")} and `
          : ""
      }connectionTime<=\\"${end}\\"`,
    )

  url.searchParams.set("pretty", "false")

  const auth = Buffer.from(`${token}:`).toString("base64")

  const result = await cached(
    `acn:${url}`,
    () =>
      fetchJson(
        url,
        { headers: { Authorization: `Basic ${auth}` } },
        fetchImpl,
      ),
    300_000,
  )

  return sourceResult("ACN-Data", "connected", result.value, {
    site,
    fetchedAt: result.fetchedAt,
    cache: result.cached ? "hit" : "miss",
    normalized: normalizeAcnSessions(result.value),
    usable: normalizeAcnSessions(result.value).recordCount > 0,
  })
}

export async function fetchNasaPowerPoint({
  latitude,

  longitude,

  start,

  end,

  parameters = ["ALLSKY_SFC_SW_DWN", "T2M"],

  temporal = "hourly",

  community = "RE",

  timeStandard = "UTC",

  baseUrl = process.env.NASA_POWER_BASE_URL || DEFAULT_NASA_POWER_BASE_URL,

  fetchImpl = fetch,
} = {}) {
  requireValue("latitude", latitude)

  requireValue("longitude", longitude)

  requireValue("start", start)

  requireValue("end", end)

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${temporal}/point`)

  url.searchParams.set("parameters", parameters.join(","))

  url.searchParams.set("community", community)

  url.searchParams.set("longitude", String(longitude))

  url.searchParams.set("latitude", String(latitude))

  url.searchParams.set("start", String(start))

  url.searchParams.set("end", String(end))

  url.searchParams.set("format", "JSON")

  url.searchParams.set("time-standard", timeStandard)

  const result = await cached(
    `nasa-power:${url}`,
    () => fetchJson(url, {}, fetchImpl),
    300_000,
  )

  const data = result.value

  if (!data?.properties?.parameter)
    throw new Error("NASA POWER response is missing properties.parameter")

  // Solar irradiance lags other NASA POWER fields by several days, so judge usability on it when
  // requested; otherwise valid temperature values would hide a day of -999 irradiance fill values.
  const solarSeries = data.properties.parameter.ALLSKY_SFC_SW_DWN
  const observations = (
    solarSeries && typeof solarSeries === "object"
      ? [solarSeries]
      : Object.values(data.properties.parameter)
  ).flatMap((series) => (series && typeof series === "object" ? Object.values(series) : []))
  const usable = observations.some(
    (value) => Number.isFinite(Number(value)) && Number(value) > -900,
  )

  return sourceResult("NASA POWER", "connected", data, {
    observedAt: data.header?.fill_value ?? null,
    fetchedAt: result.fetchedAt,
    cache: result.cached ? "hit" : "miss",
    units: data.parameters ?? null,
    usable,
    limitation: usable
      ? undefined
      : "NASA POWER responded, but the requested period contains no usable observations.",
  })
}

export async function fetchPvgisSeries({
  latitude,

  longitude,

  peakPowerKW,

  loss = 14,

  startYear,

  endYear,

  angle = 35,

  aspect = 0,

  baseUrl = process.env.PVGIS_BASE_URL || DEFAULT_PVGIS_BASE_URL,

  fetchImpl = fetch,
} = {}) {
  for (const [name, value] of Object.entries({
    latitude,
    longitude,
    peakPowerKW,
    startYear,
    endYear,
  }))
    requireValue(name, value)

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/seriescalc`)

  for (const [key, value] of Object.entries({
    lat: latitude,
    lon: longitude,
    peakpower: peakPowerKW,
    loss,
    startyear: startYear,
    endyear: endYear,
    angle,
    aspect,
    pvtechchoice: "crystSi",
    mountingplace: "free",
    pvcalculation: 1,
    outputformat: "json",
  })) {
    url.searchParams.set(key, String(value))
  }

  const result = await cached(
    `pvgis:${url}`,
    () => fetchJson(url, {}, fetchImpl),
    86_400_000,
  )

  return sourceResult("PVGIS", "connected", result.value, {
    fetchedAt: result.fetchedAt,
    cache: result.cached ? "hit" : "miss",
    statusNote:
      "PVGIS is a modelled/historical estimate, not live PV meter telemetry.",
    provenance: "modelled_api",
    usable: Array.isArray(result.value?.outputs?.hourly)
      ? result.value.outputs.hourly.length > 0
      : Boolean(result.value),
  })
}

export async function fetchSourceStatuses({
  acn = {},
  nasaPower = {},
  pvgis = {},
} = {}) {
  const results = []

  for (const operation of [
    () => fetchAcnSessions(acn),

    () => fetchNasaPowerPoint(nasaPower),

    () => fetchPvgisSeries(pvgis),
  ]) {
    try {
      results.push(await operation())
    } catch (error) {
      results.push(
        sourceResult("external-source", "unavailable", null, {
          limitation:
            error instanceof Error ? error.message : "Source request failed",
        }),
      )
    }
  }

  return results
}
