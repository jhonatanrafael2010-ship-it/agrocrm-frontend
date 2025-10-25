import React, { useState } from "react";
import {
  Home,
  Users,
  Map,
  Calendar,
  Briefcase,
  ClipboardList,
  LogOut,
} from "lucide-react";

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
          <button onClick={() => handleNavigate("Dashboard")}>
            <Home size={16} /> Dashboard
          </button>
          <button onClick={() => handleNavigate("Clientes")}>
            <Users size={16} /> Clientes
          </button>
          <button onClick={() => handleNavigate("Propriedades")}>
            <Map size={16} /> Propriedades
          </button>
          <button onClick={() => handleNavigate("Calendário")}>
            <Calendar size={16} /> Calendário
          </button>
          <button onClick={() => handleNavigate("Acompanhamentos")}>
            <ClipboardList size={16} /> Acompanhamentos
          </button>
          <button onClick={() => handleNavigate("Oportunidades")}>
            <Briefcase size={16} /> Oportunidades
          </button>
          <button
            className="logout"
            onClick={() => alert("🚪 Logout realizado!")}
          >
            <LogOut size={16} /> Sair
          </button>
        </nav>
      )}
    </div>
  );
};

export default MobileMenu;
