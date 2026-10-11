import { useEffect, useState, type ReactNode } from "react"
import {
  LayoutDashboard,
  Truck,
  CalendarClock,
  Zap,
  Network,
  BatteryMedium,
  Activity,
  Leaf,
  ScanSearch,
  FlaskConical,
  Bell,
  Settings,
  BookOpen,
  ArrowLeft,
  Menu,
  X,
  Wrench,
  Beaker,
  Database,
  UserRound,
} from "lucide-react"
import { backendStatus } from "../services"
import { Link } from "../lib/router"
import { useStore } from "../lib/store"
import { Logo } from "../site/Site"
import { SimBadge, cx } from "../components/ui"
import { DAY_NAMES, fmtT, NOW } from "../lib/sim"

const GROUPS = [
  {
    label: "Operate",
    items: [
      { to: "overview", label: "Overview", icon: LayoutDashboard },
      { to: "fleet", label: "Fleet", icon: Truck },
      { to: "scheduler", label: "Scheduler", icon: CalendarClock },
      { to: "energy", label: "Energy", icon: Zap },
      { to: "system", label: "System View", icon: Network },
    ],
  },
  {
    label: "Analyse",
    items: [
      { to: "battery", label: "Battery Health", icon: BatteryMedium },
      { to: "forecasts", label: "Forecasts", icon: Activity },
      { to: "sustainability", label: "Sustainability", icon: Leaf },
      { to: "explain", label: "Explainability", icon: ScanSearch },
      { to: "maintenance", label: "Maintenance & Faults", icon: Wrench },
    ],
  },
  {
    label: "Plan",
    items: [
      { to: "scenarios", label: "Scenarios", icon: FlaskConical },
      { to: "experiments", label: "Experiments", icon: Beaker },
      { to: "alerts", label: "Alerts", icon: Bell },
    ],
  },
]
const LOWER = [
  { to: "driver", label: "Driver view", icon: UserRound },
  { to: "datasets", label: "Datasets & Sources", icon: Database },
  { to: "settings", label: "Configuration", icon: Settings },
  { to: "methodology", label: "Methodology", icon: BookOpen },
]

function NavList({ section, onNav }: { section: string; onNav?: () => void }) {
  const { alerts, acked, live, liveError } = useStore()
  const connectedSource = live?.sources.some(
    (source) => source.status === "connected" && source.usable,
  )
  const open = alerts.filter(
    (a) => !acked.has(a.id) && a.severity !== "Info",
  ).length
  const item = (it: { to: string; label: string; icon: typeof Bell }) => {
    const active = section === it.to
    return (
      <li key={it.to}>
        <Link
          to={`/app/${it.to}`}
          onClick={onNav}
          aria-current={active ? "page" : undefined}
          className={cx(
            "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors duration-150",
            active
              ? "bg-white/8 text-white"
              : "text-white/60 hover:bg-white/4 hover:text-white",
          )}
        >
          {active && (
            <span
              aria-hidden
              className={cx(
                "absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-cyan",
                !onNav && "vt-nav-indicator",
              )}
            />
          )}
          <it.icon
            size={16}
            aria-hidden
            className={active ? "text-cyan" : ""}
          />
          <span className="flex-1">{it.label}</span>
          {it.to === "alerts" && open > 0 && (
            <span
              className="tnum rounded bg-err/80 px-1.5 text-[11px] font-medium text-white"
              aria-label={`${open} open alerts`}
            >
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
          <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-white/35 uppercase">
            {g.label}
          </p>
          <ul className="space-y-0.5">{g.items.map(item)}</ul>
        </div>
      ))}
      <div className="mt-auto border-t border-white/8 pt-4">
        <div className="mb-3 rounded-lg bg-white/4 p-1">
          <p className="px-2 py-1 text-[10px] font-medium tracking-wider text-white/35 uppercase">Workspace</p>
          <div className="grid grid-cols-2 gap-1">
            <Link to="/app/overview" onClick={onNav} className={cx("rounded-md px-2 py-1.5 text-center text-[11px]", section !== "driver" ? "bg-white/10 text-white" : "text-white/55 hover:text-white")}>Manager</Link>
            <Link to="/app/driver" onClick={onNav} className={cx("rounded-md px-2 py-1.5 text-center text-[11px]", section === "driver" ? "bg-cyan/20 text-cyan" : "text-white/55 hover:text-white")}>Driver</Link>
          </div>
        </div>
        <Link
          to="/app/datasets"
          onClick={onNav}
          className="mb-3 flex items-center gap-2 rounded-lg bg-white/4 px-3 py-2 text-[11.5px] text-white/60 hover:text-white"
          title={liveError || backendStatus().message}
        >
          <span
            aria-hidden
            className={cx(
              "h-1.5 w-1.5 rounded-full",
              connectedSource ? "bg-ok" : "bg-warn",
            )}
          />
          {connectedSource
            ? "Live dataset mapped · fallback labelled"
            : "No usable dataset response · fallback active"}
        </Link>
        <ul className="space-y-0.5">{LOWER.map(item)}</ul>
        <Link
          to="/"
          onClick={onNav}
          className="mt-3 flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] text-white/50 hover:text-white"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to website
        </Link>
      </div>
    </nav>
  )
}

export default function Shell({
  section,
  children,
}: {
  section: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { toastMsg, canUndo, undo } = useStore()
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
    return () => window.removeEventListener("keydown", k)
  }, [open])
  return (
    <div className="min-h-screen bg-soft">
      <aside className="vt-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-deep px-3 py-5 lg:flex">
        <Link
          to="/app/overview"
          className="mb-7 px-3"
          aria-label="EVOS overview"
        >
          <Logo dark />
        </Link>
        <NavList section={section} />
      </aside>
      <div className="vt-topbar sticky top-0 z-30 flex h-14 items-center justify-between bg-deep px-4 lg:hidden">
        <Link to="/app/overview" aria-label="EVOS overview">
          <Logo dark />
        </Link>
        <button
          className="grid h-11 w-11 place-items-center text-white"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <div
        className={cx(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cx(
            "absolute inset-0 bg-deep/50 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cx(
            "absolute inset-y-0 left-0 flex w-72 flex-col overflow-y-auto bg-deep px-3 py-5 transition-transform duration-250 ease-out",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="mb-6 flex items-center justify-between px-3">
            <Logo dark />
            <button
              aria-label="Close navigation"
              className="grid h-10 w-10 place-items-center text-white"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          {open && <NavList section={section} onNav={() => setOpen(false)} />}
        </div>
      </div>
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50"
      >
        {shown && (
          <div
            key={shown}
            className={cx(
              leaving ? "toast-out" : "toast-in",
              "pointer-events-auto flex items-center gap-3 rounded-lg bg-deep px-4 py-3 text-sm text-white shadow-xl",
            )}
          >
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan/20 text-[11px] text-cyan"
              aria-hidden
            >
              ✓
            </span>
            <span>{shown}</span>
            {canUndo && (
              <button
                onClick={undo}
                className="rounded px-2 py-1 font-medium text-cyan hover:bg-white/10"
              >
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
