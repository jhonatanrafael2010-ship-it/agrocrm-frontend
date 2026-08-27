import { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { lightTheme, darkTheme } from "./theme/muiTheme";
import Navbar from "./components/Navbar";
import Clients from "./pages/Clients";
import PropertiesPage from "./pages/Properties";
import PropertiesMapPage from "./pages/PropertiesMap";
import CalendarPage from "./pages/Calendar";
import OpportunitiesPage from "./pages/Opportunities";
import Dashboard from "./pages/Dashboard";
import VisitsPage from "./pages/Visits";
import ChatPage from "./pages/Chat";
import VisitLinkingPage from "./pages/VisitLinking";
import LoginPage from "./pages/Login";
import AdminUsersPage from "./pages/AdminUsers";
import SalesPage from "./pages/Sales";
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
import { ROUTE_PATHS, PATH_TO_LABEL } from "./routes";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

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

  // Deriva a rota atual do pathname
  const currentRoute = PATH_TO_LABEL[location.pathname] || "Dashboard";

  // Função de navegação que converte label -> path
  const handleNavigate = useCallback((label: string) => {
    const path = ROUTE_PATHS[label] || "/";
    navigate(path);
  }, [navigate]);

  const [isMobileApp, setIsMobileApp] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Escuta mudanças na preferência do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Sincroniza atributo data-theme no body
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

  // Redireciona baseado em open_section do sessionStorage
  useEffect(() => {
    const openSection = sessionStorage.getItem("open_section");
    if (!openSection) return;

    sessionStorage.removeItem("open_section");

    const sectionMap: Record<string, string> = {
      calendar: "/calendario",
      visits: "/acompanhamentos",
      clients: "/clientes",
      properties: "/propriedades",
      opportunities: "/oportunidades",
      chat: "/assistente",
    };

    const targetPath = sectionMap[openSection];
    if (targetPath && location.pathname !== targetPath) {
      navigate(targetPath);
    }
  }, [navigate, location.pathname]);

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
      const seedLoaded = await loadSeedIfNeeded();
      if (seedLoaded) {
        console.log("📦 Dados seed carregados - app pronto para uso offline!");
      }

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
      const bsOffcanvas = (window as unknown as { bootstrap?: { Offcanvas: { getInstance: (el: HTMLElement) => { hide: () => void } | null } } }).bootstrap?.Offcanvas.getInstance(offcanvasEl);
      bsOffcanvas?.hide();
    }
  }, [location.pathname]);

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
              activeItem={currentRoute}
              onNavigate={handleNavigate}
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
              activeItem={currentRoute}
              lastSync={lastSync}
              syncing={syncing}
              offline={offline}
              onNavigate={handleNavigate}
            />
          )}
          <div className="page-content flex-grow-1" style={{ paddingBottom: isMobileApp ? 80 : 0 }}>
            <Routes>
              <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
              <Route path="/assistente" element={<ChatPage />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/propriedades" element={<PropertiesPage />} />
              <Route path="/mapa" element={<PropertiesMapPage />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/acompanhamentos" element={<VisitsPage />} />
              <Route path="/vincular-visitas" element={<VisitLinkingPage />} />
              <Route path="/oportunidades" element={<OpportunitiesPage />} />
              <Route path="/vendas" element={<SalesPage />} />
              {currentUser?.is_admin && (
                <Route path="/usuarios" element={<AdminUsersPage />} />
              )}
              <Route path="*" element={<Dashboard onNavigate={handleNavigate} />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Mobile Menu (Drawer + BottomNavigation) */}
      {isMobileApp && (
        <MobileMenu
          onNavigate={handleNavigate}
          activeItem={currentRoute}
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

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
