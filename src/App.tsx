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
import { openDB } from 'idb';
import { saveVisitOffline, syncPendingVisits } from './utils/offlineSync'




const App: React.FC = () => {
  const [route, setRoute] = useState<string>('Dashboard')
  const [theme, setTheme] = useState(() => {
    // Lê do localStorage ou do tema do sistema
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
  // Função para salvar visitas offline
  async function saveVisitOffline(visit: any) {
    const db = await openDB('agrocrm', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pendingVisits')) {
          db.createObjectStore('pendingVisits', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
    await db.put('pendingVisits', visit);
  }

  // Função que envia as visitas pendentes ao backend
  async function syncPendingVisits() {
    const db = await openDB('agrocrm', 1);
    const all = await db.getAll('pendingVisits');

    for (const visit of all) {
      try {
        const resp = await fetch('/api/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visit),
        });
        if (resp.ok) {
          await db.delete('pendingVisits', visit.id);
          console.log('✅ Visita sincronizada:', visit);
        }
      } catch (err) {
        console.log('⚠️ Ainda offline:', err);
      }
    }
  }

  // Tenta sincronizar ao voltar a ficar online
  window.addEventListener('online', syncPendingVisits);

  // Sincroniza imediatamente se já estiver online
  if (navigator.onLine) syncPendingVisits();

  // Cleanup do event listener
  return () => {
    window.removeEventListener('online', syncPendingVisits);
  };
}, []);

useEffect(() => {
  window.addEventListener('online', () => syncPendingVisits('/api/'))
  if (navigator.onLine) syncPendingVisits('/api/')
  return () => window.removeEventListener('online', () => syncPendingVisits('/api/'))
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
