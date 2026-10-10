import type { ReactNode } from "react";
import Shell, { PageHeader } from "./Shell";
import { Overview, Fleet, VehicleDetail, Scheduler, Energy } from "./pages1";
import { Battery, Forecasts, Sustainability, Explain } from "./pages2";
import { Scenarios, SystemView, Alerts, Settings, Methodology } from "./pages3";
import { Datasets } from "./pages4";
import { Maintenance, Experiments } from "./pages5";
import { ButtonLink } from "../components/ui";

const PAGES: Record<string, (p?: string) => ReactNode> = {
  overview: () => <Overview />,
  fleet: (p) => (p ? <VehicleDetail id={p} /> : <Fleet />),
  scheduler: () => <Scheduler />,
  energy: () => <Energy />,
  battery: () => <Battery />,
  forecasts: () => <Forecasts />,
  sustainability: () => <Sustainability />,
  explain: (p) => <Explain id={p} />,
  maintenance: () => <Maintenance />,
  scenarios: () => <Scenarios />,
  experiments: () => <Experiments />,
  system: () => <SystemView />,
  alerts: () => <Alerts />,
  datasets: () => <Datasets />,
  settings: () => <Settings />,
  methodology: () => <Methodology />,
};

export default function AppRoutes({ path }: { path: string }) {
  const [, , section = "overview", param] = path.split("/");
  const render = PAGES[section || "overview"];
  return (
    <Shell section={section || "overview"}>
      <div key={path}>
        {render ? render(param) : (
          <>
            <PageHeader title="Page not found" sub={`There is no EVOS page at “${path}”.`} />
            <ButtonLink to="/app/overview" variant="secondary">Go to overview</ButtonLink>
          </>
        )}
      </div>
    </Shell>
  );
}
