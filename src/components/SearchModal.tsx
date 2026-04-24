import React, { useEffect, useRef, useState } from "react";
import { Search, X, Users, Map, Briefcase, ClipboardList } from "lucide-react";
import { API_BASE } from "../config";
import "./SearchModal.css";

type Result = {
  type: "client" | "property" | "visit" | "opportunity";
  id: number;
  title: string;
  subtitle?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
};

const ICONS = {
  client: <Users size={16} />,
  property: <Map size={16} />,
  visit: <ClipboardList size={16} />,
  opportunity: <Briefcase size={16} />,
};

const LABELS = {
  client: "Cliente",
  property: "Propriedade",
  visit: "Visita",
  opportunity: "Oportunidade",
};

const ROUTES = {
  client: "Clientes",
  property: "Propriedades",
  visit: "Acompanhamentos",
  opportunity: "Oportunidades",
};

const SearchModal: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase().trim();
        const [clients, properties, visits, opps] = await Promise.all([
          fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}properties`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}opportunities`).then((r) => (r.ok ? r.json() : [])),
        ]);

        const matched: Result[] = [];

        (clients || [])
          .filter((c: any) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.document || "").toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((c: any) =>
            matched.push({
              type: "client",
              id: c.id,
              title: c.name,
              subtitle: c.segment || c.document || "",
            })
          );

        (properties || [])
          .filter((p: any) => (p.name || "").toLowerCase().includes(q))
          .slice(0, 5)
          .forEach((p: any) =>
            matched.push({
              type: "property",
              id: p.id,
              title: p.name,
              subtitle: p.city || "",
            })
          );

        (visits || [])
          .filter(
            (v: any) =>
              (v.client_name || "").toLowerCase().includes(q) ||
              (v.culture || "").toLowerCase().includes(q) ||
              (v.variety || "").toLowerCase().includes(q)
          )
          .slice(0, 5)
          .forEach((v: any) =>
            matched.push({
              type: "visit",
              id: v.id,
              title: `${v.client_name || "Visita"} — ${v.date || ""}`,
              subtitle: `${v.culture || ""} ${v.variety || ""}`.trim(),
            })
          );

        (opps || [])
          .filter((o: any) => (o.title || "").toLowerCase().includes(q))
          .slice(0, 5)
          .forEach((o: any) =>
            matched.push({
              type: "opportunity",
              id: o.id,
              title: o.title,
              subtitle: o.stage || "",
            })
          );

        setResults(matched);
        setSelectedIdx(0);
      } catch (err) {
        console.error("search err", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(r: Result) {
    onNavigate(ROUTES[r.type]);
    onClose();
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  }

  if (!open) return null;

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <Search size={18} className="search-modal-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar clientes, propriedades, visitas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="search-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="search-modal-body">
          {loading && <div className="search-modal-empty">Buscando...</div>}

          {!loading && query && results.length === 0 && (
            <div className="search-modal-empty">Nenhum resultado</div>
          )}

          {!loading && !query && (
            <div className="search-modal-hint">
              <kbd>↑</kbd> <kbd>↓</kbd> navegar &nbsp;
              <kbd>↵</kbd> abrir &nbsp;
              <kbd>esc</kbd> fechar
            </div>
          )}

          {results.map((r, idx) => (
            <button
              key={`${r.type}-${r.id}`}
              className={`search-modal-item ${idx === selectedIdx ? "active" : ""}`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <span className={`search-modal-type type-${r.type}`}>
                {ICONS[r.type]}
              </span>
              <div className="search-modal-item-text">
                <div className="search-modal-title">{r.title}</div>
                {r.subtitle && (
                  <div className="search-modal-sub">{r.subtitle}</div>
                )}
              </div>
              <span className="search-modal-label">{LABELS[r.type]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
