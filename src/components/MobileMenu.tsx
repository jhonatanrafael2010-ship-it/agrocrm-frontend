import React, { useEffect } from "react";
import {
  Home,
  Users,
  Map,
  Calendar,
  ClipboardList,
  Briefcase,
  LogOut,
} from "lucide-react";
import "./MobileMenu.css";

// @ts-ignore
declare const bootstrap: any;

interface MobileMenuProps {
  onNavigate: (route: string) => void;
  activeItem?: string;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate, activeItem }) => {
  useEffect(() => {
    const offcanvasEl = document.getElementById("mobileMenu");
    if (offcanvasEl) {
      offcanvasEl.addEventListener("hide.bs.offcanvas", () => {
        document.body.classList.remove("offcanvas-open");
      });
    }
  }, []);

  const links = [
    { label: "Dashboard", icon: <Home size={18} /> },
    { label: "Clientes", icon: <Users size={18} /> },
    { label: "Propriedades", icon: <Map size={18} /> },
    { label: "Calendário", icon: <Calendar size={18} /> },
    { label: "Acompanhamentos", icon: <ClipboardList size={18} /> },
    { label: "Oportunidades", icon: <Briefcase size={18} /> },
  ];

  return (
    <div
      className="offcanvas offcanvas-start"
      tabIndex={-1}
      id="mobileMenu"
      aria-labelledby="mobileMenuLabel"
    >
      {/* ========================================================= */}
      {/* 🔰 Cabeçalho com logo NutriCRM */}
      {/* ========================================================= */}
      <div className="offcanvas-header app-logo-container">
        <img
          src="https://agrocrm-backend.onrender.com/static/nutricrm_logo.png"
          alt="NutriCRM Logo"
          className="app-logo"
        />
        <button
          type="button"
          className="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: "12px",
            right: "14px",
            filter: "invert(var(--invert-close, 0.5))",
          }}
        ></button>
      </div>

      {/* ========================================================= */}
      {/* 🔹 Corpo com links de navegação */}
      {/* ========================================================= */}
      <div className="offcanvas-body d-flex flex-column justify-content-between p-3">
        <div className="list-group list-group-flush">
          {links.map((item) => {
            const isActive = activeItem === item.label;
            return (
              <button
                key={item.label}
                className={`list-group-item d-flex align-items-center gap-2 ${
                  isActive ? "active" : ""
                }`}
                onClick={() => {
                  onNavigate(item.label);
                  const offcanvasEl = document.getElementById("mobileMenu");
                  if (offcanvasEl) {
                    const bsOffcanvas =
                      bootstrap.Offcanvas.getInstance(offcanvasEl);
                    bsOffcanvas?.hide();
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* 🚪 Rodapé (Logout) */}
        {/* ========================================================= */}
        <div className="border-top border-secondary pt-3">
          <button
            className="btn btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2"
            onClick={() => alert("🚪 Logout realizado!")}
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
