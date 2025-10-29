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
      className="d-flex flex-column bg-dark text-light border-end border-secondary h-100 p-3"
      style={{ width: 240 }}
    >
      {/* 🔹 Logo / Marca */}
      <div className="mb-4 text-center">
        <span
          className="fw-bold fs-5 text-success"
          style={{ letterSpacing: "0.5px", cursor: "pointer" }}
          onClick={() => onNavigate("Dashboard")}
        >
          AgroCRM
        </span>
      </div>

      {/* 🔹 Navegação */}
      <nav className="flex-grow-1">
        <div className="list-group list-group-flush">
          {links.map((item) => (
            <button
              key={item.label}
              onClick={() => onNavigate(item.label)}
              className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${
                activeItem === item.label
                  ? "active bg-success border-success text-white"
                  : "bg-transparent text-light border-0"
              }`}
              style={{
                transition: "background 0.2s ease, color 0.2s ease",
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* 🔹 Rodapé (Logout) */}
      <div className="mt-auto pt-3 border-top border-secondary">
        <button
          className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
          onClick={() => alert("🚪 Logout realizado!")}
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  );
};

export default Navbar;
