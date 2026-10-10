import { lazy, Suspense } from "react";
import { useRoute } from "./lib/router";
import { StoreProvider } from "./lib/store";
import Site from "./site/Site";
import { Spinner } from "./components/ui";

// The operational app is split from the public site so first paint of the website stays light.
const AppRoutes = lazy(() => import("./app/AppRoutes"));

export default function App() {
  const path = useRoute();
  return (
    <StoreProvider>
      {path.startsWith("/app") ? (
        <Suspense fallback={<div className="grid min-h-screen place-items-center bg-soft"><Spinner label="Loading EVOS workspace…" /></div>}>
          <AppRoutes path={path} />
        </Suspense>
      ) : <Site />}
    </StoreProvider>
  );
}
