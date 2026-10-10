import { useRoute } from "./lib/router";
import { StoreProvider } from "./lib/store";
import Site from "./site/Site";
import Shell from "./app/Shell";
import { Overview, Fleet, VehicleDetail, Scheduler, Energy } from "./app/pages1";
import { Battery, Forecasts, Sustainability, Explain } from "./app/pages2";
import { Scenarios, SystemView, Alerts, Settings, Methodology } from "./app/pages3";

function AppRoutes({ path }: { path: string }) {
  const [, , section = "overview", param] = path.split("/");
  let page;
  switch (section) {
    case "fleet": page = param ? <VehicleDetail id={param} /> : <Fleet />; break;
    case "scheduler": page = <Scheduler />; break;
    case "energy": page = <Energy />; break;
    case "battery": page = <Battery />; break;
    case "forecasts": page = <Forecasts />; break;
    case "sustainability": page = <Sustainability />; break;
    case "explain": page = <Explain id={param} />; break;
    case "scenarios": page = <Scenarios />; break;
    case "system": page = <SystemView />; break;
    case "alerts": page = <Alerts />; break;
    case "settings": page = <Settings />; break;
    case "methodology": page = <Methodology />; break;
    default: page = <Overview />;
  }
  return <Shell section={section === "fleet" && param ? "fleet" : section}><div key={path}>{page}</div></Shell>;
}

export default function App() {
  const path = useRoute();
  return (
    <StoreProvider>
      {path.startsWith("/app") ? <AppRoutes path={path} /> : <Site />}
    </StoreProvider>
  );
}
