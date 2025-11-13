import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Clients from "./pages/Clients";
import PropertiesPage from "./pages/Properties";
import CalendarPage from "./pages/Calendar";
import OpportunitiesPage from "./pages/Opportunities";
import Dashboard from "./pages/Dashboard";
import VisitsPage from "./pages/Visits";
import "./styles/app.css";

import {
  syncPendingVisits,
  syncPendingPhotos,
  preloadOfflineData,
} from "./utils/offlineSync";

import MobileMenu from "./components/MobileMenu";
import { API_BASE } from "./config";

import { getNetworkStatus, listenNetworkStatus } from "./utils/safeNetwork";

function App() {
  const [route, setRoute] = useState<string>("Dashboard");
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // ============================================================
  // 🌐 Controle unificado de rede
  // ============================================================
  useEffect(() => {
    async function check() {
      const status = await getNetworkStatus();
      setOffline(!status.connected);
    }

    check();

    listenNetworkStatus((connected) => {
      setOffline(!connected);
    });

    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ============================================================
  // 🔄 Sincronização automática
  // ============================================================
  useEffect(() => {
    async function doSync() {
      try {
        if (offline) return;

        setSyncing(true);

        await syncPendingVisits(API_BASE);
        await syncPendingPhotos(API_BASE);

        window.dispatchEvent(new Event("visits-synced"));

        setLastSync(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      } finally {
        setSyncing(false);
      }
    }

    if (!offline) doSync();
  }, [offline]);

  // ============================================================
  // ⚡ Pré-carregar cache offline
  // ============================================================
  useEffect(() => {
    preloadOfflineData(API_BASE);
  }, []);

  // ============================================================
  // 📱 Detectar mobile
  // ============================================================
  useEffect(() => {
    const detect = () => {
      const isSmall = window.innerWidth <= 900;
      const ua = navigator.userAgent.toLowerCase();
      const runningInApk =
        ua.includes("wv") || ua.includes("android") || ua.includes("agrocrm-apk");

      const mobile = isSmall || runningInApk;

      setIsMobileApp(mobile);
      document.body.setAttribute("data-platform", mobile ? "mobile" : "desktop");
    };

    detect();
    window.addEventListener("resize", detect);

    return () => window.removeEventListener("resize", detect);
  }, []);

  // ============================================================
  // 🧭 Fecha menu ao mudar rota
  // ============================================================
  useEffect(() => {
    const offcanvasEl = document.getElementById("mobileMenu");
    if (offcanvasEl) {
      const bsOffcanvas = (window as any).bootstrap?.Offcanvas.getInstance(offcanvasEl);
      bsOffcanvas?.hide();
    }
  }, [route]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="app d-flex flex-column vh-100">
      {/* navbar */}
      <nav
        className="navbar navbar-expand-lg shadow-sm sticky-top px-3"
        style={{ background: "var(--panel)", color: "var(--text)" }}
      >
        <div className="container-fluid">
          <button
            className="btn btn-outline-light d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#mobileMenu"
          >
            ☰
          </button>
        </div>
      </nav>

      {/* offline bar */}
      {offline && (
        <div
          style={{
            background: "#ffcc00",
            color: "#000",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          📴 Você está offline — dados do cache
        </div>
      )}

      {/* syncing bar */}
      {syncing && !offline && (
        <div
          style={{
            background: "#007bff",
            color: "#fff",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
            animation: "pulse 1.5s infinite",
          }}
        >
          Sincronizando dados...
        </div>
      )}

      {!syncing && lastSync && !offline && (
        <div
          style={{
            background: "#28a745",
            color: "#fff",
            padding: "4px 10px",
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          ✅ Última sincronização: {lastSync}
        </div>
      )}

      {/* conteúdo */}
      <div className="d-flex flex-grow-1">
        {isMobileApp ? (
          <MobileMenu onNavigate={setRoute} activeItem={route} />
        ) : (
          <div
            className="d-none d-lg-block bg-dark border-end border-secondary"
            style={{ width: 240 }}
          >
            <Navbar activeItem={route} onNavigate={setRoute} />
          </div>
        )}

        <main className="flex-grow-1 overflow-auto p-3">
          {route === "Clientes" ? (
            <Clients />
          ) : route === "Propriedades" ? (
            <PropertiesPage />
          ) : route === "Calendário" ? (
            <CalendarPage />
          ) : route === "Oportunidades" ? (
            <OpportunitiesPage />
          ) : route === "Acompanhamentos" ? (
            <VisitsPage />
          ) : (
            <Dashboard />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
