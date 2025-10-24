import React, { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Clients from './pages/Clients'
import PropertiesPage from './pages/Properties'
import CalendarPage from './pages/Calendar'
import OpportunitiesPage from './pages/Opportunities'
import Dashboard from './pages/Dashboard'
import VisitsPage from './pages/Visits'
import './App.css'
import { Moon, SunMedium } from "lucide-react";
import { syncPendingVisits } from './utils/offlineSync'

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

  return (
    <>
      {/* 🌗 Botão flutuante de modo claro/escuro */}
      <button onClick={toggleTheme} className="theme-toggle">
        {theme === 'dark' ? (
          <Moon size={20} strokeWidth={1.6} />
        ) : (
          <SunMedium size={20} strokeWidth={1.6} />
        )}
      </button>

      {/* Estrutura principal */}
      <Navbar activeItem={route} onNavigate={setRoute} />
      <main
        key={route}
        style={{
          padding: '2.5rem 1rem 2rem',
          maxWidth: 1100,
          margin: '0 auto',
          marginLeft: 240,
          transition: 'background-color 0.3s ease, color 0.3s ease'
        }}
      >
        {route === 'Clientes' ? <Clients />
          : route === 'Propriedades' ? <PropertiesPage />
          : route === 'Calendário' ? <CalendarPage />
          : route === 'Oportunidades' ? <OpportunitiesPage />
          : route === 'Acompanhamentos' ? <VisitsPage />
          : route === 'Dashboard' ? <Dashboard />
          : <Clients />}
      </main>
    </>
  )
}

export default App
