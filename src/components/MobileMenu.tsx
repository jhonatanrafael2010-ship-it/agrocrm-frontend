import React, { useState } from "react";

const MobileMenu: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-menu">
      <div className="menu-header">
        <span className="brand">AgroCRM</span>
        <button
          className="menu-toggle"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Abrir menu"
        >
          ☰
        </button>
      </div>

      {open && (
        <nav className="menu-dropdown">
          <a href="#dashboard" onClick={() => setOpen(false)}>📊 Dashboard</a>
          <a href="#clients" onClick={() => setOpen(false)}>👨‍🌾 Clientes</a>
          <a href="#fields" onClick={() => setOpen(false)}>🌱 Talhões</a>
          <a href="#calendar" onClick={() => setOpen(false)}>🗓️ Calendário</a>
          <a href="#visits" onClick={() => setOpen(false)}>🚜 Visitas</a>
          <a href="#logout" onClick={() => setOpen(false)}>🚪 Sair</a>
        </nav>
      )}
    </div>
  );
};

export default MobileMenu;
