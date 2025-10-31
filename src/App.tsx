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
  // ===========================================
  // 🌙 Controle de tema (escuro/claro) — Corrigido
  // ===========================================
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored) return stored;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  });

  // 🔧 Função única para aplicar tema global (sincroniza Bootstrap + app)
  const applyTheme = (themeValue: string) => {
    document.documentElement.setAttribute("data-theme", themeValue);
    document.documentElement.setAttribute("data-bs-theme", themeValue);
    document.body.setAttribute("data-theme", themeValue); // ✅ garante herança global
    localStorage.setItem("theme", themeValue);
  };


  // Atualiza tema quando o state muda
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Alternar entre temas
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };


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

  // ✅ Força fechamento da offcanvas quando muda de rota
  useEffect(() => {
    const offcanvasEl = document.getElementById("mobileMenu");
    if (offcanvasEl) {
      const bsOffcanvas = (window as any).bootstrap?.Offcanvas.getInstance(offcanvasEl);
      bsOffcanvas?.hide();
    }
  }, [route]);

  return (
    <div className="app d-flex flex-column vh-100">
      {/* 🔝 Cabeçalho fixo (Bootstrap Navbar) */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm sticky-top px-3">
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

            <span
              className="navbar-brand fw-bold"
              style={{ letterSpacing: "0.5px" }}
            >
              AgroCRM
            </span>
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
