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
      className="sidebar d-flex flex-column border-end h-100 p-3 sidebar-panel"
      style={{ width: 240 }}
    >
      {/* 🔹 Logo NutriCRM */}
      <div className="sidebar-logo text-center py-2">
        <img
          src="https://agrocrm-backend.onrender.com/static/nutricrm_logo.png"
          alt="NutriCRM Logo"
          className="logo-img"
          onClick={() => onNavigate("Dashboard")}
        />
      </div>

      {/* 🔹 Navegação */}
      <nav className="flex-grow-1">
        <div className="list-group list-group-flush">
          {links.map((item) => {
            const isActive = activeItem === item.label;
            return (
              <button
                key={item.label}
                onClick={() => onNavigate(item.label)}
                className={`list-group-item d-flex align-items-center gap-2 ${
                  isActive ? "active" : ""
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 🔹 Rodapé (Logout) */}
      <div className="mt-auto pt-3 border-top sidebar-footer">
        <button
          className="btn navbar-logout-btn w-100 d-flex align-items-center justify-content-center gap-2 mt-3"
          onClick={() => alert("🚪 Logout realizado!")}
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
