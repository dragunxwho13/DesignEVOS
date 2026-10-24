import { lazy, Suspense, useEffect } from "react"
import ErrorBoundary from "./components/ErrorBoundary"
import { useRoute } from "./lib/router"
import { StoreProvider } from "./lib/store"
import Site from "./site/Site"
import { Spinner } from "./components/ui"

// The operational app is split from the public site so first paint of the website stays light.
const AppRoutes = lazy(() => import("./app/AppRoutes"))

const TITLES: Record<string, string> = {
  overview: "Overview",
  fleet: "Fleet",
  scheduler: "Charging scheduler",
  energy: "Energy manager",
  system: "System view",
  battery: "Battery health",
  forecasts: "Forecasting",
  sustainability: "Sustainability",
  explain: "Explainability",
  maintenance: "Maintenance & faults",
  scenarios: "What-if simulator",
  experiments: "Experiments",
  alerts: "Alerts",
  datasets: "Datasets & sources",
  settings: "Configuration",
  methodology: "Methodology",
  driver: "Driver view",
}

export default function App() {
  const path = useRoute()
  useEffect(() => {
    const seg = path.split("/")[2]
    const name = seg ? (TITLES[seg] ?? "Not found") : null
    document.title = name
      ? `${name} · EVOS demo`
      : "EVOS — Electric Vehicles Operations & Sustainability"
  }, [path])
  return (
    <ErrorBoundary resetKey={path}>
      <StoreProvider>
        {path.startsWith("/app") ? (
          <Suspense
            fallback={
              <div className="grid min-h-screen place-items-center bg-soft">
                <Spinner label="Loading EVOS workspace…" />
              </div>
            }
          >
            <AppRoutes path={path} />
          </Suspense>
        ) : (
          <Site />
        )}
      </StoreProvider>
    </ErrorBoundary>
  )
}
