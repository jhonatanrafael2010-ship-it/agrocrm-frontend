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
  activeItem?: string; // ✅ nova prop
}

const MobileMenu: React.FC<MobileMenuProps> = ({ onNavigate, activeItem }) => {
  // Fecha o menu automaticamente quando navega
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
      className="offcanvas offcanvas-start text-bg-dark"
      tabIndex={-1}
      id="mobileMenu"
      aria-labelledby="mobileMenuLabel"
    >
      <div className="offcanvas-header border-bottom border-secondary">
        <h5 className="offcanvas-title text-success fw-bold" id="mobileMenuLabel">
          AgroCRM
        </h5>
        <button
          type="button"
          className="btn-close btn-close-white"
          data-bs-dismiss="offcanvas"
          aria-label="Fechar"
        ></button>
      </div>

      <div className="offcanvas-body d-flex flex-column justify-content-between p-3">
        {/* 🔹 Navegação */}
        <div className="list-group list-group-flush">
          {links.map((item) => (
            <button
              key={item.label}
              className={`list-group-item list-group-item-action d-flex align-items-center gap-2 border-0 ${
                activeItem === item.label
                  ? "active bg-success text-white"
                  : "bg-transparent text-light"
              }`}
              onClick={() => {
                onNavigate(item.label);
                const offcanvasEl = document.getElementById("mobileMenu");
                if (offcanvasEl) {
                  const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
                  bsOffcanvas?.hide();
                }
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* 🔹 Rodapé (Logout) */}
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
