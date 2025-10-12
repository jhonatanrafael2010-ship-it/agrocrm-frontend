import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Clients from './pages/Clients';
import PropertiesPage from './pages/Properties';
import CalendarPage from './pages/Calendar';
import OpportunitiesPage from './pages/Opportunities';
import Dashboard from './pages/Dashboard';
import VisitsPage from './pages/Visits';

const App: React.FC = () => {
  const [route, setRoute] = useState<string>('Dashboard')

  return (
    <div>
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
    </div>
  );
};

export default App;
