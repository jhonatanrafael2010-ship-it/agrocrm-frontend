import React, { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Clients from './pages/Clients'
import PropertiesPage from './pages/Properties'
import CalendarPage from './pages/Calendar'
import OpportunitiesPage from './pages/Opportunities'
import Dashboard from './pages/Dashboard'
import VisitsPage from './pages/Visits'
import './App.css'

const App: React.FC = () => {
  const [route, setRoute] = useState<string>('Dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <>
      {/* Botão flutuante de modo claro/escuro */}
      <button
        onClick={toggleTheme}
        className="theme-toggle-btn"
        title="Alternar tema"
      >
        {theme === 'dark' ? '🌞' : '🌙'}
      </button>

      {/* Estrutura principal do app */}
      <Navbar activeItem={route} onNavigate={setRoute} />
      <main style={{ padding: '2.5rem 1rem 2rem', maxWidth: 1100, margin: '0 auto', marginLeft: 240 }}>
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
