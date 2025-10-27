import React, { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Clients from './pages/Clients'
import PropertiesPage from './pages/Properties'
import CalendarPage from './pages/Calendar'
import OpportunitiesPage from './pages/Opportunities'
import Dashboard from './pages/Dashboard'
import VisitsPage from './pages/Visits'
import './styles/App.css'
import { Moon, SunMedium } from "lucide-react";
import { syncPendingVisits } from './utils/offlineSync'
import MobileMenu from './components/MobileMenu';


const App: React.FC = () => {
  const [route, setRoute] = useState<string>('Dashboard')
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })

  // Aplica o tema dinamicamente no <body>
  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // --------------------------------------------------------------------
  // 🔄 Sincronização offline → online
  // --------------------------------------------------------------------
  useEffect(() => {
    async function syncPending() {
      try {
        await syncPendingVisits('/api/')
      } catch (err) {
        console.warn('⚠️ Erro ao tentar sincronizar:', err)
      }
    }

    window.addEventListener('online', syncPending)
    if (navigator.onLine) syncPending()

    return () => {
      window.removeEventListener('online', syncPending)
    }
  }, [])

  // Alterna tema manualmente
  function toggleTheme() {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

console.log('📦 App renderizou com rota:', route)

const [menuOpen, setMenuOpen] = useState(false);
// Detecta se o usuário está em modo APK (tela pequena ou userAgent)
const [isMobileApp, setIsMobileApp] = useState(false);

useEffect(() => {
  const detect = () => {
    const isSmallScreen = window.innerWidth <= 900;
    const ua = navigator.userAgent.toLowerCase();
    const runningInApk =
      ua.includes('wv') || ua.includes('android') || ua.includes('agrocrm-apk');

    const mobile = isSmallScreen || runningInApk;
    setIsMobileApp(mobile);
    document.body.setAttribute('data-platform', mobile ? 'mobile' : 'desktop');
  };

  detect(); // roda já na montagem
  window.addEventListener('resize', detect);
  return () => window.removeEventListener('resize', detect);
}, []);


return (
  <div className="app">
    {/* 🔝 Cabeçalho fixo com título e botões */}
    <header className="app-header">
      <div className="header-left">
        {/* ☰ Botão de menu mobile */}
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <h1 className="app-title">AgroCRM</h1>
      </div>

      {/* 🌗 Alternar tema claro/escuro */}
      <button onClick={toggleTheme} className="theme-toggle-btn">
        {theme === 'dark' ? (
          <Moon size={18} strokeWidth={1.6} />
        ) : (
          <SunMedium size={18} strokeWidth={1.6} />
        )}
      </button>
    </header>

    {/* Menus */}
    {isMobileApp ? (
      menuOpen && (
        <div className="mobile-overlay">
          <MobileMenu
            onNavigate={(r) => {
              setRoute(r);
              setMenuOpen(false);
            }}
          />
        </div>
      )
    ) : (
      <Navbar activeItem={route} onNavigate={setRoute} />
    )}



    {/* 📄 Conteúdo principal */}
    <main
      key={route}
      className="main-content"
      style={{
        marginLeft: window.innerWidth > 900 ? 240 : 0,
      }}
    >
      {route === 'Clientes' ? (
        <Clients />
      ) : route === 'Propriedades' ? (
        <PropertiesPage />
      ) : route === 'Calendário' ? (
        <CalendarPage />
      ) : route === 'Oportunidades' ? (
        <OpportunitiesPage />
      ) : route === 'Acompanhamentos' ? (
        <VisitsPage />
      ) : route === 'Dashboard' ? (
        <Dashboard />
      ) : (
        <Clients />
      )}
    </main>
  </div>
);
};

export default App;
