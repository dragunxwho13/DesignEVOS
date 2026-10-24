import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, Bell, Check, ChevronRight, Menu, Search, X } from "lucide-react"
import { backendStatus } from "../services"
import { Link } from "../lib/router"
import { useStore } from "../lib/store"
import { Logo } from "../site/Site"
import { Kbd, SimBadge, cx } from "../components/ui"
import { DAY_NAMES, fmtT, NOW } from "../lib/sim"
import { GROUPS, LOWER, navContext, type NavItem } from "./nav"
import CommandPalette from "./CommandPalette"

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

function useOpenAlerts() {
  const { alerts, acked } = useStore()
  return alerts.filter((a) => !acked.has(a.id) && a.severity !== "Info").length
}

/** Honest data-connection state. Links to Datasets & Sources for detail. */
function LiveStatus({ dark, onNav, className }: { dark?: boolean; onNav?: () => void; className?: string }) {
  const { live, liveError } = useStore()
  const connected = live?.sources.some((s) => s.status === "connected" && s.usable)
  const at = live ? new Date(live.observedAt) : null
  const time = at && !Number.isNaN(at.getTime()) ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
  const label = connected
    ? `Live inputs${time ? ` · ${time}` : ""}`
    : liveError
      ? "Backend unreachable · fallback"
      : "No usable source · fallback"
  return (
    <Link
      to="/app/datasets"
      onClick={onNav}
      title={liveError || backendStatus().message}
      aria-label={`${label}. Open Datasets and Sources`}
      className={cx(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-medium whitespace-nowrap",
        dark ? "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white" : "border border-line bg-white text-muted hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", connected ? "live-dot bg-ok text-ok" : "bg-warn")} />
      {label}
    </Link>
  )
}

function RoleSwitch({ section, onNav, dark }: { section: string; onNav?: () => void; dark?: boolean }) {
  const driver = section === "driver"
  const opt = (to: string, label: string, on: boolean) => (
    <Link
      to={to}
      onClick={onNav}
      aria-current={on ? "page" : undefined}
      className={cx(
        "rounded-full px-3 py-1 text-xs font-medium",
        on ? (dark ? "bg-white/12 text-white" : "bg-deep text-white") : dark ? "text-white/55 hover:text-white" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  )
  return (
    <div role="group" aria-label="Workspace view" className={cx("inline-flex items-center gap-0.5 rounded-full p-0.5", dark ? "bg-white/5" : "border border-line bg-white")}>
      {opt("/app/overview", "Manager", !driver)}
      {opt("/app/driver", "Driver", driver)}
    </div>
  )
}

function NavList({ section, onNav }: { section: string; onNav?: () => void }) {
  const open = useOpenAlerts()
  const item = (it: NavItem) => {
    const active = section === it.to
    return (
      <li key={it.to}>
        <Link
          to={`/app/${it.to}`}
          onClick={onNav}
          aria-current={active ? "page" : undefined}
          className={cx(
            "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors duration-150",
            active ? "bg-white/8 font-medium text-white" : "text-white/60 hover:bg-white/4 hover:text-white",
          )}
        >
          {active && <span aria-hidden className={cx("absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-cyan", !onNav && "vt-nav-indicator")} />}
          <it.icon size={16} aria-hidden className={cx("transition-colors duration-150", active ? "text-cyan" : "text-white/45 group-hover:text-white/80")} />
          <span className="flex-1 truncate">{it.label}</span>
          {it.to === "alerts" && open > 0 && (
            <span className="tnum rounded-full bg-err/85 px-1.5 text-[11px] font-medium text-white" aria-label={`${open} open alerts`}>
              {open}
            </span>
          )}
        </Link>
      </li>
    )
  }
  return (
    <nav aria-label="Application" className="flex flex-1 flex-col">
      {GROUPS.map((g) => (
        <div key={g.label} className="mb-5">
          <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-white/35 uppercase">{g.label}</p>
          <ul className="space-y-0.5">{g.items.map(item)}</ul>
        </div>
      ))}
      <div className="mt-auto border-t border-white/8 pt-4">
        {onNav && (
          <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
            <RoleSwitch section={section} onNav={onNav} dark />
            <LiveStatus dark onNav={onNav} />
          </div>
        )}
        <ul className="space-y-0.5">{LOWER.map(item)}</ul>
        <Link to="/" onClick={onNav} className="mt-3 flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] text-white/50 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to website
        </Link>
      </div>
    </nav>
  )
}

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search pages, vehicles and actions"
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
      className="mb-6 flex h-9 w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/4 px-3 text-[13px] text-white/50 hover:border-white/20 hover:text-white/80"
    >
      <Search size={15} aria-hidden />
      <span className="flex-1 truncate text-left">Search or jump to…</span>
      <Kbd dark>{isMac ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  )
}

export default function Shell({ section, children }: { section: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [palette, setPalette] = useState(false)
  const { toastMsg, canUndo, undo } = useStore()
  const openAlerts = useOpenAlerts()
  const ctx = navContext(section)
  // Keep the last message mounted briefly so the toast can animate out.
  const [shown, setShown] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (toastMsg) {
      setShown(toastMsg)
      setLeaving(false)
      return
    }
    if (!shown) return
    setLeaving(true)
    const id = setTimeout(() => {
      setShown(null)
      setLeaving(false)
    }, 200)
    return () => clearTimeout(id)
  }, [toastMsg]) // eslint-disable-line
  useEffect(() => {
    window.scrollTo(0, 0)
    setOpen(false)
  }, [section])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", k)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", k)
      document.body.style.overflow = ""
    }
  }, [open])
  // Global shortcut: Ctrl/Cmd+K anywhere, "/" when not typing.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (e.key === "/" && !typing) {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [])
  const openPalette = useCallback(() => {
    setOpen(false)
    setPalette(true)
  }, [])
  const closePalette = useCallback(() => setPalette(false), [])
  return (
    <div className="min-h-screen bg-soft">
      <a href="#main" className="sr-only z-[70] rounded-lg bg-deep px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <aside className="vt-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-deep px-3 py-5 lg:flex">
        <Link to="/app/overview" className="mb-5 px-3" aria-label="EVOS overview">
          <Logo dark />
        </Link>
        <SearchTrigger onOpen={openPalette} />
        <NavList section={section} />
      </aside>
      <div className="vt-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-2 bg-deep pr-2 pl-4 lg:hidden">
        <Link to="/app/overview" aria-label="EVOS overview">
          <Logo dark />
        </Link>
        <div className="flex items-center">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-lg text-white/80 hover:text-white" aria-label="Search pages, vehicles and actions" onClick={openPalette}>
            <Search size={19} />
          </button>
          <Link to="/app/alerts" className="relative grid h-11 w-11 place-items-center rounded-lg text-white/80 hover:text-white" aria-label={`Alerts, ${openAlerts} open`}>
            <Bell size={19} aria-hidden />
            {openAlerts > 0 && <span aria-hidden className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-err ring-2 ring-deep" />}
          </Link>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg text-white"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      <div className={cx("fixed inset-0 z-40 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open} inert={!open}>
        <div className={cx("absolute inset-0 bg-deep/50 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={cx(
            "absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col overflow-y-auto bg-deep px-3 py-5 shadow-pop transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-5 flex items-center justify-between px-3">
            <Logo dark />
            <button type="button" aria-label="Close navigation" className="grid h-10 w-10 place-items-center rounded-lg text-white" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          {open && (
            <>
              <SearchTrigger onOpen={openPalette} />
              <NavList section={section} onNav={() => setOpen(false)} />
            </>
          )}
        </div>
      </div>
      <main id="main" tabIndex={-1} className="outline-none lg:pl-60">
        <div className="sticky top-0 z-20 hidden h-14 items-center justify-between gap-4 border-b border-line/70 bg-soft/85 px-8 backdrop-blur-md lg:flex">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="text-muted">{ctx.group}</span>
            <ChevronRight size={14} className="text-line-strong" aria-hidden />
            <span aria-current="page" className="truncate font-medium text-ink">{ctx.item?.label ?? "Page"}</span>
          </nav>
          <div className="flex items-center gap-2">
            <LiveStatus />
            <Link
              to="/app/alerts"
              aria-label={`Alerts, ${openAlerts} open`}
              className="relative grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-muted hover:border-line-strong hover:text-ink"
            >
              <Bell size={15} aria-hidden />
              {openAlerts > 0 && (
                <span aria-hidden className="tnum absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-err px-1 text-[10px] font-semibold text-white">
                  {openAlerts}
                </span>
              )}
            </Link>
            <RoleSwitch section={section} />
          </div>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
      <CommandPalette open={palette} onClose={closePalette} />
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex justify-end sm:left-auto">
        {shown && (
          <div
            key={shown}
            className={cx(
              leaving ? "toast-out" : "toast-in",
              "pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-deep py-2.5 pr-2.5 pl-4 text-sm text-white shadow-pop",
            )}
          >
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan/20 text-cyan" aria-hidden>
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="py-1">{shown}</span>
            {canUndo && (
              <button type="button" onClick={undo} className="ml-1 rounded-lg px-2.5 py-1.5 font-medium text-cyan hover:bg-white/10">
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string
  sub: string
  right?: ReactNode
}) {
  const { a } = useStore()
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <SimBadge />
          <span>
            Prototype workspace · {DAY_NAMES[a.day]} · now {fmtT(NOW)}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>
      </div>
      {right}
    </header>
  )
}
