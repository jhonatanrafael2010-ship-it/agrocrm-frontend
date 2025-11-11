import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Clients from "./pages/Clients";
import PropertiesPage from "./pages/Properties";
import CalendarPage from "./pages/Calendar";
import OpportunitiesPage from "./pages/Opportunities";
import Dashboard from "./pages/Dashboard";
import VisitsPage from "./pages/Visits";
import "./styles/app.css";
import { syncPendingVisits, preloadOfflineData } from "./utils/offlineSync";
import MobileMenu from "./components/MobileMenu";

const App: React.FC = () => {
  const [route, setRoute] = useState<string>("Dashboard");
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const API_BASE = "/api/";

  // ============================================================
  // 🔄 Sincronização automática de visitas pendentes
  // ============================================================
  useEffect(() => {
    async function syncPending() {
      try {
        setSyncing(true);
        await syncPendingVisits("/api/");
        window.dispatchEvent(new Event("visits-synced"));
        setLastSync(
          new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        );
      } catch (err) {
        console.warn("⚠️ Erro ao tentar sincronizar:", err);
      } finally {
        setTimeout(() => setSyncing(false), 800);
      }
    }

    window.addEventListener("online", syncPending);
    if (navigator.onLine) syncPending();
    return () => window.removeEventListener("online", syncPending);
  }, []);

  // ============================================================
  // ⚡ Pré-carregamento de dados base
  // ============================================================
  useEffect(() => {
    async function loadBaseData() {
      try {
        await preloadOfflineData(API_BASE);
      } catch (err) {
        console.warn("⚠️ Falha ao pré-carregar dados base:", err);
      }
    }
    loadBaseData();
  }, []);

  // ============================================================
  // 🌐 Status de conexão
  // ============================================================
  useEffect(() => {
    const updateOnlineStatus = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
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
  // ✅ Fecha menu lateral ao mudar rota
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
            {/* ☰ Botão de menu mobile */}
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

      {/* 🌐 Banner global offline */}
      {offline && (
        <div
          style={{
            backgroundColor: "#ffcc00",
            color: "#000",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.9rem",
            borderBottom: "1px solid #d1a800",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: 2000,
          }}
        >
          📴 Você está offline — exibindo dados do cache local
        </div>
      )}

      {/* 🔁 Indicador de sincronização global */}
      {syncing && (
        <div
          style={{
            backgroundColor: "#007bff",
            color: "#fff",
            padding: "6px 12px",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.9rem",
            borderBottom: "1px solid #005dc1",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            animation: "pulse 1.5s infinite",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span className="sync-spinner"></span>
          Sincronizando visitas com o servidor...
        </div>
      )}

      {!syncing && lastSync && !offline && (
        <div
          style={{
            backgroundColor: "#28a745",
            color: "#fff",
            padding: "4px 10px",
            textAlign: "center",
            fontWeight: 500,
            fontSize: "0.8rem",
            borderBottom: "1px solid #1c7a31",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          ✅ Última sincronização: {lastSync}
        </div>
      )}

      {/* 🧭 Sidebar / Conteúdo */}
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

        {/* 📄 Conteúdo principal */}
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
};

export default App;
