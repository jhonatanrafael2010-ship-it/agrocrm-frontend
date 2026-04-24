import React, { useEffect, useState } from "react";
import {
  ChevronRight,
  Search,
  RefreshCw,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import SearchModal from "./SearchModal";
import NotificationsPanel from "./NotificationsPanel";
import "./Topbar.css";

type Props = {
  activeItem: string;
  lastSync?: string | null;
  syncing?: boolean;
  offline?: boolean;
  onNavigate: (route: string) => void;
};

const PAGE_META: Record<string, { subtitle: string; section: string }> = {
  Dashboard: { subtitle: "Visão geral do negócio", section: "Principal" },
  Clientes: { subtitle: "Gerencie sua carteira", section: "Gestão" },
  Propriedades: { subtitle: "Fazendas e talhões", section: "Gestão" },
  Oportunidades: { subtitle: "Funil de vendas", section: "Gestão" },
  Calendário: { subtitle: "Agenda de visitas", section: "Operação" },
  Acompanhamentos: { subtitle: "Histórico de visitas", section: "Operação" },
};

const Topbar: React.FC<Props> = ({
  activeItem,
  lastSync,
  syncing,
  offline,
  onNavigate,
}) => {
  const meta = PAGE_META[activeItem] || { subtitle: "", section: "" };
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className="topbar-premium">
        <div className="topbar-left">
          <nav className="topbar-breadcrumb">
            <span
              className="topbar-crumb-home"
              onClick={() => onNavigate("Dashboard")}
            >
              NutriCRM
            </span>
            <ChevronRight size={14} className="topbar-crumb-sep" />
            <span className="topbar-crumb-section">{meta.section}</span>
            <ChevronRight size={14} className="topbar-crumb-sep" />
            <span className="topbar-crumb-current">{activeItem}</span>
          </nav>
          <div className="topbar-title-row">
            <h1 className="topbar-title">{activeItem}</h1>
            {meta.subtitle && (
              <span className="topbar-subtitle">{meta.subtitle}</span>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="topbar-search"
            onClick={() => setSearchOpen(true)}
            type="button"
          >
            <Search size={16} className="topbar-search-icon" />
            <span className="topbar-search-placeholder">Buscar...</span>
            <kbd className="topbar-search-kbd">⌘K</kbd>
          </button>

          <div className="topbar-status">
            {offline ? (
              <span className="topbar-badge offline">
                <WifiOff size={14} />
                Offline
              </span>
            ) : syncing ? (
              <span className="topbar-badge syncing">
                <RefreshCw size={14} className="topbar-spin" />
                Sincronizando
              </span>
            ) : lastSync ? (
              <span className="topbar-badge synced">
                <CheckCircle2 size={14} />
                {lastSync}
              </span>
            ) : null}
          </div>

          <NotificationsPanel onNavigate={onNavigate} />
        </div>
      </header>

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};

export default Topbar;
