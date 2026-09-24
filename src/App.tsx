import { lazy, Suspense, useEffect, useState } from "react";
import DriverApp from "./DriverApp";
const AdminApp = lazy(() => import("./AdminApp"));
export default function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const update = () => setRoute(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  // Hash routes also work on static hosting, a subdirectory, and Capacitor.
  return route.startsWith("#/admin") ? (
    <Suspense
      fallback={<div className="loading">Abrindo o acesso técnico…</div>}
    >
      <AdminApp />
    </Suspense>
  ) : (
    <DriverApp />
  );
}
