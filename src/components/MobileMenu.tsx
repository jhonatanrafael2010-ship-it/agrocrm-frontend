import React from "react";
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
  return (
    <nav
      className="menu-dropdown"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--panel)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        padding: "0.4rem 0",
        margin: "1rem",
        zIndex: 9999,
      }}
    >
      {[
        { icon: <Home size={16} />, label: "Dashboard" },
        { icon: <Users size={16} />, label: "Clientes" },
        { icon: <Map size={16} />, label: "Propriedades" },
        { icon: <Calendar size={16} />, label: "Calendário" },
        { icon: <ClipboardList size={16} />, label: "Acompanhamentos" },
        { icon: <Briefcase size={16} />, label: "Oportunidades" },
      ].map((item) => (
        <button
          key={item.label}
          onClick={() => onNavigate(item.label)}
          style={{
            background: "none",
            border: "none",
            color: "var(--text)",
            fontSize: "0.95rem",
            fontWeight: 500,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
        >
          {item.icon} {item.label}
        </button>
      ))}

      <button
        className="logout"
        onClick={() => alert("🚪 Logout realizado!")}
        style={{
          background: "rgba(239,68,68,0.1)",
          color: "#ef4444",
          borderTop: "1px solid var(--border)",
          padding: "12px 16px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <LogOut size={16} /> Sair
      </button>
    </nav>
  );
};

export default MobileMenu;
