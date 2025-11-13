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
import { Network } from "@capacitor/network";

function App() {
  const [route, setRoute] = useState<string>("Dashboard");
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // ============================================================
  // 🌐 Controle unificado de conexão (Capacitor + fallback)
  // ============================================================
  useEffect(() => {
    async function checkStatus() {
      try {
        const status = await Network.getStatus();
        setOffline(!status.connected);
      } catch {
        // fallback caso Capacitor falhe (web)
        setOffline(!navigator.onLine);
      }
    }

    checkStatus();

    const listener = Network.addListener("networkStatusChange", (status) => {
      setOffline(!status.connected);
    });

    // fallback adicional para web
    const updateWebStatus = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateWebStatus);
    window.addEventListener("offline", updateWebStatus);

    return () => {
      listener.remove();
      window.removeEventListener("online", updateWebStatus);
      window.removeEventListener("offline", updateWebStatus);
    };
  }, []);

  // ============================================================
  // 🔄 Sincronização automática (dispara ao voltar online)
  // ============================================================
  useEffect(() => {
    async function doSync() {
      try {
        if (offline) return;

        setSyncing(true);

        const before = Date.now();

        await syncPendingVisits(API_BASE);
        await syncPendingPhotos(API_BASE);

        // Só dispara evento de sync se realmente demorou ou houve itens
        if (Date.now() - before > 200) {
          window.dispatchEvent(new Event("visits-synced"));
        }

        setLastSync(
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      } catch (err) {
        console.warn("⚠️ Erro ao sincronizar:", err);
      } finally {
        setSyncing(false);
      }
    }

    if (!offline) doSync(); // quando voltar online → sincroniza automaticamente
  }, [offline]);

  // ============================================================
  // ⚡ Pré-carregamento offline inicial
  // ============================================================
  useEffect(() => {
    async function load() {
      try {
        await preloadOfflineData(API_BASE);
      } catch (err) {
        console.log("⚠️ Falha ao pré-carregar cache:", err);
      }
    }
    load();
  }, []);

  // ============================================================
  // 📱 Detectar mobile vs desktop
  // ============================================================
  useEffect(() => {
    const detect = () => {
      const isSmallScreen = window.innerWidth <= 900;
      const ua = navigator.userAgent.toLowerCase();
      const runningInApk =
        ua.includes("wv") || ua.includes("android") || ua.includes("agrocrm-apk");

      const mobile = isSmallScreen || runningInApk;
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
  // Render
  // ============================================================
  return (
    <div className="app d-flex flex-column vh-100">
      {/* 🔝 Cabeçalho fixo */}
      <nav
        className="navbar navbar-expand-lg shadow-sm sticky-top px-3"
        style={{ background: "var(--panel)", color: "var(--text)" }}
      >
        <div className="container-fluid">
          <div className="d-flex align-items-center gap-3">
            {/* ☰ Botão mobile */}
            <button
              className="btn btn-outline-light d-lg-none"
              type="button"
              data-bs-toggle="offcanvas"
              data-bs-target="#mobileMenu"
              aria-controls="mobileMenu"
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* 🌐 Banner Global OFFLINE */}
      {offline && (
        <div
          style={{
            background: "#ffcc00",
            color: "#000",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.9rem",
            borderBottom: "1px solid #d1a800",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          }}
        >
          📴 Você está offline — exibindo dados do cache
        </div>
      )}

      {/* 🔁 Banner Global de Sync */}
      {syncing && !offline && (
        <div
          style={{
            backgroundColor: "#007bff",
            color: "#fff",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
            animation: "pulse 1.5s infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span className="sync-spinner"></span>
          Sincronizando dados...
        </div>
      )}

      {/* Último sync */}
      {!syncing && lastSync && !offline && (
        <div
          style={{
            backgroundColor: "#28a745",
            color: "#fff",
            padding: "4px 10px",
            textAlign: "center",
            fontWeight: 500,
            fontSize: "0.8rem",
          }}
        >
          ✅ Última sincronização: {lastSync}
        </div>
      )}

      {/* Conteúdo */}
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

        <main
          key={route}
          className="flex-grow-1 overflow-auto p-3"
          style={{ minHeight: "calc(100vh - 56px)" }}
        >
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
          ) : route === "Dashboard" ? (
            <Dashboard />
          ) : (
            <Clients />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
