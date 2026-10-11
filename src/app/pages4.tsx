import { useCallback, useMemo, useRef, useState } from "react"
import {
  Upload,
  FileText,
  ExternalLink,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { PageHeader } from "./Shell"
import {
  Panel,
  Badge,
  Button,
  Tabs,
  Field,
  inputCls,
  cx,
  ProvBadge,
  Disclosure,
  Empty,
  InfoTip,
  Spinner,
  Segmented,
} from "../components/ui"
import {
  EXTERNAL_SOURCES,
  CANONICAL,
  SAMPLE_FILES,
  INTERNAL_DATASETS,
} from "../data/catalog"
import { backendStatus } from "../services"
import { useStore } from "../lib/store"
import {
  parseFile,
  detectType,
  suggestMapping,
  validate,
  type ParsedFile,
  type Validation,
} from "../lib/importer"

const MAX_BYTES = 10 * 1024 * 1024
const CATS = Object.keys(CANONICAL)
const TZ = [
  "Asia/Kolkata",
  "UTC",
  "America/Los_Angeles",
  "Europe/Amsterdam",
  "America/Chicago",
]

interface HistoryItem {
  id: string
  name: string
  category: string
  rows: number
  valid: number
  at: string
  status: "Validated (session only)" | "Validation failed" | "Cancelled"
}

export function Datasets() {
  const [tab, setTab] = useState<"sources" | "import" | "internal">("sources")
  const [presetCat, setPresetCat] = useState<string | undefined>()
  const bs = backendStatus()
  const { live } = useStore()
  const connectedSource = live?.sources.some(
    (source) => source.status === "connected" && source.usable,
  )
  return (
    <>
      <PageHeader
        title="Datasets & data sources"
        sub="Where EVOS data will come from, how files are mapped to EVOS fields, and what is connected today."
      />
      <div
        role="status"
        className="mb-5 flex flex-col items-start gap-2 rounded-xl sm:flex-row sm:gap-3 border border-line bg-white px-5 py-4 text-sm"
      >
        <ProvBadge p={connectedSource ? "real" : "not-connected"} />
        <p className="flex-1 text-muted">
          <b className="font-medium text-ink">
            {connectedSource
              ? "Live dataset response mapped."
              : live
                ? "Backend responded; no usable dataset response yet."
                : "Backend: not connected."}
          </b>{" "}
          {connectedSource
            ? "At least one configured dataset returned a usable response; each source below shows its actual status and provenance."
            : `${bs.message} Imports below are parsed and validated in your browser only and are not saved.`}
        </p>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { v: "sources", label: "External sources" },
          { v: "import", label: "Import data" },
          { v: "internal", label: "EVOS datasets & contracts" },
        ]}
      />
      <div key={tab} className="fade-in mt-5">
        {tab === "sources" && (
          <Sources
            onImport={(c) => {
              setPresetCat(c)
              setTab("import")
            }}
          />
        )}
        {tab === "import" && <Importer presetCat={presetCat} />}
        {tab === "internal" && <Internal />}
      </div>
    </>
  )
}

const catMap: Record<string, string> = {
  Charging: "Charging",
  Battery: "Battery",
  "Solar & weather": "Solar & weather",
  Tariff: "Tariff",
  "Grid carbon": "Grid carbon",
  Energy: "Charging",
}
function Sources({ onImport }: { onImport: (cat: string) => void }) {
  const { live } = useStore()
  const [filter, setFilter] = useState("All")
  const list = EXTERNAL_SOURCES.filter(
    (s) =>
      filter === "All" ||
      s.priority === filter ||
      (filter === "Essential" && s.priority === "Required"),
  )
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Filter by priority"
          value={filter}
          onChange={setFilter}
          options={[
            { v: "All", label: "All" },
            { v: "Essential", label: "Essential" },
            { v: "Recommended", label: "Recommended" },
            { v: "Optional", label: "Optional" },
          ]}
        />
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {list.map((s) => (
          <li
            key={s.id}
            className="flex flex-col rounded-xl border border-line bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold leading-snug">{s.name}</h3>
                <p className="mt-1 text-sm text-muted">{s.use}</p>
              </div>
              <Badge
                tone={
                  s.priority === "Essential" || s.priority === "Required"
                    ? "info"
                    : "neutral"
                }
              >
                {s.priority}
              </Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                ["Category", s.category],
                ["Status", sourceStatus(s.id, live)],
                ["Last import", sourceFetchedAt(s.id, live)],
                ["Records", sourceRecords(s.id, live)],
                ["Data period", sourcePeriod(s.id, live)],
                ["Quality", sourceQuality(s.id, live)],
                ["Access", s.access],
                ["Attribution", s.attribution],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {s.priorityNote && (
              <p className="mt-3 text-xs text-muted">Note: {s.priorityNote}.</p>
            )}
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onImport(catMap[s.category])}
              >
                <Upload size={14} />
                Import a file
              </Button>
              {s.docsUrl ? (
                <a
                  href={s.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:bg-soft hover:text-ink"
                >
                  Documentation
                  <ExternalLink size={13} aria-hidden />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              ) : (
                <span className="inline-flex h-9 items-center px-3 text-xs text-muted">
                  Source not yet selected
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={!live}
                title={
                  live
                    ? "Source connection is managed by the configured backend"
                    : "Configure the backend to connect this source"
                }
              >
                API status
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Source status is read from the configured backend when available. File
        imports are validated locally for this prototype and are not persisted.
      </p>
    </>
  )
}

function sourceResult(id: string, live: ReturnType<typeof useStore>["live"]) {
  if (!live) return null
  if (id === "acn")
    return live.sources.find((source) => source.source === "ACN-Data")
  if (id === "nasa-power")
    return live.sources.find((source) => source.source === "NASA POWER")
  if (id === "pvgis")
    return live.sources.find((source) => source.source === "PVGIS")
  return null
}
function sourceStatus(id: string, live: ReturnType<typeof useStore>["live"]) {
  const source = sourceResult(id, live)
  if (!source) return "Not connected"
  if (source.status === "connected" && source.usable === false)
    return "Connected · no usable records"
  return source.status
}
function sourceFetchedAt(
  id: string,
  live: ReturnType<typeof useStore>["live"],
) {
  const value = sourceResult(id, live)?.fetchedAt
  return value ? new Date(value).toLocaleString() : "Not available"
}
function sourceRecords(id: string, live: ReturnType<typeof useStore>["live"]) {
  if (id === "acn")
    return (
      live?.parameters.acnHistoricalBaseline?.recordCount?.toString() ??
      "Not available"
    )
  return sourceResult(id, live)?.data ? "Received" : "Not available"
}
function sourcePeriod(id: string, live: ReturnType<typeof useStore>["live"]) {
  const period = live?.parameters.acnHistoricalBaseline?.period
  return id === "acn" && period
    ? `${period.from.slice(0, 10)} → ${period.to.slice(0, 10)}`
    : "Source-defined"
}
function sourceQuality(id: string, live: ReturnType<typeof useStore>["live"]) {
  const result = sourceResult(id, live)
  return (
    result?.limitation ??
    (result ? "Validated response" : "Awaiting connection")
  )
}

type Step = 0 | 1 | 2 | 3 | 4
const STEPS_L = [
  "Choose file",
  "Describe",
  "Map columns",
  "Validate",
  "Process",
]

function Importer({ presetCat }: { presetCat?: string }) {
  const [step, setStep] = useState<Step>(0)
  const [fileName, setFileName] = useState("")
  const [fileSize, setFileSize] = useState(0)
  const [isSample, setIsSample] = useState(false)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [meta, setMeta] = useState({
    category: presetCat ?? "Charging",
    name: "",
    description: "",
    url: "",
    licence: "",
    from: "",
    to: "",
    tz: "Asia/Kolkata",
    energyUnit: "kWh",
    powerUnit: "kW",
  })
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<"reject" | "keep-null">("keep-null")
  const [sentinel, setSentinel] = useState("-999")
  const [val, setVal] = useState<Validation | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [done, setDone] = useState<{ rows: Record<string, unknown>[] } | null>(
    null,
  )
  const cancelRef = useRef(false)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("evos-imports") || "[]")
    } catch {
      return []
    }
  })
  const pushHistory = (h: HistoryItem) => {
    const n = [h, ...history].slice(0, 10)
    setHistory(n)
    sessionStorage.setItem("evos-imports", JSON.stringify(n))
  }
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(
    (
      name: string,
      size: number,
      text: string,
      sample: boolean,
      cat?: string,
    ) => {
      setErr(null)
      if (size > MAX_BYTES) {
        setErr(
          `File is ${(size / 1048576).toFixed(1)} MB; the browser preview limit is 10 MB.`,
        )
        return
      }
      try {
        const p = parseFile(name, text)
        setParsed(p)
        setFileName(name)
        setFileSize(size)
        setIsSample(sample)
        const category = cat ?? meta.category
        setMeta((m) => ({
          ...m,
          category,
          name: m.name || name.replace(/\.(csv|json)$/i, ""),
        }))
        setMapping(suggestMapping(category, p.columns))
        setVal(null)
        setDone(null)
        setStep(1)
      } catch (e) {
        setErr((e as Error).message)
      }
    },
    [meta.category],
  )

  const onFile = (f?: File | null) => {
    if (!f) return
    if (!/\.(csv|json)$/i.test(f.name)) {
      setErr(`“${f.name}” is not supported. Use a .csv or .json file.`)
      return
    }
    const r = new FileReader()
    r.onload = () => load(f.name, f.size, String(r.result), false)
    r.onerror = () =>
      setErr("The file could not be read. Try again or choose another file.")
    r.readAsText(f)
  }
  const reset = () => {
    setStep(0)
    setParsed(null)
    setFileName("")
    setErr(null)
    setVal(null)
    setProgress(null)
    setDone(null)
    setMapping({})
    setMeta((m) => ({
      ...m,
      name: "",
      description: "",
      url: "",
      licence: "",
      from: "",
      to: "",
    }))
  }

  const urlErr =
    meta.url && !/^https?:\/\/\S+\.\S+/.test(meta.url)
      ? "Enter a full URL starting with http:// or https://"
      : undefined
  const periodErr =
    meta.from && meta.to && meta.to < meta.from
      ? "End date is before start date"
      : undefined
  const nameErr = !meta.name.trim() ? "Give the dataset a name" : undefined

  const types = useMemo(
    () =>
      parsed
        ? Object.fromEntries(
            parsed.columns.map((c) => [c, detectType(parsed.rows, c)]),
          )
        : {},
    [parsed],
  )
  const spec = CANONICAL[meta.category] ?? []

  const runValidation = () => {
    if (!parsed) return
    setVal(
      validate(meta.category, parsed, mapping, {
        missingNumeric: missing,
        sentinel: sentinel.trim() === "" ? undefined : Number(sentinel),
      }),
    )
    setStep(3)
  }

  const normalize = (r: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const f of spec) {
      const col = mapping[f.field]
      if (!col) continue
      let v = r[col] as string | number | null
      if (sentinel.trim() !== "" && Number(v) === Number(sentinel)) v = null
      if (v === null || v === "") {
        out[f.field] = null
        continue
      }
      if (f.type === "number") {
        let n = Number(v)
        if (f.unit === "kWh" && meta.energyUnit === "Wh") n /= 1000
        if (f.unit === "kW" && meta.powerUnit === "W") n /= 1000
        out[f.field] = Number.isNaN(n) ? null : n
      } else if (f.type === "timestamp") {
        const s = String(v)
        const hasOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s)
        const d = new Date(hasOffset ? s : s) // without offset, interpreted per selected timezone note below
        out[f.field] = Number.isNaN(d.getTime())
          ? null
          : hasOffset
            ? d.toISOString()
            : `${s} (${meta.tz}, offset not in file)`
      } else out[f.field] = v
    }
    return out
  }

  const process = () => {
    if (!parsed || !val) return
    cancelRef.current = false
    setStep(4)
    setProgress(0)
    const rows: Record<string, unknown>[] = []
    const chunk = Math.max(1, Math.ceil(parsed.rows.length / 10))
    let i = 0
    const tick = () => {
      if (cancelRef.current) {
        setProgress(null)
        pushHistory({
          id: `IMP-${Date.now()}`,
          name: meta.name,
          category: meta.category,
          rows: parsed.rows.length,
          valid: 0,
          at: new Date().toLocaleString(),
          status: "Cancelled",
        })
        setStep(3)
        return
      }
      parsed.rows.slice(i, i + chunk).forEach((r) => rows.push(normalize(r)))
      i += chunk
      setProgress(Math.min(100, Math.round((i / parsed.rows.length) * 100)))
      if (i < parsed.rows.length) setTimeout(tick, 16)
      else {
        setDone({ rows })
        pushHistory({
          id: `IMP-${Date.now()}`,
          name: meta.name,
          category: meta.category,
          rows: parsed.rows.length,
          valid: val.validRows,
          at: new Date().toLocaleString(),
          status: val.missingRequired.length
            ? "Validation failed"
            : "Validated (session only)",
        })
      }
    }
    setTimeout(tick, 16)
  }

  const canNext1 = !nameErr && !urlErr && !periodErr
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Panel
        title="Import workflow"
        sub="CSV or JSON · up to 10 MB · processed locally in this browser"
        className="min-w-0"
      >
        <ol
          className="mb-6 flex flex-wrap gap-x-1 gap-y-2"
          aria-label="Import steps"
        >
          {STEPS_L.map((l, i) => (
            <li
              key={l}
              className="flex items-center gap-1 text-xs"
              aria-current={i === step ? "step" : undefined}
            >
              <span
                className={cx(
                  "tnum grid h-6 w-6 place-items-center rounded-full border text-[11px] transition-colors duration-200",
                  i < step
                    ? "border-teal bg-teal text-white"
                    : i === step
                      ? "border-ink text-ink"
                      : "border-line text-muted",
                )}
              >
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <span
                className={cx(
                  "mr-2",
                  i === step ? "font-medium text-ink" : "text-muted",
                )}
              >
                {l}
              </span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="fade-in space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                onFile(e.dataTransfer.files[0])
              }}
              className={cx(
                "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-150",
                drag ? "border-cyan bg-mint/40" : "border-line",
              )}
            >
              <Upload size={22} className="text-muted" aria-hidden />
              <p className="mt-3 font-medium">Drag a CSV or JSON file here</p>
              <p className="mt-1 text-sm text-muted">or</p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="sr-only"
                aria-label="Choose a CSV or JSON file"
                onChange={(e) => {
                  onFile(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
              <p className="mt-3 text-xs text-muted">
                Supported: .csv (comma-separated, header row) · .json (array of
                records) · max 10 MB
              </p>
            </div>
            {err && (
              <p
                role="alert"
                className="rounded-lg bg-[#f6e3e2] px-4 py-3 text-sm text-err"
              >
                {err}
              </p>
            )}
            <div>
              <p className="text-sm font-medium">
                No file yet? Try a labelled sample
              </p>
              <p className="text-xs text-muted">
                Synthetic examples shaped like typical source exports. They are
                not real data and include deliberate errors.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SAMPLE_FILES.map((f) => (
                  <Button
                    key={f.name}
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      load(
                        f.name,
                        f.content.length,
                        f.content,
                        true,
                        f.category,
                      )
                    }
                  >
                    <FileText size={14} />
                    {f.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && parsed && (
          <div className="fade-in space-y-5">
            <FileSummary
              name={fileName}
              size={fileSize}
              rows={parsed.rows.length}
              cols={parsed.columns.length}
              sample={isSample}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="im-cat"
                label="Dataset category"
                help="Determines the EVOS fields to map to"
              >
                <select
                  id="im-cat"
                  className={inputCls}
                  value={meta.category}
                  onChange={(e) => {
                    setMeta({ ...meta, category: e.target.value })
                    setMapping(suggestMapping(e.target.value, parsed.columns))
                  }}
                >
                  {CATS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field id="im-name" label="Dataset name" error={nameErr}>
                <input
                  id="im-name"
                  className={inputCls}
                  value={meta.name}
                  aria-invalid={!!nameErr}
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="im-desc" label="Description (optional)">
                  <textarea
                    id="im-desc"
                    rows={2}
                    className={cx(inputCls, "h-auto py-2")}
                    value={meta.description}
                    onChange={(e) =>
                      setMeta({ ...meta, description: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                id="im-url"
                label="Source URL or citation"
                error={urlErr}
                help="Where the data came from"
              >
                <input
                  id="im-url"
                  className={inputCls}
                  value={meta.url}
                  aria-invalid={!!urlErr}
                  placeholder="https://"
                  onChange={(e) => setMeta({ ...meta, url: e.target.value })}
                />
              </Field>
              <Field id="im-lic" label="Licence / usage notes">
                <input
                  id="im-lic"
                  className={inputCls}
                  value={meta.licence}
                  placeholder="e.g. CC BY 4.0, academic use only"
                  onChange={(e) =>
                    setMeta({ ...meta, licence: e.target.value })
                  }
                />
              </Field>
              <Field id="im-from" label="Data period start">
                <input
                  id="im-from"
                  type="date"
                  className={inputCls}
                  value={meta.from}
                  onChange={(e) => setMeta({ ...meta, from: e.target.value })}
                />
              </Field>
              <Field id="im-to" label="Data period end" error={periodErr}>
                <input
                  id="im-to"
                  type="date"
                  className={inputCls}
                  value={meta.to}
                  aria-invalid={!!periodErr}
                  onChange={(e) => setMeta({ ...meta, to: e.target.value })}
                />
              </Field>
              <Field id="im-tz" label="Timezone for timestamps without offset">
                <select
                  id="im-tz"
                  className={inputCls}
                  value={meta.tz}
                  onChange={(e) => setMeta({ ...meta, tz: e.target.value })}
                >
                  {TZ.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="im-eu" label="Energy unit">
                  <select
                    id="im-eu"
                    className={inputCls}
                    value={meta.energyUnit}
                    onChange={(e) =>
                      setMeta({ ...meta, energyUnit: e.target.value })
                    }
                  >
                    <option>kWh</option>
                    <option>Wh</option>
                  </select>
                </Field>
                <Field id="im-pu" label="Power unit">
                  <select
                    id="im-pu"
                    className={inputCls}
                    value={meta.powerUnit}
                    onChange={(e) =>
                      setMeta({ ...meta, powerUnit: e.target.value })
                    }
                  >
                    <option>kW</option>
                    <option>W</option>
                  </select>
                </Field>
              </div>
            </div>
            <Nav
              back={reset}
              backLabel="Choose another file"
              next={() => setStep(2)}
              nextDisabled={!canNext1}
              nextLabel="Map columns"
            />
          </div>
        )}

        {step === 2 && parsed && (
          <div className="fade-in space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Preview · first {Math.min(5, parsed.rows.length)} of{" "}
                {parsed.rows.length} rows
              </h3>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-soft text-left">
                    <tr>
                      {parsed.columns.map((c) => (
                        <th
                          key={c}
                          className="px-3 py-2 font-medium whitespace-nowrap"
                        >
                          {c}
                          <span className="ml-1.5 font-normal text-muted">
                            {types[c]}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {parsed.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {parsed.columns.map((c) => (
                          <td
                            key={c}
                            className="tnum px-3 py-1.5 whitespace-nowrap"
                          >
                            {r[c] === null ? (
                              <span className="text-err">empty</span>
                            ) : (
                              String(r[c])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                Map to EVOS {meta.category.toLowerCase()} fields
              </h3>
              <p className="mb-3 text-xs text-muted">
                Suggestions are based on column names only — check each one.
                Unmapped optional fields stay empty; nothing is fabricated.
              </p>
              <div className="divide-y divide-line rounded-lg border border-line">
                {spec.map((f) => {
                  const col = mapping[f.field]
                  const t = col ? types[col] : undefined
                  const mismatch =
                    col &&
                    t !== "empty" &&
                    ((f.type === "number" && t !== "number") ||
                      (f.type === "timestamp" && t !== "timestamp"))
                  return (
                    <div
                      key={f.field}
                      className="grid items-center gap-2 px-4 py-2.5 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <label htmlFor={`map-${f.field}`} className="text-sm">
                        <span className="font-medium">{f.label}</span>
                        {f.unit && (
                          <span className="text-muted"> ({f.unit})</span>
                        )}
                        {f.required && (
                          <span className="ml-1.5 text-[11px] text-err">
                            required
                          </span>
                        )}
                      </label>
                      <select
                        id={`map-${f.field}`}
                        className={cx(inputCls, "h-9")}
                        value={col ?? ""}
                        onChange={(e) => {
                          const m = { ...mapping }
                          if (e.target.value) m[f.field] = e.target.value
                          else delete m[f.field]
                          setMapping(m)
                        }}
                      >
                        <option value="">— Not mapped —</option>
                        {parsed.columns.map((c) => (
                          <option key={c} value={c}>
                            {c} ({types[c]})
                          </option>
                        ))}
                      </select>
                      <span className="text-xs sm:w-28 sm:text-right">
                        {!col ? (
                          f.required ? (
                            <span className="text-err">▲ Missing</span>
                          ) : (
                            <span className="text-muted">Optional</span>
                          )
                        ) : mismatch ? (
                          <span className="text-[#8a5f1f]">◆ Type is {t}</span>
                        ) : (
                          <span className="text-ok">✓ Mapped</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium">
                  Missing numeric values in required fields
                </p>
                <Segmented
                  label="Missing value handling"
                  value={missing}
                  onChange={setMissing}
                  options={[
                    { v: "keep-null", label: "Keep as null" },
                    { v: "reject", label: "Reject row" },
                  ]}
                />
              </div>
              <Field
                id="im-sent"
                label="Missing-value sentinel"
                help="e.g. NASA POWER uses −999. Leave blank if none."
              >
                <input
                  id="im-sent"
                  className={inputCls}
                  value={sentinel}
                  onChange={(e) => setSentinel(e.target.value)}
                />
              </Field>
            </div>
            <Nav
              back={() => setStep(1)}
              next={runValidation}
              nextLabel="Validate"
            />
          </div>
        )}

        {step === 3 && parsed && val && (
          <div className="fade-in space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Rows", val.totalRows],
                ["Valid rows", val.validRows],
                [
                  "Invalid values",
                  val.issues.filter((x) => x.kind === "invalid").length,
                ],
                [
                  "Missing values",
                  val.issues.filter((x) => x.kind === "missing").length,
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-soft px-4 py-3">
                  <div className="text-xs text-muted">{k}</div>
                  <div className="tnum text-xl font-semibold">{v}</div>
                </div>
              ))}
            </div>
            {val.missingRequired.length > 0 && (
              <p
                role="alert"
                className="rounded-lg bg-[#f6e3e2] px-4 py-3 text-sm text-err"
              >
                ▲ Required fields not mapped: {val.missingRequired.join(", ")}.
                Go back and map them, or the dataset cannot be used for this
                category.
              </p>
            )}
            {val.unmappedColumns.length > 0 && (
              <p className="text-sm text-muted">
                Columns not used: {val.unmappedColumns.join(", ")} — they will
                be ignored, not discarded from the source.
              </p>
            )}
            {val.issues.length ? (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-soft text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Field</th>
                      <th className="px-3 py-2 font-medium">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {val.issues.slice(0, 50).map((x, i) => (
                      <tr key={i}>
                        <td className="tnum px-3 py-1.5">{x.row}</td>
                        <td className="px-3 py-1.5">{x.field}</td>
                        <td
                          className={cx(
                            "px-3 py-1.5",
                            x.kind === "invalid"
                              ? "text-err"
                              : "text-[#8a5f1f]",
                          )}
                        >
                          {x.kind === "invalid" ? "▲" : "◆"} {x.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg bg-[#e3f2ec] px-4 py-3 text-sm text-ok">
                ✓ No issues found in mapped fields.
              </p>
            )}
            <Nav
              back={() => setStep(2)}
              backLabel="Adjust mapping"
              next={process}
              nextDisabled={
                val.missingRequired.length > 0 || val.validRows === 0
              }
              nextLabel="Process in browser"
            />
          </div>
        )}

        {step === 4 && (
          <div className="fade-in space-y-5" aria-live="polite">
            {!done ? (
              <div className="space-y-3">
                <Spinner label={`Normalising rows… ${progress ?? 0}%`} />
                <div className="h-1.5 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-1.5 rounded-full bg-cyan transition-[width] duration-150"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => (cancelRef.current = true)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-line bg-soft px-4 py-3 text-sm">
                  <p className="font-medium text-ink">
                    Validated and normalised in this browser session — not
                    saved.
                  </p>
                  <p className="mt-1 text-muted">
                    {val?.validRows} of {val?.totalRows} rows passed. No data
                    was uploaded or stored; connect a backend to persist
                    imports. Values from this file would be labelled{" "}
                    <b>Imported data</b>
                    {isSample &&
                      " — but this was a synthetic sample, so it is labelled Demo preview"}
                    .
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Normalised preview (canonical EVOS fields)
                  </h3>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-deep p-4 text-[11px] leading-relaxed text-white/85">
                    {JSON.stringify(done.rows.slice(0, 3), null, 2)}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={reset}>Import another file</Button>
                  <Button
                    variant="secondary"
                    disabled
                    title="Requires a configured backend"
                  >
                    Save to backend
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Panel>
      <Panel title="Import history" sub="This browser session only">
        {history.length ? (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="py-3 text-sm first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium break-all">{h.name}</span>
                  <Badge
                    tone={
                      h.status.startsWith("Validated")
                        ? "ok"
                        : h.status === "Cancelled"
                          ? "neutral"
                          : "err"
                    }
                  >
                    {h.status === "Validated (session only)"
                      ? "Validated"
                      : h.status}
                  </Badge>
                </div>
                <div className="tnum mt-0.5 text-xs text-muted">
                  {h.category} · {h.valid}/{h.rows} valid · {h.at}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No imports yet">
            Validated files appear here. Nothing is persisted.
          </Empty>
        )}
      </Panel>
    </div>
  )
}

function FileSummary({
  name,
  size,
  rows,
  cols,
  sample,
}: {
  name: string
  size: number
  rows: number
  cols: number
  sample: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-soft px-4 py-3 text-sm">
      <FileText size={16} className="text-muted" aria-hidden />
      <span className="font-medium break-all">{name}</span>
      <span className="tnum text-muted">
        {size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`} · {rows}{" "}
        rows · {cols} columns
      </span>
      {sample ? <ProvBadge p="demo" /> : <ProvBadge p="imported" />}
    </div>
  )
}

function Nav({
  back,
  next,
  nextLabel,
  backLabel = "Back",
  nextDisabled,
}: {
  back: () => void
  next: () => void
  nextLabel: string
  backLabel?: string
  nextDisabled?: boolean
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
      <Button variant="ghost" onClick={back}>
        <ArrowLeft size={15} />
        {backLabel}
      </Button>
      <Button onClick={next} disabled={nextDisabled}>
        {nextLabel}
        <ArrowRight size={15} />
      </Button>
    </div>
  )
}

function Internal() {
  const [q, setQ] = useState("")
  const list = INTERNAL_DATASETS.filter((d) =>
    `${d.name} ${d.description} ${d.fields.map((f) => f.name).join(" ")}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  )
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="int-q" className="sr-only">
          Search datasets and fields
        </label>
        <input
          id="int-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search datasets or field names"
          className={cx(inputCls, "max-w-sm")}
        />
        <span className="text-xs text-muted">
          {list.length} of {INTERNAL_DATASETS.length} datasets
        </span>
        <InfoTip label="Internal datasets">
          These describe the proposed EVOS campus simulation. Their
          classification states whether the demo currently generates them
          (Simulated), uses fixed illustrative values (Demo preview) or does not
          produce them yet (Not connected).
        </InfoTip>
      </div>
      {list.length === 0 ? (
        <Empty title="No matching datasets">Try another search term.</Empty>
      ) : (
        <div className="space-y-2">
          {list.map((d, i) => (
            <Disclosure
              key={d.id}
              id={`int-${d.id}`}
              label={`${String(INTERNAL_DATASETS.indexOf(d) + 1).padStart(2, "0")} · ${d.name} — ${d.description}`}
              defaultOpen={i === 0 && !q}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ProvBadge p={d.classification} />
                <span className="text-xs">{d.fields.length} fields</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead className="text-left">
                    <tr className="text-muted">
                      <th className="pb-1.5 font-medium">Field</th>
                      <th className="pb-1.5 font-medium">Type</th>
                      <th className="pb-1.5 font-medium">Unit</th>
                      <th className="pb-1.5 font-medium">Req.</th>
                      <th className="pb-1.5 font-medium">Kind</th>
                      <th className="pb-1.5 font-medium">Rule / relation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-ink">
                    {d.fields.map((f) => (
                      <tr key={f.name}>
                        <td className="py-1.5 font-mono">{f.name}</td>
                        <td>{f.type}</td>
                        <td>{f.unit ?? "—"}</td>
                        <td>{f.required ? "Yes" : "No"}</td>
                        <td>{f.kind}</td>
                        <td className="text-muted">
                          {f.ref ? `→ ${f.ref}` : (f.rule ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Disclosure>
          ))}
        </div>
      )}
      <Disclosure
        id="int-conv"
        label="Units, timestamps and missing-value conventions"
        className="mt-5"
      >
        Power in kW, energy in kWh (never mixed); SoC/SoH as percentages 0–100
        (never fractions); currency INR with explicit unit; carbon intensity in
        gCO₂e/kWh; timestamps ISO-8601 with offset, normalised to UTC on import.
        Missing values stay <code>null</code> — never zero-filled. Every record
        carries a source reference (dataset ID, provenance, period, processing
        steps).
      </Disclosure>
    </>
  )
}
