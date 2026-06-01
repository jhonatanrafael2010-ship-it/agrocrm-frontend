import { useEffect, useState, useCallback } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { lightTheme, darkTheme } from "./theme/muiTheme";
import Navbar from "./components/Navbar";
import Clients from "./pages/Clients";
import PropertiesPage from "./pages/Properties";
import CalendarPage from "./pages/Calendar";
import OpportunitiesPage from "./pages/Opportunities";
import Dashboard from "./pages/Dashboard";
import VisitsPage from "./pages/Visits";
import ChatPage from "./pages/Chat";
import VisitLinkingPage from "./pages/VisitLinking";
import LoginPage from "./pages/Login";
import AdminUsersPage from "./pages/AdminUsers";
import "./styles/app.css";
import { Toaster } from "sonner";

import Topbar from "./components/Topbar";


import {
  syncPendingVisits,
  syncPendingPhotos,
  preloadOfflineData,
} from "./utils/offlineSync";
import { loadSeedIfNeeded } from "./utils/seedLoader";

import MobileMenu from "./components/MobileMenu";
import { API_BASE } from "./config";
import { isAuthenticated, getUser, logout } from "./services/auth";

function App() {
  // Estado de autenticação
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [currentUser, setCurrentUser] = useState(() => getUser());

  // Toggle de tema manual
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("theme", newValue ? "dark" : "light");
      return newValue;
    });
  }, []);

  const [route, setRoute] = useState<string>(() => {
    const openSection = sessionStorage.getItem("open_section");

    if (openSection === "calendar") {
      return "Calendário";
    }

    if (openSection === "visits") {
      return "Acompanhamentos";
    }

    if (openSection === "clients") {
      return "Clientes";
    }

    if (openSection === "properties") {
      return "Propriedades";
    }

    if (openSection === "opportunities") {
      return "Oportunidades";
    }

    if (openSection === "chat") {
      return "Assistente";
    }

    return "Dashboard";
  });
  const [isMobileApp, setIsMobileApp] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    // Detecta preferência do sistema operacional
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Escuta mudanças na preferência do sistema (quando usuário alterna modo no SO)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      // Só aplica se não tiver preferência salva manualmente
      if (!localStorage.getItem("theme")) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Sincroniza atributo data-theme no body (para CSS legado)
  useEffect(() => {
    document.body.setAttribute("data-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Callback de login bem-sucedido
  const handleLoginSuccess = useCallback(() => {
    setAuthenticated(true);
    setCurrentUser(getUser());
  }, []);

  // Callback de logout
  const handleLogout = useCallback(async () => {
    await logout();
    setAuthenticated(false);
    setCurrentUser(null);
  }, []);


  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);

    update();
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
  // ⚡ Carregar seed (se IndexedDB vazio) + pré-carregar cache
  // ============================================================
  useEffect(() => {
    async function initOfflineData() {
      // 1. Se IndexedDB vazio, carrega dados seed embutidos no APK
      const seedLoaded = await loadSeedIfNeeded();
      if (seedLoaded) {
        console.log("📦 Dados seed carregados - app pronto para uso offline!");
      }

      // 2. Se online, atualiza com dados frescos da API
      if (navigator.onLine) {
        await preloadOfflineData(API_BASE);
      }
    }

    initOfflineData();
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

  useEffect(() => {
    const openSection = sessionStorage.getItem("open_section");
    if (!openSection) return;

    sessionStorage.removeItem("open_section");
  }, []);

  // ============================================================
  // RENDER
  // ============================================================
  const muiTheme = isDarkMode ? darkTheme : lightTheme;

  // Se não autenticado, mostra tela de login
  if (!authenticated) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <LoginPage onSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
    <CssBaseline />
    <div className="app d-flex flex-column vh-100">
      {/* conteúdo */}
      <div className="d-flex flex-grow-1">
        {/* Sidebar desktop */}
        {!isMobileApp && (
          <div className="d-none d-lg-block sidebar-wrapper">
            <Navbar
              activeItem={route}
              onNavigate={setRoute}
              userName={currentUser?.consultant_name || currentUser?.username || "Usuário"}
              userRole={currentUser?.is_admin ? "Administrador" : "Consultor"}
              isAdmin={currentUser?.is_admin || false}
              onLogout={handleLogout}
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
            />
          </div>
        )}

        <main className="flex-grow-1 overflow-auto d-flex flex-column">
          {/* Topbar apenas no desktop */}
          {!isMobileApp && (
            <Topbar
              activeItem={route}
              lastSync={lastSync}
              syncing={syncing}
              offline={offline}
              onNavigate={setRoute}
            />
          )}
          <div className="page-content flex-grow-1" style={{ paddingBottom: isMobileApp ? 80 : 0 }}>
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
            ) : route === "Vincular Visitas" ? (
              <VisitLinkingPage />
            ) : route === "Assistente" ? (
              <ChatPage />
            ) : route === "Usuários" && currentUser?.is_admin ? (
              <AdminUsersPage />
            ) : (
              <Dashboard />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Menu (Drawer + BottomNavigation) */}
      {isMobileApp && (
        <MobileMenu
          onNavigate={setRoute}
          activeItem={route}
          userName={currentUser?.consultant_name || currentUser?.username}
          isAdmin={currentUser?.is_admin || false}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
        />
      )}

      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={3500}
        toastOptions={{
          style: {
            background: "var(--panel)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </div>
    </ThemeProvider>
  );
}

export default App;
