import React, { useEffect, useRef, useState } from "react";
import { Bell, AlertCircle, Clock, CheckCircle2, X } from "lucide-react";
import { API_BASE } from "../config";
import "./NotificationsPanel.css";

type Notification = {
  id: string;
  type: "overdue" | "pending" | "info";
  title: string;
  message: string;
  time: string;
  route?: string;
};

type Props = {
  onNavigate: (route: string) => void;
};

const ICONS = {
  overdue: <AlertCircle size={16} />,
  pending: <Clock size={16} />,
  info: <CheckCircle2 size={16} />,
};

const NotificationsPanel: React.FC<Props> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [visits, clients] = await Promise.all([
        fetch(`${API_BASE}visits`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${API_BASE}clients`).then((r) => (r.ok ? r.json() : [])),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const clientMap: Record<number, string> = {};
      (clients || []).forEach((c: any) => (clientMap[c.id] = c.name));

      const notes: Notification[] = [];

      (visits || []).forEach((v: any) => {
        if (!v.date) return;
        const d = new Date(v.date);
        const days = Math.floor(
          (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
        );
        const isDone = v.status === "done";
        const clientName = v.client_name || clientMap[v.client_id] || "Cliente";

        if (!isDone && days > 0 && days <= 30) {
          notes.push({
            id: `overdue-${v.id}`,
            type: "overdue",
            title: "Visita atrasada",
            message: `${clientName} — ${days}d atraso`,
            time: v.date,
            route: "Acompanhamentos",
          });
        } else if (!isDone && days === 0) {
          notes.push({
            id: `today-${v.id}`,
            type: "pending",
            title: "Visita hoje",
            message: clientName,
            time: v.date,
            route: "Calendário",
          });
        }
      });

      notes.sort((a, b) => {
        if (a.type === "overdue" && b.type !== "overdue") return -1;
        if (b.type === "overdue" && a.type !== "overdue") return 1;
        return 0;
      });

      setItems(notes.slice(0, 20));
    } catch (err) {
      console.error("notifications err", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unread = items.length;

  function handleClick(n: Notification) {
    if (n.route) onNavigate(n.route);
    setOpen(false);
  }

  return (
    <div className="notif-wrapper" ref={ref}>
      <button
        className="topbar-icon-btn"
        title="Notificações"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="topbar-icon-dot">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <div>
              <div className="notif-title">Notificações</div>
              <div className="notif-sub">
                {unread === 0 ? "Tudo em dia" : `${unread} pendente(s)`}
              </div>
            </div>
            <button className="notif-close" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="notif-body">
            {loading && items.length === 0 && (
              <div className="notif-empty">Carregando...</div>
            )}

            {!loading && items.length === 0 && (
              <div className="notif-empty">
                <CheckCircle2 size={32} />
                <div>Nenhuma notificação</div>
              </div>
            )}

            {items.map((n) => (
              <button
                key={n.id}
                className={`notif-item type-${n.type}`}
                onClick={() => handleClick(n)}
              >
                <span className="notif-icon">{ICONS[n.type]}</span>
                <div className="notif-text">
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-msg">{n.message}</div>
                </div>
                <div className="notif-time">{n.time}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
