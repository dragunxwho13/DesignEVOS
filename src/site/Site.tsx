import { useEffect, useRef, useState } from "react"
import {
  ArrowRight,
  Menu,
  X,
  Clock,
  PlugZap,
  Gauge,
  BatteryMedium,
  CalendarClock,
  Zap,
  Activity,
  Leaf,
  ScanSearch,
  ChevronRight,
} from "lucide-react"
import {
  Button,
  ButtonLink,
  SimBadge,
  cx,
  useRevealAll,
  Status,
} from "../components/ui"
import { Donut, Legend, TimeChart, C } from "../components/charts"
import EnergySchematic from "../components/EnergySchematic"
import logoArt from "../assets/evos-logo.jpg"
import { Link, scrollToId } from "../lib/router"
import { useStore } from "../lib/store"
import { NOW, fmtT, inr, STEPS } from "../lib/sim"

const HERO_IMG =
  "https://images.unsplash.com/photo-1707758283052-f1e3a2d42333?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1600"
const SOLAR_IMG =
  "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1400"

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "capabilities", label: "Capabilities" },
  { id: "sustainability", label: "Sustainability" },
]

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* Brand mark: icon cropped from the supplied EVOS logo artwork. */}
      <span
        aria-hidden
        className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[#071624] ring-1 ring-white/10"
      >
        <img
          src={logoArt}
          alt=""
          width={1024}
          height={1024}
          decoding="async"
          className="absolute max-w-none"
          style={{ width: 109, height: 109, left: -11.2, top: -38.5 }}
        />
      </span>
      <span
        className={cx(
          "text-[15px] font-semibold tracking-[0.14em]",
          dark ? "text-white" : "text-ink",
        )}
      >
        EVOS
      </span>
    </span>
  )
}

const DEMO_MENU = [
  {
    group: "Operate",
    items: [
      [
        "Overview dashboard",
        "/app/overview",
        "Readiness, energy and alerts at a glance",
      ],
      [
        "Charging scheduler",
        "/app/scheduler",
        "Compare FCFS, rule-based and EVOS",
      ],
      ["Energy manager", "/app/energy", "Solar, storage and grid flows"],
    ],
  },
  {
    group: "Analyse",
    items: [
      ["Battery health", "/app/battery", "Estimated SoH with uncertainty"],
      [
        "Sustainability",
        "/app/sustainability",
        "Estimated emissions vs baseline",
      ],
      ["Explainability", "/app/explain", "Why each decision was made"],
    ],
  },
  {
    group: "Data & method",
    items: [
      [
        "Datasets & sources",
        "/app/datasets",
        "What is connected, and importing",
      ],
      ["Methodology", "/app/methodology", "Models, assumptions, limitations"],
    ],
  },
] as { group: string; items: [string, string, string][] }[]

function DemoMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus()
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const links = [
          ...(ref.current?.querySelectorAll<HTMLAnchorElement>(
            "[role=menuitem]",
          ) ?? []),
        ]
        const i = links.indexOf(document.activeElement as HTMLAnchorElement)
        e.preventDefault()
        links[
          (i + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length
        ]?.focus()
      }
    }
    document.addEventListener("mousedown", off)
    document.addEventListener("keydown", key)
    return () => {
      document.removeEventListener("mousedown", off)
      document.removeEventListener("keydown", key)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cx(
          "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:text-white",
          open ? "text-white" : "text-white/65",
        )}
      >
        Explore the demo
        <ChevronRight
          size={14}
          aria-hidden
          className={cx(
            "transition-transform duration-200",
            open ? "-rotate-90" : "rotate-90",
          )}
        />
      </button>
      <div
        role="menu"
        aria-label="Explore the demo"
        className={cx(
          "absolute top-full right-0 mt-2 w-[560px] origin-top-right rounded-xl border border-line bg-white p-2 shadow-[0_24px_48px_-16px_rgba(11,18,32,.35)] transition-[opacity,transform] duration-180 ease-out",
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0",
        )}
      >
        <div className="grid grid-cols-3 gap-1">
          {DEMO_MENU.map((g) => (
            <div key={g.group} className="p-2">
              <p className="mb-1.5 px-2 text-[11px] font-medium tracking-wider text-muted uppercase">
                {g.group}
              </p>
              <ul>
                {g.items.map(([l, to, d]) => (
                  <li key={to}>
                    <Link
                      role="menuitem"
                      tabIndex={open ? 0 : -1}
                      to={to}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-soft focus-visible:bg-soft"
                    >
                      <span className="block text-sm font-medium text-ink">
                        {l}
                      </span>
                      <span className="block text-xs leading-snug text-muted">
                        {d}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState("overview")
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40)
        const max = document.documentElement.scrollHeight - window.innerHeight
        if (bar.current)
          bar.current.style.transform = `scaleX(${
            max > 0 ? window.scrollY / max : 0
          })`
      })
    }
    on()
    window.addEventListener("scroll", on, { passive: true })
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    )
    NAV.forEach((n) => {
      const el = document.getElementById(n.id)
      if (el) io.observe(el)
    })
    return () => {
      window.removeEventListener("scroll", on)
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [open])
  const go = (id: string) => {
    setOpen(false)
    scrollToId(id)
  }
  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-200",
        scrolled || open
          ? "bg-deep/92 backdrop-blur-md shadow-[0_1px_0_rgba(255,255,255,.06)]"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-8">
        <button onClick={() => go("overview")} aria-label="EVOS home">
          <Logo dark />
        </button>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={active === n.id ? "true" : undefined}
              className={cx(
                "relative rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:text-white",
                active === n.id ? "text-white" : "text-white/65",
              )}
            >
              {n.label}
              <span
                aria-hidden
                className={cx(
                  "absolute inset-x-3 -bottom-0.5 h-px bg-cyan transition-[opacity,transform] duration-250 ease-out",
                  active === n.id
                    ? "scale-x-100 opacity-100"
                    : "scale-x-50 opacity-0",
                )}
              />
            </button>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <div className="hidden lg:block">
            <DemoMenu />
          </div>
          <ButtonLink to="/app/overview" size="sm">
            Explore the framework
          </ButtonLink>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-lg text-white md:hidden"
          aria-expanded={open}
          aria-controls="mnav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <div
        ref={bar}
        aria-hidden
        className={cx(
          "absolute inset-x-0 bottom-0 h-px origin-left bg-cyan/70 transition-opacity duration-200",
          scrolled ? "opacity-100" : "opacity-0",
        )}
        style={{ transform: "scaleX(0)" }}
      />
      <div
        id="mnav"
        className={cx(
          "overflow-hidden transition-[max-height,opacity] duration-250 ease-out md:hidden",
          open
            ? "max-h-[80vh] overflow-y-auto opacity-100"
            : "max-h-0 opacity-0",
        )}
      >
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-5 pb-5">
          {NAV.map((n) => (
            <button
              key={n.id}
              tabIndex={open ? 0 : -1}
              onClick={() => go(n.id)}
              className="h-11 rounded-lg px-3 text-left text-white/80 hover:bg-white/5"
            >
              {n.label}
            </button>
          ))}
          <details className="group rounded-lg">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-white/80 hover:bg-white/5">
              Explore the demo{" "}
              <ChevronRight
                size={15}
                aria-hidden
                className="transition-transform duration-200 group-open:rotate-90"
              />
            </summary>
            <ul className="pb-2 pl-3">
              {DEMO_MENU.flatMap((g) => g.items).map(([l, to]) => (
                <li key={to}>
                  <Link
                    to={to}
                    tabIndex={open ? 0 : -1}
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center rounded-lg px-3 text-sm text-white/65 hover:bg-white/5 hover:text-white"
                  >
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
          <ButtonLink to="/app/overview" className="mt-2">
            Open fleet manager
          </ButtonLink>
          <ButtonLink to="/app/driver" variant="secondary" className="mt-2">
            Open driver view
          </ButtonLink>
        </nav>
      </div>
    </header>
  )
}

function Eyebrow({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <p
      className={cx(
        "text-xs font-semibold tracking-[0.16em] uppercase",
        dark ? "text-cyan" : "text-teal",
      )}
    >
      {children}
    </p>
  )
}
function H2({
  children,
  dark,
  className,
}: {
  children: React.ReactNode
  dark?: boolean
  className?: string
}) {
  return (
    <h2
      className={cx(
        "mt-3 text-3xl leading-[1.12] font-semibold tracking-tight text-balance md:text-[44px]",
        dark ? "text-white" : "text-ink",
        className,
      )}
    >
      {children}
    </h2>
  )
}

function Hero() {
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.innerWidth < 768
    )
      return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (img.current && window.scrollY < 900)
          img.current.style.transform = `translate3d(0,${window.scrollY * 0.12}px,0)`
      })
    }
    window.addEventListener("scroll", on, { passive: true })
    return () => {
      window.removeEventListener("scroll", on)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <section
      id="overview"
      tabIndex={-1}
      className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-deep outline-none"
    >
      <img
        ref={img}
        src={HERO_IMG}
        srcSet={`${HERO_IMG.replace("w=1600", "w=800")} 800w, ${HERO_IMG} 1600w`}
        sizes="100vw"
        width={1600}
        height={1622}
        fetchPriority="high"
        decoding="async"
        alt="Electric vehicle connected to a charging station at night"
        className="hero-img absolute inset-0 -z-10 h-[115%] w-full object-cover object-[70%_center] opacity-70"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#0B1220_8%,rgba(11,18,32,.88)_40%,rgba(11,18,32,.25)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-deep to-transparent" />
      <div className="mx-auto w-full max-w-[1200px] px-5 pt-32 pb-20 md:px-8 md:pb-28">
        <div className="max-w-2xl">
          <div className="reveal">
            <Eyebrow dark>
              Electric Vehicles Operations & Sustainability
            </Eyebrow>
          </div>
          <h1
            className="reveal mt-5 text-[40px] leading-[1.04] font-semibold tracking-tight text-white md:text-[64px]"
            style={{ ["--d" as string]: 1 }}
          >
            Smarter EV fleet operations.{" "}
            <span className="text-white/55">Clearer energy decisions.</span>
          </h1>
          <p
            className="reveal mt-6 max-w-xl text-[17px] leading-relaxed text-white/72"
            style={{ ["--d" as string]: 2 }}
          >
            EVOS is a software framework for exploring how fleet scheduling,
            charging, energy management and sustainability analytics can work
            together—while keeping vehicle readiness, battery health, energy
            cost and carbon impact in view.
          </p>
          <div
            className="reveal mt-9 flex flex-wrap gap-3"
            style={{ ["--d" as string]: 3 }}
          >
            <ButtonLink to="/app/overview" size="lg">
              Open fleet manager <ArrowRight size={16} />
            </ButtonLink>
            <Button
              variant="onDark"
              size="lg"
              onClick={() => scrollToId("how-it-works")}
            >
              See how it works
            </Button>
          </div>
          <div
            className="reveal mt-5 grid max-w-xl gap-3 sm:grid-cols-2"
            style={{ ["--d" as string]: 3 }}
          >
            <ButtonLink
              to="/app/overview"
              variant="secondary"
              className="justify-start border-white/15 bg-white/8 text-left text-white hover:bg-white/15"
            >
              <span>
                <span className="block text-sm font-semibold">EV fleet manager</span>
                <span className="mt-0.5 block text-xs font-normal text-white/60">Monitor chargers, fleet readiness, energy and alerts.</span>
              </span>
            </ButtonLink>
            <ButtonLink
              to="/app/driver"
              variant="secondary"
              className="justify-start border-white/15 bg-white/8 text-left text-white hover:bg-white/15"
            >
              <span>
                <span className="block text-sm font-semibold">Driver view</span>
                <span className="mt-0.5 block text-xs font-normal text-white/60">Check SoC, charging progress, departure and available plugs.</span>
              </span>
            </ButtonLink>
          </div>
        </div>
        <dl
          className="reveal mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-white/10 pt-6"
          style={{ ["--d" as string]: 4 }}
        >
          {[
            ["Flexible", "editable vehicle registry"],
            ["6", "chargers · DC & AC"],
            ["100 kWp", "rooftop PV · reference case"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="tnum text-xl font-semibold text-white md:text-2xl">
                {v}
              </dd>
              <dd className="mt-1 text-xs text-white/55">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Challenge() {
  const items = [
    {
      icon: Clock,
      t: "Vehicle readiness",
      d: "Each vehicle has a departure time and a minimum state of charge (SoC—how full the battery is). Missing either disrupts service.",
    },
    {
      icon: PlugZap,
      t: "Charger contention",
      d: "Fewer chargers than vehicles, with different power levels and connector compatibility, means someone always waits.",
    },
    {
      icon: Gauge,
      t: "Energy cost and grid constraints",
      d: "Tariffs change through the day and the site connection has an import limit that simultaneous charging can exceed.",
    },
    {
      icon: BatteryMedium,
      t: "Battery wear and emissions",
      d: "Fast charging and deep cycles age batteries; grid electricity carries a carbon cost that varies with the source.",
    },
  ]
  return (
    <section id="challenge" className="bg-white py-24 md:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-14 px-5 md:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <div className="reveal lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>The challenge</Eyebrow>
          <H2>
            EV charging is a coordination problem—not just a power problem.
          </H2>
          <p className="mt-6 text-[17px] leading-relaxed text-muted">
            Fleet operators must balance departure deadlines, charger
            availability, charging demand, energy prices, renewable generation,
            grid limits and battery ageing. Optimising one factor in isolation
            can create trade-offs elsewhere.
          </p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {items.map((it, i) => (
            <li
              key={it.t}
              className="reveal group flex gap-5 py-7"
              style={{ ["--d" as string]: i }}
            >
              <span className="tnum pt-0.5 text-sm font-medium text-muted/70">
                0{i + 1}
              </span>
              <div className="flex-1">
                <h3 className="flex items-center gap-2.5 text-lg font-semibold text-ink">
                  <it.icon size={18} className="text-teal" aria-hidden />
                  {it.t}
                </h3>
                <p className="mt-2 leading-relaxed text-muted">{it.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Approach() {
  const steps = [
    { t: "Fleet & requests", d: "Vehicles, SoC, departures, chargers" },
    { t: "Intelligence", d: "Scheduler, energy manager, forecasts" },
    { t: "Charging & energy decisions", d: "Slots, power, source mix" },
    { t: "Outcomes", d: "Readiness, cost, wear, emissions" },
  ]
  return (
    <section id="approach" className="bg-soft py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="reveal max-w-3xl">
          <Eyebrow>The EVOS approach</Eyebrow>
          <H2>Connect the decisions that are usually treated separately.</H2>
          <p className="mt-6 text-[17px] leading-relaxed text-muted">
            EVOS brings fleet, charging, energy and sustainability signals into
            one framework. A scheduler considers urgency and constraints; energy
            management compares available sources; analytics make outcomes and
            trade-offs easier to inspect.
          </p>
        </div>
        <ol
          className="reveal mt-14 grid gap-3 md:grid-cols-4 md:gap-0"
          aria-label="EVOS flow"
        >
          {steps.map((s, i) => (
            <li key={s.t} className="relative flex md:block">
              <div
                className={cx(
                  "flex-1 rounded-xl border p-5 md:mr-8",
                  i === 1
                    ? "border-cyan/40 bg-deep text-white"
                    : "border-line bg-white",
                )}
              >
                <span
                  className={cx(
                    "tnum text-xs font-medium",
                    i === 1 ? "text-cyan" : "text-teal",
                  )}
                >
                  Step {i + 1}
                </span>
                <h3
                  className={cx(
                    "mt-2 font-semibold",
                    i === 1 ? "text-white" : "text-ink",
                  )}
                >
                  {s.t}
                </h3>
                <p
                  className={cx(
                    "mt-1 text-sm",
                    i === 1 ? "text-white/65" : "text-muted",
                  )}
                >
                  {s.d}
                </p>
              </div>
              {i < 3 && (
                <svg
                  className="absolute top-1/2 right-0 hidden h-4 w-8 -translate-y-1/2 md:block"
                  viewBox="0 0 32 16"
                  aria-hidden
                >
                  <path
                    d="M2 8h24m-5-5 5 5-5 5"
                    fill="none"
                    stroke="#18B7C9"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ol>
        <Architecture />
      </div>
    </section>
  )
}

const LAYERS = [
  {
    n: "User Layer",
    d: "Operator and reviewer inputs: departure needs, overrides, scenario assumptions and decisions.",
  },
  {
    n: "Fleet Layer",
    d: "Simulated vehicles, chargers, rooftop PV, stationary battery, grid connection and fault scenarios.",
  },
  {
    n: "Data Layer",
    d: "Validation, storage, provenance and an audit trail so every value can be traced to its source.",
  },
  {
    n: "Intelligence Layer",
    d: "Scheduler, energy manager, forecasting, battery-health estimation, maintenance signals and explainability.",
  },
  {
    n: "Analytics Layer",
    d: "Operational, energy, battery, environmental and trust metrics computed from the same model.",
  },
  {
    n: "Visualization Layer",
    d: "This website, the dashboard, charts, the live-system schematic and scenario comparison.",
  },
]
export function Architecture({ inApp }: { inApp?: boolean }) {
  const [sel, setSel] = useState(3)
  return (
    <div
      className={cx(
        "grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center",
        inApp ? "" : "reveal mt-20",
      )}
    >
      <div>
        {!inApp && (
          <h3 className="text-2xl font-semibold tracking-tight text-ink">
            A six-layer architecture
          </h3>
        )}
        {!inApp && (
          <p className="mt-3 max-w-md text-muted">
            Each layer has one responsibility. Select a layer to see what it
            does.
          </p>
        )}
        <div
          className={cx(
            "rounded-xl border border-line bg-white p-6",
            !inApp && "mt-6",
          )}
          aria-live="polite"
        >
          <span className="tnum text-xs font-medium text-teal">
            Layer {6 - sel} of 6
          </span>
          <h4 key={sel} className="fade-in mt-1 text-lg font-semibold">
            {LAYERS[5 - sel].n}
          </h4>
          <p
            key={`d${sel}`}
            className="fade-in mt-2 leading-relaxed text-muted"
          >
            {LAYERS[5 - sel].d}
          </p>
        </div>
      </div>
      <ul className="space-y-2" aria-label="Architecture layers, top to bottom">
        {LAYERS.slice()
          .reverse()
          .map((l, i) => (
            <li key={l.n}>
              <button
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className={cx(
                  "group flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition-[background-color,border-color,transform] duration-200 ease-out",
                  sel === i
                    ? "border-deep bg-deep text-white"
                    : "border-line bg-white hover:border-[#b8c6d6] hover:translate-x-1",
                )}
                style={{ marginLeft: `${(5 - i) * 0}px` }}
              >
                <span className="flex items-center gap-4">
                  <span
                    className={cx(
                      "tnum text-xs",
                      sel === i ? "text-cyan" : "text-muted",
                    )}
                  >
                    {String(6 - i).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{l.n}</span>
                </span>
                <ChevronRight
                  size={16}
                  className={cx(
                    "transition-transform duration-200",
                    sel === i ? "text-cyan translate-x-0.5" : "text-muted",
                  )}
                  aria-hidden
                />
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}

const CAPS = [
  {
    icon: CalendarClock,
    t: "Priority-aware scheduling",
    d: "Explore charging priorities using state of charge, departure needs, charger availability and power constraints.",
    to: "/app/scheduler",
  },
  {
    icon: Zap,
    t: "Energy coordination",
    d: "Compare solar, stationary storage and grid supply under demand, reserve and import-limit assumptions.",
    to: "/app/energy",
  },
  {
    icon: BatteryMedium,
    t: "Battery-health estimation",
    d: "Surface estimated state of health (SoH) indicators and ageing signals with clear limitations and provenance.",
    to: "/app/battery",
  },
  {
    icon: Activity,
    t: "Forecasting",
    d: "Explore expected demand, solar availability and energy outcomes across a selected time horizon.",
    to: "/app/forecasts",
  },
  {
    icon: Leaf,
    t: "Sustainability analytics",
    d: "Review energy mix and estimated emissions using explicit assumptions and units.",
    to: "/app/sustainability",
  },
  {
    icon: ScanSearch,
    t: "Explainability & what-if",
    d: "Inspect why a recommendation was selected and compare scenario outcomes against a baseline.",
    to: "/app/explain",
  },
]
function Capabilities() {
  const [i, setI] = useState(0)
  const { sim } = useStore()
  const c = CAPS[i]
  return (
    <section
      id="capabilities"
      tabIndex={-1}
      className="bg-white py-24 outline-none md:py-32"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Eyebrow>Capabilities</Eyebrow>
            <H2>Six capabilities, one shared model.</H2>
          </div>
          <p className="max-w-sm text-muted">
            Every screen reads from the same simulation, so a schedule change
            shows up in energy, cost and emissions.
          </p>
        </div>
        <div className="reveal mt-14 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <ul
            role="tablist"
            aria-label="Capabilities"
            className="border-t border-line"
          >
            {CAPS.map((x, k) => (
              <li key={x.t} className="border-b border-line">
                <button
                  role="tab"
                  aria-selected={k === i}
                  onClick={() => setI(k)}
                  onMouseEnter={() => setI(k)}
                  className="group flex w-full items-start gap-4 py-5 text-left"
                >
                  <x.icon
                    size={20}
                    className={cx(
                      "mt-0.5 shrink-0 transition-colors duration-150",
                      k === i ? "text-cyan" : "text-muted",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">
                    <span
                      className={cx(
                        "block text-[17px] font-semibold transition-colors duration-150",
                        k === i
                          ? "text-ink"
                          : "text-muted group-hover:text-ink",
                      )}
                    >
                      {x.t}
                    </span>
                    <span
                      className={cx(
                        "grid transition-[grid-template-rows,opacity] duration-250 ease-out",
                        k === i
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <span className="overflow-hidden">
                        <span className="block pt-2 leading-relaxed text-muted">
                          {x.d}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div
            className="relative overflow-hidden rounded-2xl bg-deep p-6 text-white md:p-8"
            role="tabpanel"
            aria-label={c.t}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">{c.t}</span>
              <SimBadge dark />
            </div>
            <div key={i} className="pop-in mt-6 min-h-[260px]">
              <CapPreview i={i} />
            </div>
            <Link
              to={c.to}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-cyan hover:underline"
            >
              Open in the demo <ArrowRight size={14} />
            </Link>
            <span className="sr-only">
              {sim.totals.requested} sessions scheduled.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function CapPreview({ i }: { i: number }) {
  const { sim } = useStore()
  const t = sim.totals
  if (i === 0)
    return (
      <ul className="space-y-2.5">
        {sim.sessions.slice(0, 6).map((s) => (
          <li key={s.vehicleId} className="flex items-center gap-3 text-sm">
            <span className="tnum w-6 text-white/40">#{s.rank}</span>
            <span className="w-16 font-medium">{s.vehicleId}</span>
            <div className="relative h-2 flex-1 rounded-full bg-white/8">
              <div
                className={cx(
                  "absolute h-2 rounded-full",
                  s.late ? "bg-warn" : "bg-cyan",
                )}
                style={{
                  left: `${((s.start - NOW) / (STEPS - NOW)) * 100}%`,
                  width: `${((s.end - s.start) / (STEPS - NOW)) * 100}%`,
                }}
              />
            </div>
            <span className="tnum w-24 text-right text-xs text-white/55">
              {s.chargerId} · {fmtT(s.start)}
            </span>
          </li>
        ))}
      </ul>
    )
  if (i === 1)
    return (
      <EnergySchematic
        assets={sim.a}
        f={sim.flows[52]}
        sessions={sim.sessions}
        faultAC4={sim.a.chargerFault}
        dark
        compact
      />
    )
  if (i === 2)
    return (
      <ul className="space-y-3">
        {sim.vehicles
          .slice()
          .sort((a, b) => a.estSoH - b.estSoH)
          .slice(0, 5)
          .map((v) => (
            <li key={v.id} className="text-sm">
              <div className="flex justify-between">
                <span>{v.id}</span>
                <span className="tnum text-white/70">
                  {v.estSoH}% ± {v.sohUnc}
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-white/8">
                <div
                  className="absolute h-1.5 rounded-full bg-teal"
                  style={{ width: `${v.estSoH}%` }}
                />
                <div
                  className="absolute h-1.5 bg-white/25"
                  style={{
                    left: `${v.estSoH - v.sohUnc}%`,
                    width: `${v.sohUnc * 2}%`,
                  }}
                />
              </div>
            </li>
          ))}
        <li className="pt-1 text-xs text-white/50">
          Estimated from cycle count, age and fast-charge share. Not a
          diagnosis.
        </li>
      </ul>
    )
  if (i === 3) {
    const hrs = Array.from({ length: 24 }, (_, k) => k * 4)
    return (
      <TimeChart
        dark
        title="Demand forecast"
        summary="Solid line is what was measured up to 10:00; the dashed line after it is the expected demand."
        unit="kW"
        height={230}
        xLabels={hrs.map(fmtT)}
        marker={{ x: 10, label: "Now" }}
        series={[
          {
            key: "o",
            label: "Observed (simulated)",
            color: "#fff",
            kind: "line",
            values: hrs.map((s) => (s < NOW ? sim.flows[s].load : undefined)),
          },
          {
            key: "f",
            label: "Forecast",
            color: C.cyan,
            kind: "dashed",
            values: hrs.map((s) =>
              s >= NOW - 4 ? sim.flows[s].load : undefined,
            ),
          },
        ]}
      />
    )
  }
  if (i === 4)
    return (
      <div className="flex flex-wrap items-center gap-8">
        <Donut
          size={170}
          label="Energy mix"
          parts={[
            { label: "PV", value: t.pvToLoad, color: C.teal },
            { label: "Storage", value: t.storageToLoad, color: C.storage },
            { label: "Grid", value: t.grid, color: C.grid },
          ]}
          center={
            <>
              <span className="tnum text-2xl font-semibold">
                {Math.round(t.renewableShare * 100)}%
              </span>
              <span className="text-[11px] text-white/55">solar-derived</span>
            </>
          }
        />
        <div className="min-w-48 flex-1">
          <Legend
            dark
            items={[
              {
                label: "Rooftop PV",
                color: C.teal,
                value: `${t.pvToLoad.toFixed(0)} kWh`,
              },
              {
                label: "Storage",
                color: C.storage,
                value: `${t.storageToLoad.toFixed(0)} kWh`,
              },
              {
                label: "Grid",
                color: C.grid,
                value: `${t.grid.toFixed(0)} kWh`,
              },
            ]}
          />
          <p className="mt-4 text-xs text-white/50">
            Estimated {t.emissionsKg.toFixed(0)} kg CO₂e at {sim.a.carbonG}{" "}
            g/kWh grid intensity (assumption).
          </p>
        </div>
      </div>
    )
  const s = sim.sessions[0]
  return (
    <div className="space-y-4 text-sm">
      <div>
        <span className="text-white/50">Selected action</span>
        <p className="mt-1 font-medium">
          Assign {s.vehicleId} to {s.chargerId} from {fmtT(s.start)} to{" "}
          {fmtT(s.end)} at {s.powerKW} kW
        </p>
      </div>
      <div>
        <span className="text-white/50">Why this assignment?</span>
        <p className="mt-1 leading-relaxed text-white/80">{s.rationale}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(["urgency", "deficit", "slack", "classWeight"] as const).map((k) => (
          <div key={k}>
            <div className="text-[11px] text-white/50 capitalize">
              {k === "classWeight" ? "Class" : k}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-cyan"
                style={{ width: `${s.score[k] * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    [
      "Model the context",
      "Vehicles, chargers, energy assets, limits and requests.",
    ],
    [
      "Evaluate constraints and priorities",
      "Readiness, power, energy assumptions and battery considerations.",
    ],
    [
      "Inspect outcomes",
      "Assignments, energy use, estimated cost, battery implications and sustainability metrics.",
    ],
    ["Compare scenarios", "Change assumptions and inspect how outcomes shift."],
  ]
  return (
    <section
      id="how-it-works"
      tabIndex={-1}
      className="bg-deep py-24 text-white outline-none md:py-32"
    >
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="reveal max-w-2xl">
          <Eyebrow dark>How it works</Eyebrow>
          <H2 dark>Four steps from context to comparison.</H2>
        </div>
        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-white/8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li
              key={t}
              className="reveal bg-deep p-7 lg:min-h-64"
              style={{ ["--d" as string]: i }}
            >
              <span className="tnum grid h-9 w-9 place-items-center rounded-full border border-cyan/40 text-sm font-medium text-cyan">
                {i + 1}
              </span>
              <h3 className="mt-8 text-lg font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-white/60">{d}</p>
            </li>
          ))}
        </ol>
        <details className="reveal group mt-8 rounded-xl border border-white/10 open:bg-white/[0.03]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-sm font-medium text-white/85 hover:text-white">
            View the technical method behind each step
            <ChevronRight
              size={16}
              aria-hidden
              className="text-cyan transition-transform duration-200 group-open:rotate-90"
            />
          </summary>
          <ol className="grid gap-5 px-5 pb-5 text-sm leading-relaxed text-white/60 md:grid-cols-2">
            <li>
              <b className="text-white">Model.</b> 15-minute timesteps over a
              demo day; vehicles, chargers, PV, storage and grid limit come from
              an editable configuration.
            </li>
            <li>
              <b className="text-white">Evaluate.</b> Three strategies —
              first-come-first-served, rule-based earliest-deadline and the EVOS
              weighted heuristic — place sessions on compatible chargers within
              a site power cap.
            </li>
            <li>
              <b className="text-white">Inspect.</b> A rule-based dispatch
              serves demand from PV, then storage (above reserve), then grid;
              cost and emissions are calculated from tariff and carbon-intensity
              assumptions.
            </li>
            <li>
              <b className="text-white">Compare.</b> Deterministic: identical
              inputs give identical outputs, so scenario differences reflect
              only the changed assumptions.
            </li>
          </ol>
        </details>
      </div>
    </section>
  )
}

function Sustainability() {
  const { sim } = useStore()
  const t = sim.totals
  return (
    <section
      id="sustainability"
      tabIndex={-1}
      className="bg-white py-24 outline-none md:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-14 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className="reveal relative order-2 lg:order-1">
          <img
            src={SOLAR_IMG}
            srcSet={`${SOLAR_IMG.replace("w=1400", "w=700")} 700w, ${SOLAR_IMG} 1400w`}
            sizes="(min-width:1024px) 560px, 100vw"
            width={1400}
            height={1050}
            alt="Rows of rooftop solar panels"
            className="aspect-[4/3] w-full rounded-2xl bg-soft object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute right-4 bottom-4 left-4 rounded-xl border border-white/60 bg-white/95 p-5 backdrop-blur md:right-auto md:left-6 md:bottom-6 md:w-80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">
                Demo day, estimated
              </span>
              <SimBadge label="Simulated" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="tnum text-2xl font-semibold">
                  {t.emissionsKg.toFixed(0)}
                  <span className="ml-1 text-sm text-muted">kg CO₂e</span>
                </div>
                <div className="text-xs text-muted">EVOS scenario</div>
              </div>
              <div>
                <div className="tnum text-2xl font-semibold text-muted">
                  {t.baselineKg.toFixed(0)}
                  <span className="ml-1 text-sm">kg</span>
                </div>
                <div className="text-xs text-muted">Grid-only baseline</div>
              </div>
            </div>
          </div>
        </div>
        <div className="reveal order-1 lg:order-2">
          <Eyebrow>Sustainability</Eyebrow>
          <H2>Make environmental trade-offs visible.</H2>
          <p className="mt-6 text-[17px] leading-relaxed text-muted">
            Results depend on assumptions, data quality, grid carbon intensity
            and the scenario being evaluated. EVOS shows these clearly and does
            not promise a fixed reduction in emissions.
          </p>
          <ul className="mt-8 space-y-4 border-t border-line pt-6 text-sm">
            {[
              [
                "Comparison baseline",
                "All demand met from grid import, same day and schedule",
              ],
              [
                "Grid carbon intensity",
                `${sim.a.carbonG} g CO₂e/kWh — editable assumption`,
              ],
              [
                "Photovoltaic (PV) output",
                "Modelled from 100 kWp capacity and a daily weather factor",
              ],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-6">
                <span className="font-medium text-ink">{k}</span>
                <span className="text-right text-muted">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const rows = [
    [
      "Measured",
      "Observed from a connected source",
      "None in this demo",
      "neutral",
    ],
    [
      "Simulated",
      "Generated by the EVOS demo model",
      "Fleet, chargers, energy flows",
      "warn",
    ],
    [
      "Estimated",
      "Derived with a stated method and uncertainty",
      "Battery health, emissions, cost",
      "info",
    ],
    [
      "Forecast",
      "Expected values for a selected period",
      "Demand and solar availability",
      "cyan",
    ],
  ] as const
  return (
    <section id="trust" className="bg-soft py-24 md:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-14 px-5 md:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <div className="reveal">
          <Eyebrow>Trust and explainability</Eyebrow>
          <H2>Decisions should be inspectable, not mysterious.</H2>
          <p className="mt-6 text-[17px] leading-relaxed text-muted">
            EVOS shows the inputs, constraints, reasons, alternatives and data
            status behind a recommendation—and separates measured observations
            from simulations, estimates and forecasts.
          </p>
          <ButtonLink to="/app/explain" variant="secondary" className="mt-8">
            View a decision rationale <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <div className="reveal overflow-hidden rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Data provenance categories</caption>
            <thead className="bg-soft/60 text-xs text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Label</th>
                <th className="px-5 py-3 font-medium">Meaning</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">
                  Used for
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([l, m, u]) => (
                <tr key={l}>
                  <td className="px-5 py-4 font-semibold">{l}</td>
                  <td className="px-5 py-4 text-muted">{m}</td>
                  <td className="hidden px-5 py-4 text-muted sm:table-cell">
                    {u}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function Preview() {
  const { sim, alerts, acked } = useStore()
  const t = sim.totals
  const ready = sim.vehicles.filter((v) => v.readiness === "Ready").length
  const active = alerts.filter((a) => !acked.has(a.id)).length
  return (
    <section id="preview" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-5 md:px-8">
        <div className="reveal flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Eyebrow>Product preview</Eyebrow>
            <H2>One calm view of the whole operation.</H2>
          </div>
          <ButtonLink to="/app/overview" variant="secondary">
            Explore the dashboard <ArrowRight size={15} />
          </ButtonLink>
        </div>
        <div className="reveal mt-12 overflow-hidden rounded-2xl border border-line bg-soft p-3 shadow-[0_30px_60px_-30px_rgba(11,18,32,.25)] md:p-5">
          <div className="rounded-xl bg-white p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="text-sm font-semibold">
                  Overview · {fmtT(NOW)} demo day
                </div>
                <div className="text-xs text-muted">
                  Depot model · 20 vehicles · 6 chargers
                </div>
              </div>
              <SimBadge />
            </div>
            <div className="grid gap-8 pt-6 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid grid-cols-2 gap-x-6 gap-y-7">
                <div>
                  <div className="text-xs text-muted">Fleet readiness</div>
                  <div className="tnum mt-1 text-3xl font-semibold">
                    {ready}
                    <span className="text-base text-muted">/20</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Energy today</div>
                  <div className="tnum mt-1 text-3xl font-semibold">
                    {t.load.toFixed(0)}
                    <span className="ml-1 text-base text-muted">kWh</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Renewable share</div>
                  <div className="tnum mt-1 text-3xl font-semibold">
                    {Math.round(t.renewableShare * 100)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Estimated cost</div>
                  <div className="tnum mt-1 text-3xl font-semibold">
                    {inr(t.cost)}
                  </div>
                </div>
                <div className="col-span-2 rounded-lg bg-soft p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Active alerts</span>
                    <span className="tnum text-muted">{active}</span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {alerts.slice(0, 3).map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Status s={a.severity} />
                        <span className="truncate">
                          {a.asset} · {a.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">
                  Energy mix through the day
                </div>
                <TimeChart
                  title="Energy mix"
                  summary="Solar covers most charging at midday; the grid fills the gaps in the morning and evening."
                  unit="kW"
                  height={250}
                  xLabels={sim.flows.map((f) => fmtT(f.t))}
                  marker={{ x: NOW, label: "Now" }}
                  series={[
                    {
                      key: "pv",
                      label: "PV to load",
                      color: C.teal,
                      kind: "area",
                      stack: true,
                      values: sim.flows.map((f) => f.pvToLoad),
                    },
                    {
                      key: "st",
                      label: "Storage",
                      color: C.storage,
                      kind: "area",
                      stack: true,
                      values: sim.flows.map((f) => f.storageToLoad),
                    },
                    {
                      key: "gr",
                      label: "Grid",
                      color: "#AEB9C7",
                      kind: "area",
                      stack: true,
                      values: sim.flows.map((f) => f.grid),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden bg-deep py-24 text-white md:py-32"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_100%,rgba(24,183,201,.18),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1200px] px-5 text-center md:px-8">
        <h2 className="reveal mx-auto max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight md:text-5xl">
          Explore the system.{" "}
          <span className="text-white/55">Understand the trade-offs.</span>
        </h2>
        <div
          className="reveal mt-10 flex flex-wrap justify-center gap-3"
          style={{ ["--d" as string]: 1 }}
        >
          <ButtonLink to="/app/overview" size="lg">
            Open the EVOS demo <ArrowRight size={16} />
          </ButtonLink>
          <ButtonLink to="/app/methodology" variant="onDark" size="lg">
            Explore the methodology
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-white/8 bg-deep py-10 text-sm text-white/55">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="max-w-sm">
          <Logo dark />
          <p className="mt-3 text-xs leading-relaxed">
            Electric Vehicles Operations and Sustainability. A research
            framework demo — all fleet, energy and cost values shown are
            illustrative simulations, not measurements from a real deployment.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3"
        >
          <div>
            <p className="mb-2 text-xs font-medium tracking-wider text-white/35 uppercase">
              Explore
            </p>
            <ul className="space-y-1.5">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => scrollToId(n.id)}
                    className="hover:text-white"
                  >
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wider text-white/35 uppercase">
              Product demo
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/app/overview" className="hover:text-white">
                  Open the demo
                </Link>
              </li>
              <li>
                <Link to="/app/scheduler" className="hover:text-white">
                  Scheduler
                </Link>
              </li>
              <li>
                <Link to="/app/experiments" className="hover:text-white">
                  Experiments
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wider text-white/35 uppercase">
              Transparency
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/app/methodology" className="hover:text-white">
                  Methodology
                </Link>
              </li>
              <li>
                <Link to="/app/datasets" className="hover:text-white">
                  Datasets & sources
                </Link>
              </li>
              <li>
                <Link to="/app/settings" className="hover:text-white">
                  Assumptions
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-[1200px] px-5 text-xs text-white/35 md:px-8">
        Photography via Unsplash.
      </p>
    </footer>
  )
}

export default function Site() {
  useRevealAll()
  return (
    <div className="route-enter">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          scrollToId("challenge")
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main>
        <Hero />
        <Challenge />
        <Approach />
        <Capabilities />
        <HowItWorks />
        <Sustainability />
        <Trust />
        <Preview />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}
