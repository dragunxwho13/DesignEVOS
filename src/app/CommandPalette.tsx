import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, CornerDownLeft, RotateCcw, Search, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { navigate } from "../lib/router"
import { useStore } from "../lib/store"
import { Kbd, Status, cx } from "../components/ui"
import { fmtT } from "../lib/sim"
import { ALL_NAV } from "./nav"

type Cmd = { id: string; group: string; label: string; hint: string; icon: LucideIcon; run: () => void; meta?: string }

/**
 * Keyboard-first navigation across every page, vehicle and a few safe actions.
 * Opens with Ctrl/Cmd+K or "/" (outside text fields). Uses the ARIA combobox + listbox pattern.
 */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sim, resetAll } = useStore()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const prevFocus = useRef<Element | null>(null)

  const commands = useMemo<Cmd[]>(() => {
    const pages = ALL_NAV.map((n) => ({ id: `p-${n.to}`, group: "Pages", label: n.label, hint: n.hint, icon: n.icon, run: () => navigate(`/app/${n.to}`) }))
    const vehicles = sim.vehicles.map((v) => ({
      id: `v-${v.id}`, group: "Vehicles", label: v.id, hint: `${v.cls} · SoC ${v.soc}% · departs ${fmtT(v.departure)}`, icon: Truck, meta: v.readiness,
      run: () => navigate(`/app/fleet/${v.id}`),
    }))
    const actions = [
      { id: "a-reset", group: "Actions", label: "Reset simulation to defaults", hint: "You can undo straight after", icon: RotateCcw, run: resetAll },
      { id: "a-site", group: "Actions", label: "Back to website", hint: "Leave the workspace", icon: ArrowLeft, run: () => navigate("/") },
    ]
    return [...pages, ...vehicles, ...actions]
  }, [sim.vehicles, resetAll])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return commands.filter((c) => c.group !== "Vehicles").concat(commands.filter((c) => c.group === "Vehicles").slice(0, 4))
    const words = t.split(/\s+/)
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.hint} ${c.meta ?? ""}`.toLowerCase()
        if (!words.every((w) => hay.includes(w))) return null
        const label = c.label.toLowerCase()
        return { c, score: label.startsWith(t) ? 0 : label.includes(t) ? 1 : 2 }
      })
      .filter((x): x is { c: Cmd; score: number } => !!x)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c)
      .slice(0, 24)
  }, [q, commands])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    if (!open) return
    prevFocus.current = document.activeElement
    setQ("")
    requestAnimationFrame(() => inputRef.current?.focus())
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      ;(prevFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [open])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  if (!open) return null
  const exec = (c?: Cmd) => {
    if (!c) return
    onClose()
    c.run()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === "Home") { e.preventDefault(); setActive(0) }
    else if (e.key === "End") { e.preventDefault(); setActive(results.length - 1) }
    else if (e.key === "Enter") { e.preventDefault(); exec(results[active]) }
    else if (e.key === "Escape") { e.preventDefault(); onClose() }
    else if (e.key === "Tab") e.preventDefault() // focus stays in the dialog
  }

  let lastGroup = ""
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[12vh]" onKeyDown={onKey}>
      <div className="fade-in absolute inset-0 bg-deep/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Command menu" className="palette-in relative flex max-h-[min(560px,76vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={17} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages, vehicles and actions"
            placeholder="Search pages, vehicles, actions…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul ref={listRef} id="cmd-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto p-2">
          {results.map((c, i) => {
            const header = c.group !== lastGroup
            lastGroup = c.group
            return (
              <li key={c.id} role="presentation">
                {header && <div role="presentation" className="px-3 pt-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted uppercase first:pt-1">{c.group}</div>}
                <div
                  id={`cmd-${c.id}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => exec(c)}
                  className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-100", i === active ? "bg-soft" : "")}
                >
                  <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors duration-100", i === active ? "border-cyan/40 bg-white text-info-ink" : "border-line text-muted")}>
                    <c.icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{c.label}</span>
                    <span className="block truncate text-xs text-muted">{c.hint}</span>
                  </span>
                  {c.meta && <Status s={c.meta} />}
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-muted" aria-hidden />}
                </div>
              </li>
            )
          })}
          {!results.length && (
            <li role="presentation" className="px-4 py-10 text-center text-sm text-muted">
              No matches for “{q}”. Try a page name or a vehicle ID such as BUS-01.
            </li>
          )}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-soft/60 px-4 py-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
          <span className="ml-auto">{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
