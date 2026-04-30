import React from "react";
import {
  LayoutDashboard,
  Users,
  Map,
  Calendar,
  ClipboardList,
  Briefcase,
  MessageSquare,
  LogOut,
  Settings,
  ChevronRight,
} from "lucide-react";
import "./Navbar.css";

type Props = {
  activeItem?: string;
  onNavigate?: (item: string) => void;
  userName?: string;
  userRole?: string;
};

const Navbar: React.FC<Props> = ({
  activeItem = "Dashboard",
  onNavigate = () => {},
  userName = "Usuário",
  userRole = "Consultor",
}) => {
  const sections = [
    {
      title: "Principal",
      items: [
        { label: "Dashboard", icon: <LayoutDashboard size={18} />, color: "#6366f1" },
      ],
    },
    {
      title: "Gestão",
      items: [
        { label: "Clientes", icon: <Users size={18} />, color: "#3b82f6" },
        { label: "Propriedades", icon: <Map size={18} />, color: "#10b981" },
        { label: "Oportunidades", icon: <Briefcase size={18} />, color: "#f59e0b" },
      ],
    },
    {
      title: "Operação",
      items: [
        { label: "Calendário", icon: <Calendar size={18} />, color: "#ec4899" },
        { label: "Acompanhamentos", icon: <ClipboardList size={18} />, color: "#8b5cf6" },
      ],
    },
    {
      title: "Bot",
      items: [
        { label: "Assistente", icon: <MessageSquare size={18} />, color: "#16a34a" },
      ],
    },
  ];

  return (
    <aside className="sidebar-premium d-flex flex-column">
      <div className="sidebar-brand">
        <img
          src="https://agrocrm-backend.onrender.com/static/nutricrm_logo.png"
          alt="NutriCRM"
          className="sidebar-logo-img"
          onClick={() => onNavigate("Dashboard")}
        />
      </div>

      <nav className="sidebar-nav flex-grow-1">
        {sections.map((sec) => (
          <div key={sec.title} className="sidebar-section">
            <div className="sidebar-section-title">{sec.title}</div>
            {sec.items.map((item) => {
              const isActive = activeItem === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.label)}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  style={
                    {
                      "--item-color": item.color,
                    } as React.CSSProperties
                  }
                >
                  <span className="sidebar-link-indicator" />
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span className="sidebar-link-label">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="sidebar-link-chevron" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{userName}</div>
          <div className="sidebar-user-role">{userRole}</div>
        </div>
        <button
          className="sidebar-user-settings"
          title="Configurações"
          onClick={() => onNavigate("Configurações")}
        >
          <Settings size={16} />
        </button>
      </div>

      <button
        className="sidebar-logout"
        onClick={() => alert("🚪 Logout realizado!")}
      >
        <LogOut size={16} />
        <span>Sair</span>
      </button>
    </aside>
  );
};

export default Navbar;
