import React from "react";
import {
  Home,
  Users,
  Map,
  Calendar,
  ClipboardList,
  Briefcase,
  LogOut,
} from "lucide-react";
import "./Navbar.css";
import ThemeToggle from "../components/ThemeToggle";

type Props = {
  activeItem?: string;
  onNavigate?: (item: string) => void;
};

const Navbar: React.FC<Props> = ({
  activeItem = "Dashboard",
  onNavigate = () => {},
}) => {
  const links = [
    { label: "Dashboard", icon: <Home size={18} /> },
    { label: "Clientes", icon: <Users size={18} /> },
    { label: "Propriedades", icon: <Map size={18} /> },
    { label: "Calendário", icon: <Calendar size={18} /> },
    { label: "Acompanhamentos", icon: <ClipboardList size={18} /> },
    { label: "Oportunidades", icon: <Briefcase size={18} /> },
  ];

  return (
    <aside
      className="d-flex flex-column border-end h-100 p-3"
      style={{
        width: 240,
        background: "var(--panel)",
        color: "var(--text)",
        borderColor: "var(--border)",
        transition: "background 0.3s ease, color 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* 🔹 Logo NutriCRM (sem texto AgroCRM) */}
      <div
        className="sidebar-logo text-center py-2"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: "10px",
        }}
      >
        <img
          src="https://agrocrm-backend.onrender.com/static/nutricrm_logo.png"
          alt="NutriCRM Logo"
          style={{
            width: "200px",
            height: "auto",
            objectFit: "contain",
            margin: "0 auto",
            display: "block",
            filter: "drop-shadow(0 0 4px rgba(0,0,0,0.3))",
            cursor: "pointer",
          }}
          onClick={() => onNavigate("Dashboard")}
        />
      </div>


      {/* 🔹 Navegação */}
      <nav className="flex-grow-1" style={{ color: "var(--text)" }}>
        <div className="list-group list-group-flush">
          {links.map((item) => {
            const isActive = activeItem === item.label;
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.label)}
                className={`list-group-item d-flex align-items-center gap-2 ${
                  isActive ? "active" : "bg-transparent border-0"
                }`}
                style={{
                  transition: "background 0.25s ease, color 0.25s ease",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 🔹 Rodapé (Tema + Logout) */}
      <div
        className="mt-auto pt-3 border-top"
        style={{ borderColor: "var(--border)" }}
      >
        <ThemeToggle />
        <button
          className="btn w-100 d-flex align-items-center justify-content-center gap-2 mt-3"
          style={{
            background: "transparent",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "var(--text)",
            transition: "all 0.25s ease",
          }}
          onClick={() => alert("🚪 Logout realizado!")}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.15)";
            e.currentTarget.style.color = "#ff6b6b";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text)";
          }}
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
