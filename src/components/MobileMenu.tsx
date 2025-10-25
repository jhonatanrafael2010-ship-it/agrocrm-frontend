import React, { useState } from "react";

interface MobileMenuProps {
  onNavigate: (route: string) => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);

  const handleNavigate = (route: string) => {
    onNavigate(route);
    setOpen(false);
  };

  return (
    <div className="mobile-menu">
      <div className="menu-header">
        <span className="brand">AgroCRM</span>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
      </div>

      {open && (
        <nav className="menu-dropdown">
          <button onClick={() => handleNavigate('Dashboard')}>📊 Dashboard</button>
          <button onClick={() => handleNavigate('Clientes')}>👨‍🌾 Clientes</button>
          <button onClick={() => handleNavigate('Propriedades')}>🏡 Propriedades</button>
          <button onClick={() => handleNavigate('Calendário')}>🗓️ Calendário</button>
          <button onClick={() => handleNavigate('Acompanhamentos')}>🚜 Acompanhamentos</button>
          <button onClick={() => handleNavigate('Oportunidades')}>💼 Oportunidades</button>
          <button onClick={() => alert('🚪 Logout realizado!')}>🚪 Sair</button>
        </nav>
      )}
    </div>
  );
};

export default MobileMenu;
