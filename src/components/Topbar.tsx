import React from "react";
import {
  ChevronRight,
  Search,
  Bell,
  RefreshCw,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import "./Topbar.css";

type Props = {
  activeItem: string;
  lastSync?: string | null;
  syncing?: boolean;
  offline?: boolean;
  onSearch?: (q: string) => void;
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
  onSearch,
}) => {
  const meta = PAGE_META[activeItem] || { subtitle: "", section: "" };

  return (
    <header className="topbar-premium">
      <div className="topbar-left">
        <nav className="topbar-breadcrumb">
          <span className="topbar-crumb-home">NutriCRM</span>
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
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Buscar..."
            onChange={(e) => onSearch?.(e.target.value)}
          />
          <kbd className="topbar-search-kbd">⌘K</kbd>
        </div>

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

        <button className="topbar-icon-btn" title="Notificações">
          <Bell size={18} />
          <span className="topbar-icon-dot" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
