/** Client-side import preprocessing: parsing, type detection, mapping and validation. Nothing is persisted. */
import { CANONICAL } from "../data/catalog";

export interface ParsedFile {
  columns: string[];
  rows: Record<string, string | number | null>[];
  format: "csv" | "json";
}
export type ColType = "number" | "timestamp" | "string" | "empty";

export function parseCSV(text: string): ParsedFile {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) throw new Error("The file is empty.");
  const split = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const columns = split(lines[0]);
  if (columns.some((c) => !c)) throw new Error("Header row has an empty column name.");
  const rows = lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(columns.map((c, i) => [c, cells[i] === undefined || cells[i] === "" ? null : cells[i]]));
  });
  return { columns, rows, format: "csv" };
}

export function parseJSON(text: string): ParsedFile {
  let data: unknown;
  try { data = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON: ${(e as Error).message}`); }
  const arr = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data as object).find(Array.isArray) : null;
  if (!arr || !arr.length) throw new Error("JSON must be an array of records (or an object containing one).");
  const columns = [...new Set(arr.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : [])))];
  const rows = arr.map((r) => Object.fromEntries(columns.map((c) => [c, (r as Record<string, unknown>)[c] ?? null])) as Record<string, string | number | null>);
  return { columns, rows, format: "json" };
}

export const DERIVED_TS = "timestamp (derived from YEAR/MO/DY/HR)";
export function parseFile(name: string, text: string): ParsedFile {
  const p = /\.json$/i.test(name) ? parseJSON(text) : /\.csv$/i.test(name) ? parseCSV(text) : null;
  if (!p) throw new Error("Unsupported file type. Use .csv or .json.");
  // NASA POWER-style exports split time into columns; offer a clearly labelled derived column (no offset assumed).
  const up = p.columns.map((c) => c.toUpperCase());
  if (["YEAR", "MO", "DY", "HR"].every((k) => up.includes(k))) {
    const col = (k: string) => p.columns[up.indexOf(k)];
    p.columns = [DERIVED_TS, ...p.columns];
    p.rows = p.rows.map((r) => ({ [DERIVED_TS]: `${r[col("YEAR")]}-${String(r[col("MO")]).padStart(2, "0")}-${String(r[col("DY")]).padStart(2, "0")}T${String(r[col("HR")]).padStart(2, "0")}:00:00`, ...r }));
  }
  return p;
}

const isTs = (v: string) => /\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));
export function detectType(rows: ParsedFile["rows"], col: string): ColType {
  const vals = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined).map(String);
  if (!vals.length) return "empty";
  const ok = (f: (v: string) => boolean) => vals.filter(f).length / vals.length >= 0.8;
  if (ok((v) => v !== "" && !Number.isNaN(Number(v)))) return "number";
  if (ok(isTs)) return "timestamp";
  return "string";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HINTS: Record<string, string[]> = {
  sessionId: ["sessionid", "session"], chargerId: ["stationid", "chargerid", "station", "evse"], vehicleId: ["vehicleid", "userid", "vin"],
  connectionAt: ["connectiontime", "start", "plugin"], disconnectionAt: ["disconnecttime", "disconnectiontime", "end", "unplug"],
  energyDeliveredKWh: ["kwhdelivered", "energy", "kwh"], powerKW: ["power", "kw"], batteryId: ["batteryid", "cellid", "battery"],
  cycle: ["cycle", "cyclecount"], voltageV: ["voltagemeasured", "voltage"], currentA: ["currentmeasured", "current"], temperatureC: ["temperaturemeasured", "temperature", "temp"],
  capacityAh: ["capacity"], irradianceWm2: ["allskysfcswdwn", "ghi", "irradiance"], ambientC: ["t2m", "ambient", "airtemp"], windMs: ["ws2m", "wind"],
  at: ["timestamp", "datetime", "time", "date"], price: ["price", "tariff"], intensity: ["carbonintensity", "intensity", "gco2"],
};
export function suggestMapping(category: string, columns: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const f of CANONICAL[category] ?? []) {
    const hits = HINTS[f.field] ?? [norm(f.field)];
    const col = columns.find((c) => hits.includes(norm(c))) ?? columns.find((c) => hits.some((h) => norm(c).includes(h)));
    if (col && !Object.values(m).includes(col)) m[f.field] = col;
  }
  return m;
}

export interface Issue { row: number; field: string; message: string; kind: "missing" | "invalid" }
export interface Validation {
  issues: Issue[];
  missingRequired: string[];
  validRows: number;
  totalRows: number;
  unmappedColumns: string[];
}
export function validate(category: string, parsed: ParsedFile, mapping: Record<string, string>, opts: { missingNumeric: "reject" | "keep-null"; sentinel?: number }): Validation {
  const spec = CANONICAL[category] ?? [];
  const missingRequired = spec.filter((f) => f.required && !mapping[f.field]).map((f) => f.label);
  const issues: Issue[] = [];
  const bad = new Set<number>();
  parsed.rows.forEach((r, i) => {
    for (const f of spec) {
      const col = mapping[f.field];
      if (!col) continue;
      let v = r[col];
      if (opts.sentinel !== undefined && Number(v) === opts.sentinel) v = null;
      if (v === null || v === undefined || v === "") {
        if (f.required && (f.type !== "number" || opts.missingNumeric === "reject")) { issues.push({ row: i + 1, field: f.label, message: "Missing required value", kind: "missing" }); bad.add(i); }
        else if (f.type === "number") issues.push({ row: i + 1, field: f.label, message: "Missing — kept as null (not zero-filled)", kind: "missing" });
        continue;
      }
      if (f.type === "number" && Number.isNaN(Number(v))) { issues.push({ row: i + 1, field: f.label, message: `“${v}” is not a number`, kind: "invalid" }); bad.add(i); }
      if (f.type === "number" && f.unit === "%" && (Number(v) < 0 || Number(v) > 100)) { issues.push({ row: i + 1, field: f.label, message: `${v}% outside 0–100`, kind: "invalid" }); bad.add(i); }
      if (f.type === "timestamp" && Number.isNaN(Date.parse(String(v)))) { issues.push({ row: i + 1, field: f.label, message: `“${v}” is not a valid timestamp`, kind: "invalid" }); bad.add(i); }
    }
    if (category === "Charging" && mapping.connectionAt && mapping.disconnectionAt) {
      const a = Date.parse(String(r[mapping.connectionAt])), b = Date.parse(String(r[mapping.disconnectionAt]));
      if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) { issues.push({ row: i + 1, field: "Disconnection time", message: "Disconnection is before connection", kind: "invalid" }); bad.add(i); }
    }
  });
  const used = new Set(Object.values(mapping));
  return { issues, missingRequired, validRows: parsed.rows.length - bad.size, totalRows: parsed.rows.length, unmappedColumns: parsed.columns.filter((c) => !used.has(c)) };
}
