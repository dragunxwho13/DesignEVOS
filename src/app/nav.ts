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
  Wrench,
  Beaker,
  Database,
  UserRound,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { to: string; label: string; icon: LucideIcon; hint: string }

/** Single source of truth for application navigation (sidebar, top bar, command palette). */
export const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operate",
    items: [
      { to: "overview", label: "Overview", icon: LayoutDashboard, hint: "Readiness, demand and alerts" },
      { to: "fleet", label: "Fleet", icon: Truck, hint: "Vehicle registry and SoC" },
      { to: "scheduler", label: "Scheduler", icon: CalendarClock, hint: "Charger lanes and strategy" },
      { to: "energy", label: "Energy", icon: Zap, hint: "Solar, storage and grid dispatch" },
      { to: "system", label: "System View", icon: Network, hint: "Site topology" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { to: "battery", label: "Battery Health", icon: BatteryMedium, hint: "Estimated SoH and flags" },
      { to: "forecasts", label: "Forecasts", icon: Activity, hint: "Load and solar outlook" },
      { to: "sustainability", label: "Sustainability", icon: Leaf, hint: "Emissions and renewable share" },
      { to: "explain", label: "Explainability", icon: ScanSearch, hint: "Why the scheduler decided" },
      { to: "maintenance", label: "Maintenance & Faults", icon: Wrench, hint: "Charger faults and service" },
    ],
  },
  {
    label: "Plan",
    items: [
      { to: "scenarios", label: "Scenarios", icon: FlaskConical, hint: "What-if assumptions" },
      { to: "experiments", label: "Experiments", icon: Beaker, hint: "Strategy comparisons" },
      { to: "alerts", label: "Alerts", icon: Bell, hint: "Open and acknowledged alerts" },
    ],
  },
]

export const LOWER: NavItem[] = [
  { to: "datasets", label: "Datasets & Sources", icon: Database, hint: "Connection status and provenance" },
  { to: "settings", label: "Configuration", icon: Settings, hint: "Site and tariff assumptions" },
  { to: "methodology", label: "Methodology", icon: BookOpen, hint: "Models and limitations" },
]

export const DRIVER: NavItem = { to: "driver", label: "Driver view", icon: UserRound, hint: "Session and departure readiness" }

export const ALL_NAV: NavItem[] = [...GROUPS.flatMap((g) => g.items), DRIVER, ...LOWER]

export function navContext(section: string) {
  const group = GROUPS.find((g) => g.items.some((i) => i.to === section))
  const item = ALL_NAV.find((i) => i.to === section)
  return { group: group?.label ?? (section === "driver" ? "Driver" : "Workspace"), item }
}
