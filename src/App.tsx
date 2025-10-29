import React, { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Clients from "./pages/Clients";
import PropertiesPage from "./pages/Properties";
import CalendarPage from "./pages/Calendar";
import OpportunitiesPage from "./pages/Opportunities";
import Dashboard from "./pages/Dashboard";
import VisitsPage from "./pages/Visits";
import "./styles/App.css";
import { Moon, SunMedium } from "lucide-react";
import { syncPendingVisits } from "./utils/offlineSync";
import MobileMenu from "./components/MobileMenu";

const App: React.FC = () => {
  const [route, setRoute] = useState<string>("Dashboard");
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    async function syncPending() {
      try {
        await syncPendingVisits("/api/");
      } catch (err) {
        console.warn("⚠️ Erro ao tentar sincronizar:", err);
      }
    }

    window.addEventListener("online", syncPending);
    if (navigator.onLine) syncPending();

    return () => {
      window.removeEventListener("online", syncPending);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileApp, setIsMobileApp] = useState(false);

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

  return (
    <div className="app d-flex flex-column vh-100">
      {/* 🔝 Cabeçalho fixo (Bootstrap Navbar) */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top px-3">
        <div className="container-fluid">
          <div className="d-flex align-items-center gap-3">
            {/* ☰ Botão de menu mobile */}
            <button
              className="btn btn-outline-light d-lg-none"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <span className="navbar-brand fw-bold">AgroCRM</span>
          </div>

          {/* 🌗 Alternar tema claro/escuro */}
          <button
            onClick={toggleTheme}
            className="btn btn-outline-light d-flex align-items-center gap-2"
          >
            {theme === "dark" ? (
              <>
                <Moon size={18} /> Escuro
              </>
            ) : (
              <>
                <SunMedium size={18} /> Claro
              </>
            )}
          </button>
        </div>
      </nav>

      {/* 🧭 Sidebar / Menu lateral */}
      <div className="d-flex flex-grow-1">
        {isMobileApp ? (
          menuOpen && (
            <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-75 z-3">
              <MobileMenu
                onNavigate={(r) => {
                  setRoute(r);
                  setMenuOpen(false);
                }}
              />
            </div>
          )
        ) : (
          <div className="d-none d-lg-block bg-dark border-end border-secondary" style={{ width: 240 }}>
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
